#!/usr/bin/env node
// src/cli.ts
import { program } from 'commander';
import { config } from 'dotenv';
import Handlebars from 'handlebars';
import path from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'url';
import { fetchPageContent, fetchPages } from './fetch';
import { configureFileLogging, createLogger, setVerbosityLevel, shutdownLogger, VERBOSITY } from './logger';
import { registerMacroHelpers } from './macro-helpers';
import { createProject } from './project-creator';
import { generatePrompt } from './prompt-generator';
import { publishToConfluence } from './publisher';

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
config();

// Initialize logger
const log = createLogger();

// Default verbosity level
let verbosity = VERBOSITY.NORMAL;

// Register a Handlebars helper to render unescaped HTML content
Handlebars.registerHelper('raw', function(this: any, options: Handlebars.HelperOptions) {
  return new Handlebars.SafeString(options.fn(this));
});

// Configure error color formatter for better error visibility
function errorColor(str: string): string {
  // Add ANSI escape codes to display text in red
  return `\x1b[31m${str}\x1b[0m`;
}

/**
 * Configure command options and logging based on verbosity settings
 * @param options Command options
 */
function configureCommandOptions(options: any): void {  // Set verbosity level based on options
  if (options.quiet) {
    verbosity = VERBOSITY.QUIET;
    setVerbosityLevel(VERBOSITY.QUIET);
  } else if (options.debug) {
    verbosity = VERBOSITY.DEBUG;
    setVerbosityLevel(VERBOSITY.DEBUG);
  } else if (options.verbose) {
    verbosity = VERBOSITY.VERBOSE;
    setVerbosityLevel(VERBOSITY.VERBOSE);
  } else {
    verbosity = VERBOSITY.NORMAL;
    setVerbosityLevel(VERBOSITY.NORMAL);
  }
  
  // Configure file logging if enabled
  if (options.logFile) {
    configureFileLogging(true, typeof options.logFile === 'string' ? options.logFile : undefined);
    log.info(`File logging enabled: ${typeof options.logFile === 'string' ? options.logFile : 'publish-confluence.log'}`);
  }
}

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

/**
 * Default publish action function
 */
function runPublishCommand(options: any): void {
  configureCommandOptions(options);
    // Re-register macro helpers with complete options including command-specific options
  registerMacroHelpers(Handlebars, options);
  
  publishToConfluence(options).catch(err => {
    log.error(err);
    shutdownLogger(); // Ensure logger is shutdown before exit
    process.exit(1);
  });
}

// Set up the command line interface
program
  .name('publish-confluence')
  .description('Publish JavaScript builds and HTML content to Confluence')
  .version('1.2.2')
  .showHelpAfterError('(add --help for additional information)')
  .helpOption('-h, --help', 'display help for command')
  .addHelpText('after', '\nWhen run without a command, publish-confluence will execute the "publish" command by default.')
  .configureOutput({
    outputError: (str, write) => write(errorColor(str))
  });

// Default options for all commands
program
  .option('-q, --quiet', 'Suppress all output except errors', false)
  .option('-v, --verbose', 'Enable verbose output', false)
  .option('-d, --debug', 'Enable debug output (includes verbose)', false)
  .option('--log-file [path]', 'Enable logging to file with optional custom path')
  .option('--allow-self-signed', 'Allow self-signed SSL certificates (default: true)', true)
  .option('--no-allow-self-signed', 'Disallow self-signed SSL certificates');

// Register macro helpers before command actions run
program.hook('preAction', () => {
  registerMacroHelpers(Handlebars, program.opts());
});

// Define explicit publish command
program  
  .command('publish', { isDefault: true })
  .description('Publish JavaScript builds and HTML content to Confluence (default)')
  .option('-c, --comment', 'Display content with comment flags in info macros', false)
  .option('--dry-run [dir]', 'Generate storage files locally instead of publishing to Confluence')
  .option('--no-preview', 'Disable HTML preview generation in dry-run mode')
  .option('--markdown', 'Save processed markdown files as .hbs files in dry-run mode', false)
  .action((cmdOptions) => {
    const options = { ...program.opts(), ...cmdOptions };
    runPublishCommand(options);
  });

// Create command
program
  .command('create')
  .description('Create a new publish-confluence project')
  .action(() => {
    const options = program.opts();
    configureCommandOptions(options);
    
    // Use the extracted createProject function from project-creator.ts
    createProject(log).catch(err => {
      log.error(err);
      shutdownLogger(); // Ensure proper cleanup before exit
      process.exit(1);
    });
  });

// Fetch command
program
  .command('fetch')
  .description('Fetch content from Confluence pages')
  .option('-s, --space-key <key>', 'Confluence space key')
  .option('-p, --page-title <title>', 'Title of the page to fetch')
  .option('-f, --format <format>', 'Output format: "storage" (default) or "json"', 'storage')
  .option('-o, --output <file>', 'Save output to a file instead of stdout')
  .option('-c, --children', 'Recursively fetch all child pages', false)
  .option('--output-dir <dir>', 'Directory to save fetched pages (default: ./content)', './content')
  .option('--config <file>', 'Path to config file (default: ./publish-confluence.json)', './publish-confluence.json')
  .action((cmdOptions) => {
    // Merge command options with global options
    const options = { ...program.opts(), ...cmdOptions };
    configureCommandOptions(options);
    
    // Validate the format option
    if (options.format && !['storage', 'json'].includes(options.format)) {
      log.error(`Invalid format: ${options.format}. Must be "storage" or "json".`);
      shutdownLogger(); // Ensure proper cleanup before exit
      process.exit(1);
    }
    
    // Use fetchPages imported at the top of the file
    fetchPages({
      spaceKey: options.spaceKey,
      pageTitle: options.pageTitle,
      outputFormat: options.format,
      outputFile: options.output,
      outputDir: options.outputDir,
      children: options.children,
      configFile: options.config,
      quiet: options.quiet,
      verbose: options.verbose,
      debug: options.debug,
      allowSelfSigned: options.allowSelfSigned
    }).catch(err => {
      log.error(`Failed to execute fetch command: ${(err as Error).message}`);
      log.debug((err as Error).stack || 'No stack trace available');
      shutdownLogger(); // Ensure proper cleanup before exit
      process.exit(1);
    });
  });

// Generate prompt command
program
  .command('generate-prompt')
  .description('Generate a project prompt for LLM assistance')
  .option('-f, --file <filepath>', 'Read project idea from a file')
  .action((cmdOptions) => {
    // Merge command options with global options
    const options = { ...program.opts(), ...cmdOptions };
    configureCommandOptions(options);      generatePromptCommand().catch((err: Error) => {
      log.error(err.message);
      log.debug(err.stack || 'No stack trace available');
      shutdownLogger(); // Ensure proper cleanup before exit  
      process.exit(1);
    });
  });

program.parse();
