// src/fetch.ts
import { config } from 'dotenv';
import { promises as fs } from 'fs';
import { dirname, join, resolve } from 'path';
import { ConfluenceClient } from './client';
import { readFetchConfigFile, saveFetchConfigFile, updatePageInConfig } from './config';
import { createLogger, setVerbosityLevel, VERBOSITY } from './logger';
import { initializePostProcessors } from './post-processor';
import { AttachmentMetadata, ConfluenceApiCredentials, PageConfig, PublishConfig } from './types';

// Load environment variables from .env file
config();

// Initialize post-processors
initializePostProcessors();

// Initialize logger
const log = createLogger();

/**
 * Clear the output directory for a specific space key
 * @param outputDir Base output directory
 * @param spaceKey The space key to clear
 */
async function clearOutputDirectory(outputDir: string, spaceKey: string): Promise<void> {
  try {
    const spaceDir = join(outputDir, spaceKey);
    log.verbose(`Clearing output directory: ${spaceDir}`);
    
    try {
      // Check if directory exists before attempting to clear it
      await fs.access(spaceDir);
      
      // Remove the directory and all its contents
      await fs.rm(spaceDir, { recursive: true, force: true });
      log.verbose(`Removed directory ${spaceDir}`);
    } catch (error) {
      // Directory doesn't exist, nothing to clear
      log.verbose(`Directory ${spaceDir} doesn't exist, no need to clear`);
    }
    
    // Recreate the empty directory
    await fs.mkdir(spaceDir, { recursive: true });
    log.verbose(`Created empty directory ${spaceDir}`);
  } catch (error) {
    log.error(`Error clearing output directory: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Get authentication credentials from environment variables
 */
function getAuthCredentials(): { auth: ConfluenceApiCredentials, baseUrl: string } {
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
 * Fetch a single page and its children if requested
 */
async function fetchPageAndChildren(
  client: ConfluenceClient,
  spaceKey: string,
  pageTitle: string,
  options: {
    fetchChildren: boolean;
    fetchAttachments?: boolean;
    outputDir: string;
    parentId?: string;
    parentTitle?: string;
    parentPath?: string;
    quiet?: boolean;
    verbose?: boolean;
    debug?: boolean;
    processor?: string;
    processorOptions?: Record<string, unknown>;
  }
): Promise<PageConfig[]> {
  const fetchedPages: PageConfig[] = [];
  
  // Find the page by title
  const page = await client.findPageByTitle(spaceKey, pageTitle);
  
  if (!page) {
    throw new Error(`Page "${pageTitle}" not found in space "${spaceKey}"`);
  }
  
  log.verbose(`Page found with ID: ${page.id}`);
  
  // Get the full page content with body expanded
  const fullPage = await client.getContentById(page.id, ['body.storage']);
  
  // Check if body and storage format exist in the response
  if (!fullPage.body || !fullPage.body.storage) {
    throw new Error(`Failed to retrieve body content for page "${pageTitle}"`);
  }
  
  // Get the page content
  const pageContent = fullPage.body.storage.value || '';
    // Create sanitized filename
  const sanitizedTitle = pageTitle.replace(/[^\w\s-]/g, '_').replace(/\s+/g, '_');
  // Create path for saving the page
  let pagePath;
  let relativeTemplatePath;
    
  // Helper function to normalize paths and avoid duplicate slashes
  const normalizePath = (pathStr: string): string => {
    return pathStr
      .replace(/\/+/g, '/') // Replace multiple consecutive forward slashes with a single one
      .replace(/\\/g, '/'); // Replace backslashes with forward slashes
  };
    if (options.parentPath) {
    // For child pages, create a path under the parent's directory
    const parentDir = dirname(options.parentPath);
    pagePath = join(parentDir, sanitizedTitle, sanitizedTitle + '.html');
    
    // Extract the part of the path after the space key for relative template path
    const pathAfterSpaceKey = dirname(options.parentPath).split(spaceKey)[1] || '';
    const templatePathParts = [options.outputDir, spaceKey];
    
    // Only add the path part after space key if it exists and isn't empty
    if (pathAfterSpaceKey && pathAfterSpaceKey !== '/') {
      // Remove any leading slash before adding to the parts array
      templatePathParts.push(pathAfterSpaceKey.replace(/^\/+/, ''));
    }
    
    templatePathParts.push(sanitizedTitle, `${sanitizedTitle}.html`);
    
    // Join all parts with / and normalize the result
    relativeTemplatePath = normalizePath(templatePathParts.join('/'));
  } else {
    // For root pages
    pagePath = join(options.outputDir, spaceKey, sanitizedTitle, sanitizedTitle + '.html');
    
    // Build path from individual parts to avoid duplicate slashes
    relativeTemplatePath = normalizePath([
      options.outputDir, spaceKey, sanitizedTitle, `${sanitizedTitle}.html`
    ].join('/'));
  }
    // Create directory if it doesn't exist
  const dir = dirname(resolve(pagePath));
  await fs.mkdir(dir, { recursive: true });
    // Save the page content in storage format
  let contentToSave = pageContent;
  let fileExtension = 'html';
  let relativeFileExtension = 'html';
  
  // Apply post-processing if a processor was specified
  if (options.processor) {
    log.verbose(`Post-processing content with "${options.processor}" processor...`);
    
    try {
      // Importing here to avoid circular dependencies
      const { ProcessorFactory } = await import('./post-processor');
      
      const processor = ProcessorFactory.createProcessor(options.processor);
      const result = await processor.process(contentToSave, {
        spaceKey,
        pageId: page.id,
        pageTitle,
        ...options.processorOptions
      });
      
      contentToSave = result.content;
      
      // Update file extension if needed
      if (processor.outputExtension !== 'html') {
        fileExtension = processor.outputExtension;
        relativeFileExtension = processor.outputExtension;
        
        pagePath = pagePath.replace(/\.html$/, `.${fileExtension}`);
        relativeTemplatePath = relativeTemplatePath.replace(/\.html$/, `.${relativeFileExtension}`);
      }
      
      log.verbose(`Post-processing complete. Output format: ${fileExtension}`);
    } catch (error) {
      log.error(`Post-processing failed: ${(error as Error).message}`);
      log.debug((error as Error).stack || 'No stack trace available');
      // Continue with original content if processing fails
    }
  }
  
  // Write to file
  await fs.writeFile(pagePath, contentToSave);
  
  log.success(`Saved page "${pageTitle}" to ${pagePath}`);
  // Fetch attachments if requested
  let attachments: AttachmentMetadata[] = [];
  if (options.fetchAttachments) {
    log.info(`Fetching attachments for page "${pageTitle}"...`);
    attachments = await fetchPageAttachments(client, page.id, pagePath);
    log.verbose(`Downloaded ${attachments.length} attachments for page "${pageTitle}"`);
  }
  
  // Add page to fetched pages
  fetchedPages.push({
    id: page.id,
    title: pageTitle,
    spaceKey: spaceKey,
    path: relativeTemplatePath,  // Use the relative path for templatePath
    parentId: options.parentId,
    parentTitle: options.parentTitle,
    attachments: attachments.length > 0 ? attachments : undefined
  });
  
  // Fetch children if requested
  if (options.fetchChildren) {
    log.info(`Fetching children of "${pageTitle}"...`);
    const children = await client.getChildPages(page.id);
    
    log.verbose(`Found ${children.length} child pages`);
      for (const child of children) {
      const childPages = await fetchPageAndChildren(
        client,
        spaceKey,
        child.title,
        {
          ...options,
          parentId: page.id,
          parentTitle: pageTitle,
          parentPath: pagePath
        }
      );
      
      fetchedPages.push(...childPages);
    }
  }
  
  return fetchedPages;
}

/**
 * Fetch and download attachments for a page
 * @param client ConfluenceClient instance
 * @param pageId Page ID
 * @param outputDir Base output directory
 * @param pagePath Path to the page file
 * @returns Array of attachment metadata
 */
async function fetchPageAttachments(
  client: ConfluenceClient,
  pageId: string,
  pagePath: string
): Promise<AttachmentMetadata[]> {
  try {
    // Get the base directory for storing attachments
    const pageDir = dirname(resolve(pagePath));
    const attachmentsDir = join(pageDir, 'attachments');
    
    // Create attachments directory
    await fs.mkdir(attachmentsDir, { recursive: true });
    
    // Get all attachments for the page
    const attachments = await client.listAttachments(pageId);
    log.verbose(`Found ${attachments.length} attachments for page ID ${pageId}`);
    
    if (attachments.length === 0) {
      return [];
    }
    
    const downloadedAttachments: AttachmentMetadata[] = [];
    
    for (const attachment of attachments) {
      // Create safe filename
      const safeFileName = attachment.title.replace(/[^\w\s.-]/g, '_');
      const attachmentPath = join(attachmentsDir, safeFileName);
      
      // Download the attachment
      log.verbose(`Downloading attachment "${attachment.title}" (${attachment.extensions?.fileSize || 'unknown'} bytes)`);
      const data = await client.downloadAttachment(attachment.id);
      
      // Save to file
      await fs.writeFile(attachmentPath, data);
      log.success(`Saved attachment "${attachment.title}" to ${attachmentPath}`);
      
      // Helper function to normalize paths from fetchPageAndChildren
      const normalizePath = (pathStr: string): string => {
        return pathStr
          .replace(/\/+/g, '/') // Replace multiple consecutive forward slashes with a single one
          .replace(/\\/g, '/'); // Replace backslashes with forward slashes
      };
      
      // Create relative path for config
      const relativePath = normalizePath(['attachments', safeFileName].join('/'));
      
      // Add to downloaded attachments with local path
      downloadedAttachments.push({
        id: attachment.id,
        title: attachment.title,
        fileName: attachment.title,
        mediaType: attachment.extensions?.mediaType || 'application/octet-stream',
        size: attachment.extensions?.fileSize || data.length,
        downloadUrl: attachment._links.download,
        localPath: relativePath
      });
    }
    
    return downloadedAttachments;
  } catch (error) {
    log.error(`Error fetching attachments: ${(error as Error).message}`);
    log.debug((error as Error).stack || 'No stack trace available');
    return []; // Return empty array on error
  }
}

/**
 * Clean up the config to ensure there are no duplicates or pages that appear as both root and child
 * @param config Config to clean up
 * @returns Cleaned up config
 */
function cleanupConfig(config: PublishConfig): PublishConfig {
  // Skip if there's no root pageTitle or no childPages
  if (!config.pageTitle || !config.childPages || config.childPages.length === 0) {
    return config;
  }
  
  // Track processed pages to avoid duplicates
  const processedPages = new Set<string>();
  
  // Add the root page to the set
  const rootPageKey = `${config.spaceKey}:${config.pageTitle}`;
  processedPages.add(rootPageKey);
  
  log.verbose(`Cleaning up config: root page is ${rootPageKey}`);
    // Recursive function to clean up child pages
  const cleanupChildPages = (childPages: PublishConfig[]): PublishConfig[] => {
    const cleanedPages: PublishConfig[] = [];
    
    for (const childPage of childPages) {
      const childKey = `${childPage.spaceKey || config.spaceKey}:${childPage.pageTitle}`;
      const rootPageKey = `${config.spaceKey}:${config.pageTitle}`;
      
      // Skip if this is the root page or if we've already processed it
      if (childKey === rootPageKey) {
        log.verbose(`Skipping child page "${childPage.pageTitle}" that matches root page`);
        continue;
      } else if (processedPages.has(childKey)) {
        log.verbose(`Skipping duplicate child page "${childPage.pageTitle}"`);
        continue;
      }
      
      // Mark this page as processed
      processedPages.add(childKey);
      log.verbose(`Processing child page: ${childKey}`);
      
      // Clean up nested child pages if any
      const cleanedChild = { ...childPage };
      if (cleanedChild.childPages && cleanedChild.childPages.length > 0) {
        cleanedChild.childPages = cleanupChildPages(cleanedChild.childPages);
      }
      
      cleanedPages.push(cleanedChild);
    }
    
    return cleanedPages;
  };
  
  // Create a new config with cleaned up childPages
  return {
    ...config,
    childPages: cleanupChildPages(config.childPages)
  };
}

/**
 * Fetch pages based on command options or config file
 */
export async function fetchPages(options: {
  spaceKey?: string;
  pageTitle?: string;
  outputFile?: string;
  outputDir?: string;
  children?: boolean;
  fetchAttachments?: boolean;
  configFile?: string;
  quiet?: boolean;
  verbose?: boolean;
  debug?: boolean;
  allowSelfSigned?: boolean;
  processor?: string;
  processorOptions?: Record<string, unknown>;
}): Promise<void> {
  try {
    // Set verbosity level based on options
    if (options.quiet) {
      setVerbosityLevel(VERBOSITY.QUIET);
    } else if (options.debug) {
      setVerbosityLevel(VERBOSITY.DEBUG);
    } else if (options.verbose) {
      setVerbosityLevel(VERBOSITY.VERBOSE);
    } else {
      setVerbosityLevel(VERBOSITY.NORMAL);
    }
      
    // Normalize options
    const {
      spaceKey, 
      pageTitle,
      outputDir = './content',
      children = false,
      configFile = './publish-confluence.json',
      allowSelfSigned = true
    } = options;
    
    // Get authentication credentials
    const { auth, baseUrl } = getAuthCredentials();
    
    // Initialize ConfluenceClient
    const client = new ConfluenceClient({
      baseUrl,
      auth,
      verbose: options.verbose || options.debug,
      rejectUnauthorized: !allowSelfSigned
    });
    
    // Read existing config or initialize new one
    let config: PublishConfig = await readFetchConfigFile(configFile);
    
    // Determine which pages to fetch
    let pagesToFetch: { spaceKey: string; pageTitle: string }[] = [];
      // Flag to determine if we're regenerating based on existing config
    const isRegeneratingFromConfig = !spaceKey && !pageTitle;
    
    // Store child-parent relationships for hierarchy preservation
    const childParentMap = new Map<string, string>();
    
    if (spaceKey && pageTitle) {
      // Fetch single page specified by command line arguments
      pagesToFetch = [{ spaceKey, pageTitle }];
      
      // Clear the output directory for this space when explicitly specifying a page
      await clearOutputDirectory(outputDir, spaceKey);
      
      // Start with a clean config when running with command-line parameters
      config = { 
        spaceKey,
        pageTitle: '',  // Will be updated during the fetch process
        templatePath: './confluence-template.html',
        macroTemplatePath: null,
        includedFiles: [],
        excludedFiles: [],
        distDir: './dist',
        childPages: []
      };
    } else if (isRegeneratingFromConfig) {
      // We're regenerating from config file, collect all pages
      log.info(`Regenerating content from config file...`);
        // Helper function to collect pages from config
      const collectPages = (parentConfig: PublishConfig, parentSpaceKey: string, processedPages = new Set<string>()): void => {
        // Add the current page if it has a title
        if (parentConfig.pageTitle) {
          const pageSpaceKey = parentConfig.spaceKey || parentSpaceKey;
          // Create a unique key for this page to avoid duplicates
          const pageKey = `${pageSpaceKey}:${parentConfig.pageTitle}`;
          
          // Only add if we haven't processed this page yet
          if (!processedPages.has(pageKey)) {
            pagesToFetch.push({
              spaceKey: pageSpaceKey,
              pageTitle: parentConfig.pageTitle
            });
            
            // Mark this page as processed
            processedPages.add(pageKey);
            
            // Clear output directory for this space key if not done yet
            clearOutputDirectory(outputDir, pageSpaceKey).catch(error => {
              log.error(`Failed to clear directory for ${pageSpaceKey}: ${(error as Error).message}`);
            });
          }
        }
        
        // Process child pages if any
        if (parentConfig.childPages && parentConfig.childPages.length > 0) {
          for (const childConfig of parentConfig.childPages) {
            const childSpaceKey = childConfig.spaceKey || parentSpaceKey;
            // Create a unique key for this child page
            const childPageKey = `${childSpaceKey}:${childConfig.pageTitle}`;
            
      // Only add if we haven't processed this page yet
            if (!processedPages.has(childPageKey)) {
              pagesToFetch.push({
                spaceKey: childSpaceKey,
                pageTitle: childConfig.pageTitle
              });
              
              // Mark this child page as processed
              processedPages.add(childPageKey);
              
              // Recursively collect nested child pages
              collectPages(childConfig, childSpaceKey, processedPages);
            }
          }
        }
      };
      
      // Start collecting pages from the root config
      collectPages(config, config.spaceKey);
      
      log.info(`Found ${pagesToFetch.length} page(s) to fetch from config file`);      // Store original config structure and settings
      const originalConfig = { ...config };
      
      // Start with a clean config that preserves only the root settings
      config = { 
        spaceKey: originalConfig.spaceKey,
        pageTitle: originalConfig.pageTitle || '',
        templatePath: originalConfig.templatePath || './confluence-template.html',
        macroTemplatePath: originalConfig.macroTemplatePath || null,
        includedFiles: originalConfig.includedFiles || [],
        excludedFiles: originalConfig.excludedFiles || [],
        distDir: originalConfig.distDir || './dist',
        childPages: []
      };
      
      // Helper function to build relationship map from the original config
      const buildRelationshipMap = (parentConfig: PublishConfig, parentKey: string): void => {
        if (parentConfig.childPages && parentConfig.childPages.length > 0) {
          for (const child of parentConfig.childPages) {
            const childSpaceKey = child.spaceKey || parentConfig.spaceKey;
            const childKey = `${childSpaceKey}:${child.pageTitle}`;
            // Store parent-child relationship
            childParentMap.set(childKey, parentKey);
            log.verbose(`Mapped relationship: ${childKey} -> ${parentKey}`);
            // Process nested children
            buildRelationshipMap(child, childKey);
          }
        }
      };
      
      // Build the relationship map starting from root
      if (originalConfig.pageTitle && originalConfig.spaceKey) {
        const rootKey = `${originalConfig.spaceKey}:${originalConfig.pageTitle}`;
        buildRelationshipMap(originalConfig, rootKey);
        log.verbose(`Built relationship map with ${childParentMap.size} entries from config file`);
      }
    } else if (config.childPages && config.childPages.length > 0) {
      // Fetch pages from config's childPages
      pagesToFetch = config.childPages.map(childConfig => ({
        spaceKey: childConfig.spaceKey || config.spaceKey,
        pageTitle: childConfig.pageTitle
      }));
      log.info(`Fetching ${pagesToFetch.length} page(s) from config file...`);
    } else if (config.pageTitle) {
      // Fetch the main page from config
      pagesToFetch = [{ 
        spaceKey: config.spaceKey,
        pageTitle: config.pageTitle
      }];
    } else {
      throw new Error(
        'No pages to fetch. Please provide --space-key and --page-title options ' +
        'or ensure a valid publish-confluence.json file exists with page definitions.'
      );
    }
      
    // If outputFile is provided, it overrides the directory-based approach
    if (options.outputFile && pagesToFetch.length === 1) {
      // Use the original fetchPageContent logic for backward compatibility
      await fetchPageContent({
        spaceKey: pagesToFetch[0].spaceKey,
        pageTitle: pagesToFetch[0].pageTitle,
        outputFile: options.outputFile,
        quiet: options.quiet,
        verbose: options.verbose,
        debug: options.debug,
        allowSelfSigned: allowSelfSigned
      });
      return;
    }
      // Fetch each page and update config
    const allFetchedPages: PageConfig[] = [];
    for (const { spaceKey, pageTitle } of pagesToFetch) {
      log.info(`Fetching page "${pageTitle}" from space "${spaceKey}"...`);
      
      // When regenerating from config, always fetch children regardless of the 'children' parameter
      // Otherwise, respect the provided 'children' parameter
      const shouldFetchChildren = isRegeneratingFromConfig ? true : children;
        const fetchedPages = await fetchPageAndChildren(client, spaceKey, pageTitle, {
        fetchChildren: shouldFetchChildren,
        fetchAttachments: options.fetchAttachments,
        outputDir,
        quiet: options.quiet,
        verbose: options.verbose,
        debug: options.debug,
        processor: options.processor,
        processorOptions: options.processorOptions
      });
      
      allFetchedPages.push(...fetchedPages);
    }    // Update config with all fetched pages
    log.verbose(`Updating config file with ${allFetchedPages.length} pages...`);
    
    // If we're regenerating from config and have relationship mappings
    if (isRegeneratingFromConfig && childParentMap.size > 0) {
      log.verbose(`Rebuilding page hierarchy using ${childParentMap.size} mapped relationships`);
      
      // First pass: process the root page
      let rootPageProcessed = false;
      for (const page of allFetchedPages) {
        // Root page either has no parent or matches the original root page title
        if (!page.parentId || (config.pageTitle === page.title && config.spaceKey === page.spaceKey)) {
          log.verbose(`Processing root page: ${page.title}`);
          config = updatePageInConfig(config, page);
          rootPageProcessed = true;
          break;
        }
      }
      
      // If we didn't find a root page, use the first one (fallback)
      if (!rootPageProcessed && allFetchedPages.length > 0) {
        log.verbose(`No root page found, using the first page as root: ${allFetchedPages[0].title}`);
        config = updatePageInConfig(config, allFetchedPages[0]);
      }
      
      // Second pass: process all child pages with their correct parent relationships 
      for (const page of allFetchedPages) {
        // Skip the root page which we already processed
        if (!page.parentId || (config.pageTitle === page.title && config.spaceKey === page.spaceKey)) {
          continue;
        }
        
        // Get the page key
        const pageKey = `${page.spaceKey}:${page.title}`;
        
        // Check if we have a mapped parent relationship from the original config
        if (childParentMap.has(pageKey)) {
          const parentKey = childParentMap.get(pageKey)!;
          const [parentSpaceKey, parentTitle] = parentKey.split(':');
          
          // Override the detected parent with the one from our original config
          page.parentTitle = parentTitle;
          log.verbose(`Using preserved hierarchy: ${page.title} -> ${parentTitle}`);
        }
        
        // Update the config with this page (using the proper parent)
        config = updatePageInConfig(config, page);
      }
    } else {
      // Regular processing - update each page in sequence
      for (const page of allFetchedPages) {
        config = updatePageInConfig(config, page);
      }
    }
    
    // Clean up the config to ensure there are no duplicates
    // or pages that appear as both root and child
    const cleanedConfig = cleanupConfig(config);
    
    // Save updated config
    await saveFetchConfigFile(configFile, cleanedConfig);
    
    log.success(`Successfully fetched ${allFetchedPages.length} total page(s)`);
  } catch (error) {
    log.error(`Failed to fetch pages: ${(error as Error).message}`);
    log.debug((error as Error).stack || 'No stack trace available');
    throw error; // Rethrow error instead of exiting process
  }
}

/**
 * Fetch page content from Confluence
 */
export async function fetchPageContent(options: {
  spaceKey: string;
  pageTitle: string;
  outputFile?: string;
  quiet?: boolean;
  verbose?: boolean;
  debug?: boolean;
  allowSelfSigned?: boolean;
}): Promise<void> {
  try {
    // Set verbosity level based on options
    if (options.quiet) {
      setVerbosityLevel(VERBOSITY.QUIET);
    } else if (options.debug) {
      setVerbosityLevel(VERBOSITY.DEBUG);
    } else if (options.verbose) {
      setVerbosityLevel(VERBOSITY.VERBOSE);
    } else {
      setVerbosityLevel(VERBOSITY.NORMAL);
    }

    const { spaceKey, pageTitle, outputFile, allowSelfSigned = true } = options;

    // Get authentication credentials
    const { auth, baseUrl } = getAuthCredentials();
    
    log.info(`Fetching page "${pageTitle}" from space "${spaceKey}"...`);
    
    // Initialize ConfluenceClient
    const client = new ConfluenceClient({
      baseUrl,
      auth,
      verbose: options.verbose || options.debug,
      rejectUnauthorized: !allowSelfSigned
    });

    // Find the page by title
    const page = await client.findPageByTitle(spaceKey, pageTitle);
    
    if (!page) {
      throw new Error(`Page "${pageTitle}" not found in space "${spaceKey}"`);
    }
    
    log.verbose(`Page found with ID: ${page.id}`);
    
    // Get the full page content with body expanded
    log.verbose(`Retrieving full page content with body expanded...`);
    const fullPage = await client.getContentById(page.id, ['body.storage']);
    
    log.debug(`Full page response: ${JSON.stringify(fullPage, null, 2)}`);
    
    // Check if body and storage format exist in the response
    if (!fullPage.body) {
      throw new Error(`Body not included in response. Make sure 'body.storage' is in the expanded fields.`);
    }
    
    if (!fullPage.body.storage) {
      throw new Error(`Storage format not included in the body. Full response: ${JSON.stringify(fullPage.body, null, 2)}`);
    }
    
    // Get the page content (may be empty string)
    const pageContent = fullPage.body.storage.value || '';
    
    if (pageContent === '') {
      log.verbose(`Page "${pageTitle}" exists but has empty content.`);
    }
      // Always use storage format
    const contentToSave = pageContent;
      // Handle output - either save to file or output to stdout
    if (outputFile) {
      // Create directory if it doesn't exist
      const dir = dirname(resolve(outputFile));
      await fs.mkdir(dir, { recursive: true });
      
      // Write to file
      await fs.writeFile(outputFile, contentToSave);
      
      log.success(`Successfully saved HTML content to ${outputFile}`);
    } else {
      // Output to stdout as before
      process.stdout.write(contentToSave + '\n');
      log.debug(`Outputting HTML content to stdout`);
      log.success(`Successfully fetched page content.`);
    }
  }catch (error) {
    log.error(`Failed to fetch page content: ${(error as Error).message}`);
    log.debug((error as Error).stack || 'No stack trace available');
    throw error; // Rethrow error instead of exiting process
  }
}