// src/fetch.ts
import { config } from 'dotenv';
import { promises as fs } from 'fs';
import { dirname, resolve, join } from 'path';
import { ConfluenceClient } from './client';
import { readFetchConfigFile, saveFetchConfigFile, updatePageInConfig } from './config';
import { createLogger, setVerbosityLevel, VERBOSITY } from './logger';
import { ConfluenceApiCredentials, PageConfig, PublishConfluenceConfig } from './types';

// Load environment variables from .env file
config();

// Initialize logger
const log = createLogger();

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
    outputFormat: 'storage' | 'json';
    outputDir: string;
    quiet?: boolean;
    verbose?: boolean;
    debug?: boolean;
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
  const pagePath = join(options.outputDir, spaceKey, sanitizedTitle + (options.outputFormat === 'json' ? '.json' : '.html'));
  
  // Create directory if it doesn't exist
  const dir = dirname(resolve(pagePath));
  await fs.mkdir(dir, { recursive: true });
  
  // Determine content to save based on requested format
  const contentToSave = options.outputFormat === 'json' 
    ? JSON.stringify(fullPage, null, 2)
    : pageContent;
  
  // Write to file
  await fs.writeFile(pagePath, contentToSave);
  
  log.success(`Saved page "${pageTitle}" to ${pagePath}`);
  
  // Add page to fetched pages
  fetchedPages.push({
    id: page.id,
    title: pageTitle,
    spaceKey: spaceKey,
    path: pagePath
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
        options
      );
      
      // Update parent info for child pages
      childPages.forEach(childPage => {
        childPage.parentId = page.id;
        childPage.parentTitle = pageTitle;
      });
      
      fetchedPages.push(...childPages);
    }
  }
  
  return fetchedPages;
}

/**
 * Fetch pages based on command options or config file
 */
export async function fetchPages(options: {
  spaceKey?: string;
  pageTitle?: string;
  outputFormat?: 'storage' | 'json';
  outputFile?: string;
  outputDir?: string;
  children?: boolean;
  configFile?: string;
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
    
    // Normalize options
    const {
      spaceKey, 
      pageTitle,
      outputFormat = 'storage',
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
    let config: PublishConfluenceConfig = await readFetchConfigFile(configFile);
    
    // Set baseUrl in config if not already set
    if (!config.baseUrl) {
      config.baseUrl = baseUrl;
    }
    
    // Determine which pages to fetch
    let pagesToFetch: { spaceKey: string; pageTitle: string }[] = [];
    
    if (spaceKey && pageTitle) {
      // Fetch single page specified by command line arguments
      pagesToFetch = [{ spaceKey, pageTitle }];
      log.info(`Fetching page "${pageTitle}" from space "${spaceKey}"...`);
    } else if (config.pages.length > 0) {
      // Fetch pages from config
      pagesToFetch = config.pages.map(page => ({
        spaceKey: page.spaceKey,
        pageTitle: page.title
      }));
      log.info(`Fetching ${pagesToFetch.length} page(s) from config file...`);
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
        outputFormat: outputFormat,
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
      
      const fetchedPages = await fetchPageAndChildren(client, spaceKey, pageTitle, {
        fetchChildren: children,
        outputFormat,
        outputDir,
        quiet: options.quiet,
        verbose: options.verbose,
        debug: options.debug
      });
      
      allFetchedPages.push(...fetchedPages);
    }
    
    // Update config with all fetched pages
    log.verbose(`Updating config file with ${allFetchedPages.length} pages...`);
    for (const page of allFetchedPages) {
      config = updatePageInConfig(config, page);
    }
    
    // Save updated config
    await saveFetchConfigFile(configFile, config);
    
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
  outputFormat?: 'storage' | 'json';
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

    const { spaceKey, pageTitle, outputFormat = 'storage', outputFile, allowSelfSigned = true } = options;

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
    
    // Determine content to save based on requested format
    const contentToSave = outputFormat === 'json' 
      ? JSON.stringify(fullPage, null, 2)
      : pageContent;
    
    // Handle output - either save to file or output to stdout
    if (outputFile) {
      // Create directory if it doesn't exist
      const dir = dirname(resolve(outputFile));
      await fs.mkdir(dir, { recursive: true });
      
      // Write to file
      await fs.writeFile(outputFile, contentToSave);
      
      // Determine file extension for logging
      const fileType = outputFormat === 'json' ? 'JSON' : 'HTML';
      log.success(`Successfully saved ${fileType} content to ${outputFile}`);
    } else {
      // Output to stdout as before
      process.stdout.write(contentToSave + '\n');
      log.debug(`Outputting ${outputFormat} content to stdout`);
      log.success(`Successfully fetched page content.`);
    }  } catch (error) {
    log.error(`Failed to fetch page content: ${(error as Error).message}`);
    log.debug((error as Error).stack || 'No stack trace available');
    throw error; // Rethrow error instead of exiting process
  }
}