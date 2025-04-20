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
      log.error(`Failed to upload attachment ${file}`, {
        error: (error as Error).message,
        pageId,
        filePath,
        fileSize: require('fs').statSync(filePath).size,
        timestamp: new Date().toISOString(),
        possibleIssues: [
          'File size exceeds Confluence attachment limits',
          'File type is not allowed in Confluence',
          'Page does not exist or permission issues',
          'Network connectivity problems'
        ]
      });
      // Continue with other files even if one fails
    }
  }
}

/**
 * Publishes child pages recursively
 */
async function publishChildPages(
  client: ConfluenceClient,
  config: PublishConfig,
  parentConfig: PublishConfig,
  parentTitle: string,
  basePath: string,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  // No child pages to publish
  if (!parentConfig.childPages || parentConfig.childPages.length === 0) {
    return;
  }

  // Small delay after parent page creation to ensure it's fully indexed in Confluence
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  logger.info(`Publishing ${parentConfig.childPages.length} child pages under "${parentTitle}"...`);

  // Process each child page sequentially
  for (const childConfig of parentConfig.childPages) {
    // Create a new config object by merging the child config with the parent config
    const mergedConfig: PublishConfig = {
      ...config,
      ...parentConfig,
      ...childConfig,
      // Override any properties that should not be inherited
      parentPageTitle: parentTitle,
    };

    // Resolve the distDir relative to the base path if it's a relative path
    if (childConfig.distDir && !path.isAbsolute(childConfig.distDir)) {
      mergedConfig.distDir = path.resolve(basePath, childConfig.distDir);
    }

    // Important: Do not copy childPages from parent to child unless
    // the child explicitly defines its own childPages
    if (!childConfig.childPages) {
      delete mergedConfig.childPages;
    }

    // Publish the child page
    await publishPageRecursive(client, mergedConfig);

    // Recursively process grandchildren (if any)
    if (childConfig.childPages && childConfig.childPages.length > 0) {
      await publishChildPages(
        client,
        config,
        childConfig,
        childConfig.pageTitle,
        basePath,
        logger
      );
    }
  }
}

/**
 * Add recursive publishing helper
 */
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
    await publishChildPages(client, cfg, cfg, cfg.pageTitle, process.cwd(), log);
  }
}

/**
 * Determines troubleshooting steps based on the error type and properties
 * 
 * @param error - The error object encountered during publishing
 * @returns An array of troubleshooting steps appropriate for the error type
 */
function determineTroubleshootingSteps(error: any): string[] {
  // Default troubleshooting steps
  const defaultSteps = [
    'Check your network connection',
    'Verify Confluence server is reachable',
    'Check your authentication credentials'
  ];

  // Error-specific troubleshooting steps
  if (error.statusCode === 401 || error.status === 401) {
    return [
      'Verify your CONFLUENCE_TOKEN is valid and not expired',
      'Ensure the token has appropriate permissions for the space',
      'Check if your Confluence URL is correct (CONFLUENCE_BASE_URL)'
    ];
  } else if (error.statusCode === 403 || error.status === 403) {
    return [
      'Your account lacks permission to perform this operation',
      'Verify you have write access to the specified space',
      'Check if the space or page has restricted permissions'
    ];
  } else if (error.statusCode === 404 || error.status === 404) {
    return [
      'Verify the space key is correct',
      'Check if the parent page exists (if specified)',
      'Ensure the CONFLUENCE_BASE_URL is correct and includes the proper context path'
    ];
  } else if (error.message && error.message.includes('ENOTFOUND')) {
    return [
      'The Confluence server hostname could not be resolved',
      'Check your CONFLUENCE_BASE_URL for typos',
      'Verify your network connection and DNS settings'
    ];
  } else if (error.message && error.message.includes('ECONNREFUSED')) {
    return [
      'Connection was refused by the Confluence server',
      'Verify the server is running and accessible',
      'Check if there are firewall restrictions blocking the connection'
    ];
  } else if (error.message && error.message.includes('timeout')) {
    return [
      'The request to Confluence timed out',
      'The server might be under heavy load or experiencing issues',
      'Try again later or with smaller batches of files'
    ];
  } else if (error.message && error.message.includes('files')) {
    return [
      'Check that the files in your distDir actually exist',
      'Verify your include/exclude patterns in publish-confluence.json',
      'Ensure you\'ve built your project before publishing'
    ];
  } else if (error.message && error.message.includes('template')) {
    return [
      'Verify that your template files exist and are valid',
      'Check the templatePath and macroTemplatePath in your config',
      'Ensure your templates follow Handlebars syntax correctly'
    ];
  }

  return defaultSteps;
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
    log.verbose('Starting publishing process', { options });
    
    const rootConfig = await loadConfiguration();    log.debug('Configuration loaded', { 
      spaceKey: rootConfig.spaceKey,
      pageTitle: rootConfig.pageTitle,
      parentPageTitle: rootConfig.parentPageTitle || 'none',
      hasChildPages: !!rootConfig.childPages
    });
    
    const client = initializeClient(options);
    log.debug('Confluence client initialized');
    
    await publishPageRecursive(client, rootConfig);
    log.success('All pages published successfully.');  } catch (error: any) {
    // Determine error type and add contextual information
    const errorType = error.constructor ? error.constructor.name : 'Unknown Error';
    const errorContext = {
      errorType,
      troubleshootingSteps: determineTroubleshootingSteps(error),
      stack: error.stack || 'No stack trace available',
      options,
      timestamp: new Date().toISOString(),
      // Add error-specific information
      statusCode: error.statusCode || error.status || null,
      apiPath: error.path || null,
      requestInfo: error.request ? {
        method: error.request.method || null,
        url: error.request.url || null
      } : null,
      // Add troubleshooting guidance based on error type
      troubleshooting: determineTroubleshootingSteps(error)
    };
    
    log.error(`Failed to publish to Confluence: ${error.message}`, errorContext);
    process.exit(1);
  }
}