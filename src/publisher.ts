// src/publisher.ts
import fs from 'fs/promises';
import Handlebars from 'handlebars';
import path from 'path';
import { ConfluenceClient } from './client';
import { loadConfiguration } from './config';
import { createLogger } from './logger';
import { ConfluenceApiCredentials, PublishConfig, PublishOptions } from './types';
import { generateUuid } from './utils';

// Initialize logger
const log = createLogger();

// Default templates
const DEFAULT_PAGE_TEMPLATE = `<h1>{{pageTitle}}</h1>

{{{macro}}}

<hr/>
<p><em>Last updated: {{currentDate}}</em></p>`;

const DEFAULT_MACRO_TEMPLATE = `<div>
  <div id="app"></div>
  {{{styles}}}
  {{{scripts}}}
</div>`;

/**
 * Load template content from file or use default template if file not found
 * 
 * @param templatePath - Path to the template file
 * @param defaultTemplate - Default template content to use if file is not found
 * @returns The loaded template content or default template
 * @throws Error if there's an issue reading the file for reasons other than the file not existing
 */
async function loadTemplate(templatePath: string, defaultTemplate: string): Promise<string> {
  try {
    const resolvedPath = path.resolve(process.cwd(), templatePath);
    const content = await fs.readFile(resolvedPath, 'utf8');
    log.verbose(`Loaded template from ${templatePath}`);
    return content;
  } catch (error) {
    log.verbose(`Template file ${templatePath} not found, using default template`);
    return defaultTemplate;
  }
}

/**
 * Generate script tags for attached JavaScript files
 * 
 * @param attachments - List of attachment filenames
 * @param baseUrl - Base URL of the Confluence instance
 * @param pageId - ID of the Confluence page
 * @returns HTML string with script tags for all JavaScript attachments
 */
function generateScriptTags(attachments: string[], baseUrl: string, pageId: string): string {
  return attachments
    .filter(attachment => attachment.endsWith('.js'))
    .map(script => `<script src="${baseUrl}/download/attachments/${pageId}/${script}?api=v2" defer></script>`)
    .join('\n');
}

/**
 * Generate link tags for attached CSS files
 * 
 * @param attachments - List of attachment filenames
 * @param baseUrl - Base URL of the Confluence instance
 * @param pageId - ID of the Confluence page
 * @returns HTML string with link tags for all CSS attachments
 */
function generateStyleTags(attachments: string[], baseUrl: string, pageId: string): string {
  return attachments
    .filter(attachment => attachment.endsWith('.css'))
    .map(style => `<link rel="stylesheet" href="${baseUrl}/download/attachments/${pageId}/${style}?api=v2">`)
    .join('\n');
}

/**
 * Find files in the output directory matching the include/exclude patterns
 * 
 * @param distDir - Directory containing build output files
 * @param includedFiles - Array of glob patterns for files to include
 * @param excludedFiles - Array of glob patterns for files to exclude
 * @returns Array of relative file paths that match the patterns
 * @throws Error if there's an issue scanning the directory
 */
export async function findFilesToAttach(distDir: string, includedFiles: string[], excludedFiles: string[]): Promise<string[]> {
  const { globby } = await import('globby');
  
  try {
    const files = await globby(includedFiles, {
      cwd: distDir,
      ignore: excludedFiles,
      absolute: false
    });
    
    return files;
  } catch (error) {
    log.error(`Error scanning files in ${distDir}: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Get authentication credentials from environment variables
 * 
 * @returns Object containing authentication credentials and base URL
 * @throws Error if required environment variables are not set
 */
export function getAuthCredentials(): { auth: ConfluenceApiCredentials, baseUrl: string } {
  // Check for token authentication
  const token = process.env.CONFLUENCE_TOKEN;
  const baseUrl = process.env.CONFLUENCE_BASE_URL;
  
  if (!token || !baseUrl) {
    throw new Error(
      'Authentication credentials not found. Please provide:\n' +
      '- CONFLUENCE_TOKEN and CONFLUENCE_BASE_URL environment variables for token authentication'
    );
  }

  return {
    baseUrl,
    auth: { token }
  };
}

/**
 * Process macro template and generate the HTML macro content
 * 
 * @param config - The publish configuration
 * @param context - The context data for template variables
 * @param baseUrl - The base URL of the Confluence instance
 * @param pageId - The ID of the Confluence page
 * @param attachments - List of file attachments
 * @returns Generated HTML macro content for the page
 */
export async function processMacroTemplates(
  config: PublishConfig, 
  context: any, 
  baseUrl?: string, 
  pageId?: string, 
  attachments?: string[]
): Promise<string> {
  // Check if macroTemplatePath is defined
  if (!config.macroTemplatePath) {
    log.verbose('No macro template path provided, skipping macro generation');
    return ''; // Return empty string if no macro template path
  }

  // Load the macro template
  const macroTemplate = await loadTemplate(
    config.macroTemplatePath, 
    DEFAULT_MACRO_TEMPLATE
  );
  
  // Update context with script and style tags if we have a page ID
  if (baseUrl && pageId && attachments && attachments.length > 0) {
    context.scripts = generateScriptTags(attachments, baseUrl, pageId);
    context.styles = generateStyleTags(attachments, baseUrl, pageId);
  } else {
    context.scripts = '';
    context.styles = '';
  }
  
  // Process HTML macro template
  const compileHandlebars = Handlebars.compile(macroTemplate);
  
  // Apply the macro template
  const expandedMacro = compileHandlebars(context);

  // Generate a unique ID for the macro
  const macroId = generateUuid();

  // Wrap the expanded macro in a structured HTML macro format
  return `<ac:structured-macro ac:name="html" ac:schema-version="1" ac:macro-id="${macroId}">
    <ac:plain-text-body><![CDATA[${expandedMacro}]]></ac:plain-text-body>
  </ac:structured-macro>`;
}

/**
 * Initialize the Confluence client with appropriate configuration
 * 
 * @param options - Command line options for the publish tool
 * @returns Configured ConfluenceClient instance
 * @throws Error if authentication fails or configuration is invalid
 */
export function initializeClient(options: PublishOptions): ConfluenceClient {
  // Get authentication credentials
  const { auth, baseUrl } = getAuthCredentials();
  
  // Initialize ConfluenceClient
  return new ConfluenceClient({
    baseUrl,
    auth,
    verbose: options.verbose || options.debug,
    rejectUnauthorized: !options.allowSelfSigned
  });
}

/**
 * Handle page creation or update in Confluence
 * 
 * @param client - The ConfluenceClient instance
 * @param config - The publish configuration
 * @param pageContent - The content to publish to the page
 * @returns The created or updated Confluence page
 * @throws Error if page creation/update fails
 */
export async function handlePageUpsert(
  client: ConfluenceClient,
  config: PublishConfig,
  pageContent: string
) {
  return client.upsertPage(
    config.spaceKey,
    config.pageTitle,
    pageContent,
    config.parentPageTitle,
    `Updated by publish-confluence at ${new Date().toISOString()}`
  );
}

/**
 * Upload file attachments to the Confluence page
 * 
 * @param client - The ConfluenceClient instance
 * @param pageId - The ID of the Confluence page
 * @param distDir - Directory containing build output files
 * @param filesToAttach - Array of files to attach
 * @throws Error if file uploads fail
 */
export async function uploadAttachments(
  client: ConfluenceClient,
  pageId: string,
  distDir: string,
  filesToAttach: string[]
): Promise<void> {
  for (const file of filesToAttach) {
    const filePath = path.join(process.cwd(), distDir, file);
    log.verbose(`Attaching file: ${file}`);
    
    try {
      await client.uploadAttachment(
        pageId,
        filePath,
        `Uploaded by publish-confluence at ${new Date().toISOString()}`
      );
    } catch (error) {
      log.error(`Failed to upload attachment ${file}: ${(error as Error).message}`);
      // Continue with other files even if one fails
    }
  }
}

// Add recursive publishing helper
async function publishPageRecursive(
  client: ConfluenceClient,
  cfg: PublishConfig
): Promise<void> {
  // Upsert page
  const context = { pageTitle: cfg.pageTitle, currentDate: new Date().toISOString().split('T')[0] };
  const pageTpl = await loadTemplate(cfg.templatePath, DEFAULT_PAGE_TEMPLATE);
  const compile = Handlebars.compile(pageTpl);
  const initialMacro = await processMacroTemplates(cfg, context);
  const content = compile({ pageTitle: cfg.pageTitle, macro: initialMacro, currentDate: context.currentDate });
  const page = await handlePageUpsert(client, cfg, content);

  // Handle attachments
  if (cfg.macroTemplatePath) {
    const files = await findFilesToAttach(cfg.distDir, cfg.includedFiles, cfg.excludedFiles).catch(() => []);
    if (files.length) {
      await uploadAttachments(client, page.id, cfg.distDir, files);
      const updatedMacro = await processMacroTemplates(cfg, context, getAuthCredentials().baseUrl, page.id, files);
      const updatedContent = compile({ pageTitle: cfg.pageTitle, macro: updatedMacro, currentDate: context.currentDate });
      await handlePageUpsert(client, cfg, updatedContent);
    }
  }

  // Recurse into children
  if (cfg.childPages) {
    for (const child of cfg.childPages) {
      child.parentPageTitle = cfg.pageTitle;
      await publishPageRecursive(client, child);
    }
  }
}

/**
 * Main function to publish content to Confluence
 * 
 * This function orchestrates the entire publishing process:
 * 1. Loads configuration
 * 2. Initializes the Confluence client
 * 3. Loads templates
 * 4. Finds files to attach
 * 5. Creates or updates the page
 * 6. Attaches files to the page
 * 7. Updates the page with proper script and style URLs
 * 
 * @param options - Command line options for the publish tool
 * @returns Promise that resolves when publishing is complete
 * @throws Error if any part of the publishing process fails
 */
export async function publishToConfluence(options: PublishOptions): Promise<void> {
  try {
    const rootConfig = await loadConfiguration();
    const client = initializeClient(options);
    await publishPageRecursive(client, rootConfig);
    log.success('All pages published successfully.');
  } catch (error: any) {
    log.error(`Failed to publish to Confluence: ${error.message}`);
    log.debug(error.stack || 'No stack trace available');
    process.exit(1);
  }
}