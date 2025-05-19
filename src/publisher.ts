// src/publisher.ts
import fs from 'fs/promises';
import Handlebars from 'handlebars';
import path from 'path';
import { ConfluenceClient } from './client';
import { loadConfiguration } from './config';
import { BadRequestError } from './errors';
import { createLogger, shutdownLogger } from './logger';
import { processMarkdownFile } from './markdown-processor';
import { ConfluenceApiCredentials, ConfluenceXhtmlValidationError, PublishConfig, PublishOptions } from './types';
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
 * Escapes special characters for Confluence's Storage Format (XML) 
 * but only within HTML text content, preserving Confluence macros
 * 
 * @param content - String content that may contain special characters
 * @returns Properly escaped content for Confluence Storage Format
 */
function escapeForConfluence(content: string): string {
  // Only escape ampersands that aren't part of XML entities or Confluence macros
  // This regex finds standalone ampersands not followed by entity pattern
  return content.replace(/&(?!(?:[a-zA-Z]+|#\d+|#x[a-fA-F0-9]+);)/g, '&amp;');
}

/**
 * Load template content from file or use default template if file not found
 * If the template file has a .md extension, it will be preprocessed with the markdown processor
 * 
 * @param templatePath - Path to the template file
 * @param defaultTemplate - Default template content to use if file is not found
 * @returns The loaded template content or default template
 * @throws Error if there's an issue reading the file for reasons other than the file not existing
 */
async function loadTemplate(templatePath: string, defaultTemplate: string, options?: PublishOptions): Promise<string> {
  try {
    const resolvedPath = path.resolve(process.cwd(), templatePath);
    const content = await fs.readFile(resolvedPath, 'utf8');
    log.verbose(`Loaded template from ${templatePath}`);
    
    // Check if the template is a markdown file and process it
    if (templatePath.toLowerCase().endsWith('.md')) {
      log.verbose(`Processing markdown template: ${templatePath}`);
      try {        // Process markdown file
        let processedContent: string;
        
        // If both dry-run and markdown options are enabled, save the processed content as .hbs file
        if (options?.dryRun && options?.markdown) {
          // Generate the output file name by replacing .md extension with .hbs
          const hbsOutputPath = templatePath.replace(/\.md$/i, '.hbs');
          log.info(`Markdown option enabled: Saving processed markdown as ${hbsOutputPath}`);
          
          // Process markdown file and write the output, capturing the processed content in one step
          const resolvedHbsPath = path.resolve(process.cwd(), hbsOutputPath);
          processedContent = await processMarkdownFile(resolvedPath, resolvedHbsPath);
          log.success(`Saved processed markdown to ${hbsOutputPath}`);
        } else {
          // Process markdown file for regular use without saving to .hbs
          processedContent = await processMarkdownFile(resolvedPath);
        }
        
        // Now processedContent is always a string since we fixed the return type
        log.verbose(`Markdown processing successful for ${templatePath}`);
        return processedContent;
      } catch (mdError) {
        log.warn(`Error processing markdown template ${templatePath}, using raw content: ${(mdError as Error).message}`);
      }
    }
    
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
 * @param skipThrow - Skip throwing error if environment variables are missing
 * @returns Object containing authentication credentials and base URL
 * @throws Error if required environment variables are not set (unless skipThrow is true)
 */
export function getAuthCredentials(skipThrow: boolean = false): { auth: ConfluenceApiCredentials, baseUrl: string } {
  // Check for token authentication
  const token = process.env.CONFLUENCE_TOKEN;
  const baseUrl = process.env.CONFLUENCE_BASE_URL;
  
  if (!token || !baseUrl) {
    const errorMessage = 'Authentication credentials not found. Please provide:\n' +
      '- CONFLUENCE_TOKEN and CONFLUENCE_BASE_URL environment variables for token authentication';
    
    if (!skipThrow) {
      throw new Error(errorMessage);
    }
    
    // Return dummy values in dry-run mode
    return {
      baseUrl: 'https://dry-run.confluence.example.com',
      auth: { token: 'dry-run-token' }
    };
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
 * @param options - Command line options
 * @returns Generated HTML macro content for the page
 */
export async function processMacroTemplates(
  config: PublishConfig, 
  context: any, 
  baseUrl?: string, 
  pageId?: string, 
  attachments?: string[],
  options?: PublishOptions
): Promise<string> {
  // Check if macroTemplatePath is defined
  if (!config.macroTemplatePath) {
    log.verbose('No macro template path provided, skipping macro generation');
    return ''; // Return empty string if no macro template path
  }
  // Load the macro template, but don't process as markdown even if it has .md extension
  let macroTemplate: string;
  try {
    const resolvedPath = path.resolve(process.cwd(), config.macroTemplatePath);
    macroTemplate = await fs.readFile(resolvedPath, 'utf8');
    log.verbose(`Loaded macro template from ${config.macroTemplatePath}`);
  } catch (error) {
    log.verbose(`Macro template file ${config.macroTemplatePath} not found, using default template`);
    macroTemplate = DEFAULT_MACRO_TEMPLATE;
  }
  
  // Update context with script and style tags if we have a page ID
  if (baseUrl && pageId && attachments && attachments.length > 0) {
    context.scripts = generateScriptTags(attachments, baseUrl, pageId);
    context.styles = generateStyleTags(attachments, baseUrl, pageId);
    // Add pageId to the context for use in confluence-url helper
    context.pageId = pageId;
    // Add baseUrl to the context for use in confluence-url helper
    context.baseUrl = baseUrl;
  } else {
    context.scripts = '';
    context.styles = '';
  }
  
  // Add command-line options to the context for use by helpers
  if (options) {
    // Copy the comment flag to the context for use by Handlebars helpers
    // This allows helpers to check if comment content should be included
    context.comment = options.comment === true;
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
  // Get authentication credentials, skip throwing in dry-run mode
  const { auth, baseUrl } = getAuthCredentials(isDryRunMode(options));
  
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
 * @param client - The client instance (real or dry-run) 
 * @param config - The publish configuration
 * @param pageContent - The content to publish to the page
 * @returns The created or updated Confluence page
 * @throws Error if page creation/update fails
 */
export async function handlePageUpsert(
  client: any, // Use any for type flexibility
  config: PublishConfig,
  pageContent: string
) {
  // Escape special characters in the page content for Confluence Storage Format
  const escapedContent = escapeForConfluence(pageContent);
  
  // Log the escaping process if in verbose mode
  if (escapedContent !== pageContent) {
    log.verbose('Special characters were escaped for Confluence compatibility');
  }
  
  return client.upsertPage(
    config.spaceKey,
    config.pageTitle,
    escapedContent,
    config.parentPageTitle,
    `Updated by publish-confluence at ${new Date().toISOString()}`
  );
}

/**
 * Upload file attachments to the Confluence page
 * 
 * @param client - The client instance (real or dry-run)
 * @param pageId - The ID of the Confluence page
 * @param distDir - Directory containing build output files
 * @param filesToAttach - Array of files to attach
 * @throws Error if file uploads fail
 */
export async function uploadAttachments(
  client: any, // Use any for type flexibility
  pageId: string,
  distDir: string,
  filesToAttach: string[]
): Promise<void> {
  for (const file of filesToAttach) {
    // Use path.resolve instead of path.join to handle potential issues with duplicate paths
    const filePath = path.resolve(distDir, file);
    log.verbose(`Attaching file: ${file} from ${filePath}`);
    
    try {
      await client.uploadAttachment(
        pageId,
        filePath,
        `Uploaded by publish-confluence at ${new Date().toISOString()}`
      );
    } catch (error) {
      // Get file size using fs/promises instead of require('fs')
      let fileSize: number | null = null;
      try {
        const stats = await fs.stat(filePath);
        fileSize = stats.size;
      } catch {
        fileSize = null;
      }
      
      log.error(`Failed to upload attachment ${file}`, {
        error: (error as Error).message,
        pageId,
        filePath,
        fileSize,
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
  client: any, // Use any for type flexibility
  config: PublishConfig,
  parentConfig: PublishConfig,
  parentTitle: string,
  basePath: string,
  logger: ReturnType<typeof createLogger>,
  options?: PublishOptions
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
    await publishPageRecursive(client, mergedConfig, options);

    // Recursively process grandchildren (if any)
    if (childConfig.childPages && childConfig.childPages.length > 0) {
      await publishChildPages(
        client,
        config,
        childConfig,
        childConfig.pageTitle,
        basePath,
        logger,
        options
      );
    }
  }
}

/**
 * Add recursive publishing helper
 */
async function publishPageRecursive(
  client: any, // Use any for type flexibility
  cfg: PublishConfig,
  options?: PublishOptions
): Promise<void> {
  // Create a context interface to define the expected properties
  interface TemplateContext {
    pageTitle: string;
    currentDate: string;
    pageId?: string;
    baseUrl?: string;
    scripts?: string;
    styles?: string;
    comment?: boolean;
  }
    // Initial context setup for templates with proper typing
  const context: TemplateContext = { 
    pageTitle: cfg.pageTitle, 
    currentDate: new Date().toISOString().split('T')[0]
  };
  
  // Load page template, passing options for markdown processing
  const pageTpl = await loadTemplate(cfg.templatePath, DEFAULT_PAGE_TEMPLATE, options);
  const compile = Handlebars.compile(pageTpl);
  
  // First, search for existing page to determine if this is create or update
  log.debug(`Searching for existing page "${cfg.pageTitle}" in space "${cfg.spaceKey}"`);
  let existingPage = await client.findPageByTitle(cfg.spaceKey, cfg.pageTitle);
  
  // Find attachments regardless of page exists or not - we'll need them either way
  log.debug(`Finding files to attach from directory: ${cfg.distDir}`);
  const files = await findFilesToAttach(cfg.distDir, cfg.includedFiles, cfg.excludedFiles).catch(() => []);
  
  // Track whether we need to do a final page update (for resolved attachment links)
  let needsFinalUpdate = false;
  let pageId: string | undefined;
  
  // HANDLE EXISTING OR NEW PAGE
  if (existingPage) {
    // PAGE EXISTS FLOW
    log.debug(`Found existing page with ID ${existingPage.id}`);
    pageId = existingPage.id;
    
    // Add pageId and baseUrl to the context for use in confluence-url helper in both templates
    context.pageId = pageId;
    context.baseUrl = getBaseUrl(options);
    
    // Generate initial macro content with attachment links
    const initialMacro = await processMacroTemplates(
      cfg, 
      context, 
      getBaseUrl(options), 
      pageId, 
      files, 
      options
    );
    
    // Update the page content with macro containing proper attachment links
    const content = compile({ 
      pageTitle: cfg.pageTitle, 
      macro: initialMacro, 
      currentDate: context.currentDate,
      pageId: pageId,
      baseUrl: getBaseUrl(options)
    });
    
    // Update the page
    log.debug(`Updating existing page with ID ${pageId}`);
    await client.updatePage(
      pageId,
      cfg.pageTitle,
      escapeForConfluence(content),
      existingPage.version?.number ?? 1,
      `Updated by publish-confluence at ${new Date().toISOString()}`
    );
  } else {
    // PAGE DOESN'T EXIST FLOW - try to create new page
    log.debug(`No existing page found, will create new page`);
    
    // Generate initial macro content without attachment links (they'll be added later)
    const initialMacro = await processMacroTemplates(cfg, context, undefined, undefined, undefined, options);
    const content = compile({ 
      pageTitle: cfg.pageTitle, 
      macro: initialMacro, 
      currentDate: context.currentDate 
    });
    
    try {
      // Try to create the page
      log.debug(`Creating new page with title "${cfg.pageTitle}" in space "${cfg.spaceKey}"`);
      const page = await handlePageUpsert(client, cfg, content);
      pageId = page.id;
      log.debug(`Successfully created new page with ID ${pageId}`);
      
      // Add pageId and baseUrl to the context now that we have them
      context.pageId = pageId;
      context.baseUrl = getBaseUrl(options);
        if (files.length > 0 && cfg.macroTemplatePath) {
        needsFinalUpdate = true; // We'll need to update the page with attachment links
      }
    } catch (error: any) {
      // Handle specific error types with helpful messages
      if (error instanceof BadRequestError && error.xhtmlErrors?.length) {
        // This is a malformed XHTML error with detailed information
        log.error('Failed to publish page due to malformed XHTML content.');
          // Check for specific types of errors to provide targeted help
        const hasConfluenceMacroIssues = error.xhtmlErrors.some((err: ConfluenceXhtmlValidationError) => 
          (err.tagName && (err.tagName.startsWith('ac:') || err.tagName.startsWith('ri:'))) ||
          (err.rawMessage && (err.rawMessage.includes('ac:') || err.rawMessage.includes('ri:')))
        );
        
        const hasMismatchedTagIssues = error.xhtmlErrors.some((err: ConfluenceXhtmlValidationError) => 
          err.message && (
            err.message.includes('Tag mismatch') || 
            err.message.includes('Unclosed HTML tag') ||
            err.message.includes('mismatch') ||
            err.message.includes('expected </')
          )
        );
        
        // Log each validation error with line/column information
        error.xhtmlErrors.forEach((err: ConfluenceXhtmlValidationError, index: number) => {
          const locationInfo = err.line ? 
            `Line ${err.line}${err.column ? `, Column ${err.column}` : ''}` : 
            '';
          
          const tagInfo = err.tagName ? `Tag <${err.tagName}>` : '';
          const separator = locationInfo && tagInfo ? ' - ' : '';
          const location = locationInfo || tagInfo ? ` (${locationInfo}${separator}${tagInfo})` : '';
          
          log.error(`  ${index + 1}. ${err.message}${location}`);
        });
        
        // Provide suggestions based on the specific error types
        log.info('\nSuggestions to fix XHTML issues:');
        
        // Tag mismatch specific guidance
        if (hasMismatchedTagIssues) {
          log.info('1. Fix HTML tag nesting issues:');
          log.info('   - HTML tags must be properly nested: <outer><inner></inner></outer>');
          log.info('   - Check for missing closing tags or tags closed in wrong order');
          log.info('   - Common mistake: <li><div></li></div> should be <li><div></div></li>');
        } else {
          log.info('1. Ensure all HTML tags are properly closed (e.g., <div></div>)');
        }
        
        // Character entity guidance
        log.info('2. Use HTML entities for special characters:');
        log.info('   - & must be written as &amp;');
        log.info('   - < must be written as &lt;');
        log.info('   - > must be written as &gt;');
        log.info('   - " must be written as &quot; in attributes');
        
        // Confluence-specific guidance if needed
        if (hasConfluenceMacroIssues) {
          log.info('3. Confluence macro structure issues detected:');
          log.info('   - Ensure all Confluence macro tags are properly closed');
          log.info('   - Common Confluence macros and their correct structure:');
          log.info('     * <ac:structured-macro>...</ac:structured-macro>');
          log.info('     * <ac:layout-section><ac:layout-cell>...</ac:layout-cell></ac:layout-section>');
          log.info('     * <ac:parameter>...</ac:parameter> must be inside a macro');
          log.info('     * Lists and tables must not be interrupted by layout macros');
          log.info('   - See Confluence Storage Format documentation for proper syntax');
        } else {
          log.info('3. Check for invalid or unrecognized HTML attributes');
        }
        
        log.info('4. Validate your HTML content using an XHTML validator');
          // If it's a Confluence layout issue, provide extra specific guidance
        if (error.xhtmlErrors.some((err: ConfluenceXhtmlValidationError) => 
            (err.tagName && err.tagName.includes('layout')) || 
            (err.rawMessage && err.rawMessage.includes('layout')))) {
          log.info('\nSpecific guidance for Confluence layout issues:');
          log.info('1. Layout structure must be properly nested:');
          log.info('   <ac:layout-section>');
          log.info('     <ac:layout-cell>...content...</ac:layout-cell>');
          log.info('     <ac:layout-cell>...content...</ac:layout-cell>');
          log.info('   </ac:layout-section>');
          log.info('2. Common layout mistakes:');
          log.info('   - Layout cells must be direct children of layout sections');
          log.info('   - List items <li> cannot contain layout sections (close the list first)');
          log.info('   - Tables cannot contain layout sections (close the table first)');
          log.info('   - Cannot place <ac:layout-section> directly inside another <ac:layout-section>');
        }
        
        // Rethrow the error so the calling code knows the operation failed
        throw error;
      }
      // Check if this is a "page already exists" error
      else if (isPageAlreadyExistsError(error)) {
        log.debug(`Caught "page already exists" error. Searching again for the page.`);
        
        // The page exists but we couldn't find it earlier - try again with retries and backoff
        for (let attempt = 0; attempt < 3; attempt++) {
          // Add exponential backoff between retries
          const backoffTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          log.debug(`Waiting ${backoffTime}ms before retry attempt ${attempt + 1}...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          
          // Try to find the page again with a fresh search
          existingPage = await client.findPageByTitle(cfg.spaceKey, cfg.pageTitle);
          
          if (existingPage) {
            log.debug(`Found existing page on retry attempt ${attempt + 1} with ID ${existingPage.id}`);
            pageId = existingPage.id;
            
            // Add pageId and baseUrl to the context now that we have them
            context.pageId = pageId;
            context.baseUrl = getBaseUrl(options);
            
            // Generate macro content with proper attachment links
            const updatedMacro = await processMacroTemplates(
              cfg, 
              context, 
              getBaseUrl(options), 
              pageId, 
              files, 
              options
            );
            
            const updatedContent = compile({ 
              pageTitle: cfg.pageTitle, 
              macro: updatedMacro, 
              currentDate: context.currentDate,
              pageId: pageId,
              baseUrl: getBaseUrl(options)
            });
            
            // Update the page with proper content
            log.debug(`Updating existing page with ID ${pageId} (found after create attempt)`);
            await client.updatePage(
              pageId,
              cfg.pageTitle,
              escapeForConfluence(updatedContent),
              existingPage.version?.number ?? 1,
              `Updated by publish-confluence at ${new Date().toISOString()}`
            );
            
            // We've already updated the page with attachment links, so no need for final update
            needsFinalUpdate = false;
            break;
          }
        }
        
        if (!existingPage || !pageId) {
          throw new Error(`Could not find page "${cfg.pageTitle}" after multiple retries, despite Confluence reporting it exists.`);
        }
      } else {
        // Not a "page already exists" error, so re-throw
        throw error;
      }
    }
  }
  
  // Ensure we have a valid pageId before proceeding with attachments
  if (!pageId) {
    throw new Error(`Failed to get a valid page ID for "${cfg.pageTitle}" after create/update attempts.`);
  }
  
  // HANDLE ATTACHMENTS - At this point we should always have a valid pageId
  if (files.length > 0) {
    log.info(`Uploading ${files.length} attachments to ${existingPage ? 'existing' : 'new'} page ${pageId}`);
    await uploadAttachments(client, pageId, cfg.distDir, files);
    
    // Only update the macro content again if there's a macroTemplatePath and we need a final update
    if (cfg.macroTemplatePath && needsFinalUpdate) {
      // Add a small delay to ensure attachments are fully processed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Make sure context has pageId and baseUrl
      context.pageId = pageId;
      context.baseUrl = getBaseUrl(options);
      
      // Generate updated macro content with attachment links
      const updatedMacro = await processMacroTemplates(
        cfg, 
        context, 
        getBaseUrl(options), 
        pageId, 
        files, 
        options
      );
      
      const updatedContent = compile({ 
        pageTitle: cfg.pageTitle, 
        macro: updatedMacro, 
        currentDate: context.currentDate,
        pageId: pageId,
        baseUrl: getBaseUrl(options)
      });
      
      // Update the page with attachment links resolved
      log.debug(`Updating page ${pageId} with resolved attachment links`);
      await client.updatePage(
        pageId,
        cfg.pageTitle,
        escapeForConfluence(updatedContent),
        existingPage?.version?.number ? existingPage.version.number + 1 : 1,
        `Updated attachments by publish-confluence at ${new Date().toISOString()}`
      );
    }
  }

  // Recurse into children
  if (cfg.childPages) {
    await publishChildPages(client, cfg, cfg, cfg.pageTitle, process.cwd(), log, options);
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

// Get the dry-run status in a type-safe way
function isDryRunMode(options?: any): boolean {
  return options && 'dryRun' in options && !!options.dryRun;
}

// Get base URL for Confluence in a safe way, handling dry-run mode
function getBaseUrl(options?: any): string {
  return isDryRunMode(options)
    ? 'https://dry-run.confluence.example.com'
    : getAuthCredentials(isDryRunMode(options)).baseUrl;
}

/**
 * Check if an error is a "page already exists" error that should be suppressed
 * because the page was ultimately published successfully
 * 
 * @param error - The error object to check
 * @returns True if this is a "page already exists" error that can be suppressed
 */
function isPageAlreadyExistsError(error: any): boolean {
  // Check if error is a BadRequestError with specific message about page already existing
  return (
    error.statusCode === 400 &&
    error.responseData &&
    typeof error.responseData === 'object' &&
    'message' in error.responseData &&
    typeof error.responseData.message === 'string' &&
    error.responseData.message.includes('A page with this title already exists')
  );
}

/**
 * Main function to publish content to Confluence
 * 
 * This function orchestrates the entire publishing process:
 * 1. Loads configuration
 * 2. Initializes the Confluence client (or dry-run client)
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
    // Load the main configuration - skip env checks in dry-run mode
    const rootConfig = await loadConfiguration(!!options.dryRun);
    
    // Initialize client or dry-run client
    let client;
    
    if (options.dryRun) {
      // Import dynamically since we only need this for dry-run mode
      const { createDryRunClient } = await import('./dry-run');
      
      // Normalize the directory path
      const dryRunDir = path.isAbsolute(options.dryRun) 
        ? options.dryRun 
        : path.resolve(process.cwd(), options.dryRun || 'dry-run');
        log.info(`Starting dry-run mode. Will write files to: ${dryRunDir}`);
      
      // Create the dry-run client with preview enabled by default, unless explicitly disabled
      client = await createDryRunClient(dryRunDir, {
        previewEnabled: options.preview !== false
      });
    } else {
      // Initialize regular Confluence client
      client = initializeClient(options);
    }
    
    log.debug(options.dryRun 
      ? 'Dry-run client initialized, no actual API calls will be made'
      : 'Confluence client initialized with custom error handling');
      await publishPageRecursive(client, rootConfig, options);
    log.success(options.dryRun
      ? 'All pages generated successfully in dry-run mode.'
      : 'All pages published successfully.');
    
    // Shutdown the logger to ensure proper cleanup and process exit
    shutdownLogger();  } catch (error: any) {
    // Check if this is a "page already exists" error that we can handle gracefully
    if (isPageAlreadyExistsError(error)) {
      // This is a special case where the page already exists but wasn't initially found
      // The page was ultimately published, so we'll just show a success message
      log.verbose('Detected a "page already exists" error, but the page was successfully published', {
        message: error.responseData?.message,
        status: error.statusCode
      });
      
      log.success('All pages published successfully despite initial page existence conflict.');
      shutdownLogger(); // Ensure logger is shutdown in this success path too
      return;
    }
    
    // For all other errors, provide detailed error information
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
    shutdownLogger(); // Ensure logger is shutdown before exit
    process.exit(1);
  }
}