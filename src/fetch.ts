// src/fetch.ts
import { program } from 'commander';
import { config } from 'dotenv';
import { promises as fs } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { ConfluenceClient } from './client';
import { createLogger, setVerbosityLevel, VERBOSITY } from './logger';
import { ConfluenceApiCredentials } from './types';

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
    }
  } catch (error) {
    log.error(`Failed to fetch page content: ${(error as Error).message}`);
    log.debug((error as Error).stack || 'No stack trace available');
    process.exit(1);
  }
}

// ES Module-compatible entry point detection
const isMainModule = typeof import.meta.url === 'string' && 
  import.meta.url === `file://${fileURLToPath(import.meta.url)}`;

if (isMainModule) {
  // Set up the command line interface
  program
    .description('Fetch content from a Confluence page')
    .requiredOption('-s, --space-key <key>', 'Confluence space key (required)')
    .requiredOption('-p, --page-title <title>', 'Title of the page to fetch (required)')
    .option('-f, --format <format>', 'Output format: "storage" (default) or "json"', 'storage')
    .option('-o, --output <file>', 'Save output to a file instead of stdout')
    .option('-q, --quiet', 'Suppress all output except errors', false)
    .option('-v, --verbose', 'Enable verbose output', false)
    .option('-d, --debug', 'Enable debug output (includes verbose)', false)
    .option('--allow-self-signed', 'Allow self-signed SSL certificates (default: true)', true)
    .option('--no-allow-self-signed', 'Disallow self-signed SSL certificates')
    .parse(process.argv);

  const options = program.opts();
  
  // Validate the format option
  if (options.format && !['storage', 'json'].includes(options.format)) {
    log.error(`Invalid format: ${options.format}. Must be "storage" or "json".`);
    process.exit(1);
  }

  // Run the fetch command
  fetchPageContent({
    spaceKey: options.spaceKey,
    pageTitle: options.pageTitle,
    outputFormat: options.format,
    outputFile: options.output,
    quiet: options.quiet,
    verbose: options.verbose,
    debug: options.debug,
    allowSelfSigned: options.allowSelfSigned
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}