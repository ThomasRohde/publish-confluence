#!/usr/bin/env node
// src/cli.ts
import { program } from 'commander';
import { config } from 'dotenv';
import Handlebars from 'handlebars';
import path from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'url';
import { fetchPageContent } from './fetch';
import { createLogger, VERBOSITY, configureFileLogging } from './logger';
import { registerMacroHelpers } from './macro-helpers';
import { createProject } from './project-creator';
import { generatePrompt } from './prompt-generator';
import { publishToConfluence } from './publisher';
import pkg from '../package.json';
const { version } = pkg;

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
config();

// Register a Handlebars helper to render unescaped HTML content
Handlebars.registerHelper('raw', function(this: any, options: Handlebars.HelperOptions) {
  return new Handlebars.SafeString(options.fn(this));
});

// Register all macro helpers
registerMacroHelpers(Handlebars);

// Initialize logger
const log = createLogger();

// Default verbosity level
let verbosity = VERBOSITY.NORMAL;

/**
 * Create a readline interface for interactive prompts
 */
function createPrompt(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Promisify the question method for async/await usage
 */
async function question(rl: readline.Interface, query: string, defaultValue?: string): Promise<string> {
  const fullQuery = defaultValue 
    ? `${query} (${defaultValue}): ` 
    : `${query}: `;
    
  const answer = await new Promise<string>(resolve => {
    rl.question(fullQuery, resolve);
  });
  
  return answer.trim() || defaultValue || '';
}

/**
 * Generate a project prompt and copy it to clipboard
 */
async function generatePromptCommand(): Promise<void> {
  const rl = createPrompt();
  
  try {
    // Get command line options
    const options = program.opts();
    const cmdOptions = process.argv
      .slice(3) // Skip node, script name, and 'generate-prompt'
      .reduce((acc, arg, i, arr) => {
        if (arg === '-f' || arg === '--file') {
          acc.file = arr[i + 1];
        }
        return acc;
      }, {} as {file?: string});

    // Combine global options and command-specific options
    const combinedOptions = { ...options, ...cmdOptions };
      // Generate the prompt using our extracted module
    const generatedPrompt = await generatePrompt(rl, combinedOptions, log);
    
    log.info('\nGenerated prompt:');
    log.info('----------------------------------------');
    log.info(generatedPrompt);
    log.info('----------------------------------------');
    log.success('Generated prompt completed!');
    
  } catch (error) {
    log.error(`Failed to generate prompt: ${(error as Error).message}`);
  } finally {
    rl.close();
  }
}

// Set up the command line interface
program
  .name('publish-confluence')
  .description('Publish JavaScript builds and HTML content to Confluence')
  .version(version); 

// Default options for all commands
program
  .option('-q, --quiet', 'Suppress all output except errors', false)
  .option('-v, --verbose', 'Enable verbose output', false)
  .option('-d, --debug', 'Enable debug output (includes verbose)', false)
  .option('--log-file [path]', 'Enable logging to file with optional custom path')
  .option('--allow-self-signed', 'Allow self-signed SSL certificates (default: true)', true)
  .option('--no-allow-self-signed', 'Disallow self-signed SSL certificates'); 

// Default action (publish)
program
  .action((options) => {
    // Set verbosity level based on options
    if (options.quiet) {
      verbosity = VERBOSITY.QUIET;
    } else if (options.debug) {
      verbosity = VERBOSITY.DEBUG;
    } else if (options.verbose) {
      verbosity = VERBOSITY.VERBOSE;
    } else {
      verbosity = VERBOSITY.NORMAL;
    }
    
    // Configure file logging if enabled
    if (options.logFile) {
      configureFileLogging(true, typeof options.logFile === 'string' ? options.logFile : undefined);
      log.info(`File logging enabled: ${typeof options.logFile === 'string' ? options.logFile : 'publish-confluence.log'}`);
    }
      publishToConfluence(options).catch(err => {
      log.error(err);
      process.exit(1);
    });
  });

// Create command
program
  .command('create')
  .description('Create a new publish-confluence project')
  .action(() => {    // Set verbosity level based on options
    const options = program.opts();
    if (options.quiet) {
      verbosity = VERBOSITY.QUIET;
    } else if (options.debug) {
      verbosity = VERBOSITY.DEBUG;
    } else if (options.verbose) {
      verbosity = VERBOSITY.VERBOSE;
    } else {
      verbosity = VERBOSITY.NORMAL;
    }
    
    // Configure file logging if enabled
    if (options.logFile) {
      configureFileLogging(true, typeof options.logFile === 'string' ? options.logFile : undefined);
      log.info(`File logging enabled: ${typeof options.logFile === 'string' ? options.logFile : 'publish-confluence.log'}`);
    }
      // Use the extracted createProject function from project-creator.ts
    createProject(log).catch(err => {
      log.error(err);
      process.exit(1);
    });
  });

// Fetch command
program
  .command('fetch')
  .description('Fetch content from a Confluence page')
  .requiredOption('-s, --space-key <key>', 'Confluence space key (required)')
  .requiredOption('-p, --page-title <title>', 'Title of the page to fetch (required)')
  .option('-f, --format <format>', 'Output format: "storage" (default) or "json"', 'storage')
  .action((cmdOptions) => {
    // Merge command options with global options
    const options = { ...program.opts(), ...cmdOptions };
      // Set verbosity level based on options
    if (options.quiet) {
      verbosity = VERBOSITY.QUIET;
    } else if (options.debug) {
      verbosity = VERBOSITY.DEBUG;
    } else if (options.verbose) {
      verbosity = VERBOSITY.VERBOSE;
    } else {
      verbosity = VERBOSITY.NORMAL;
    }
    
    // Configure file logging if enabled
    if (options.logFile) {
      configureFileLogging(true, typeof options.logFile === 'string' ? options.logFile : undefined);
      log.info(`File logging enabled: ${typeof options.logFile === 'string' ? options.logFile : 'publish-confluence.log'}`);
    }
    
    // Use the fetchPageContent function imported at the top of the file
    fetchPageContent({
      spaceKey: options.spaceKey,
      pageTitle: options.pageTitle,
      outputFormat: options.format,
      quiet: options.quiet,
      verbose: options.verbose,
      debug: options.debug,
      allowSelfSigned: options.allowSelfSigned
    }).catch(err => {
      console.error(`Failed to execute fetch command: ${(err as Error).message}`);
      log.debug((err as Error).stack || 'No stack trace available');
      process.exit(1);
    });
  });

// Generate prompt command
program
  .command('generate-prompt')
  .description('Generate a project prompt for LLM assistance and copy it to clipboard')
  .option('-f, --file <filepath>', 'Read project idea from a file')
  .action((cmdOptions) => {
    // Merge command options with global options
    const options = { ...program.opts(), ...cmdOptions };
      // Set verbosity level based on options
    if (options.quiet) {
      verbosity = VERBOSITY.QUIET;
    } else if (options.debug) {
      verbosity = VERBOSITY.DEBUG;
    } else if (options.verbose) {
      verbosity = VERBOSITY.VERBOSE;
    } else {
      verbosity = VERBOSITY.NORMAL;
    }
    
    // Configure file logging if enabled
    if (options.logFile) {
      configureFileLogging(true, typeof options.logFile === 'string' ? options.logFile : undefined);
      log.info(`File logging enabled: ${typeof options.logFile === 'string' ? options.logFile : 'publish-confluence.log'}`);
    }
      generatePromptCommand().catch(err => {
      log.error(err);
      process.exit(1);
    });
  });

program.parse();
