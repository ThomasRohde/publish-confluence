// src/config.ts
import fs from 'fs/promises';
import path from 'path';
import { z, ZodTypeAny } from 'zod';
import { createLogger } from './logger';
import { PublishConfig } from './types';

/**
 * Recursive Zod schema for PublishConfig including childPages
 */
const pageConfigSchema: ZodTypeAny = z.lazy(() => z.object({
  spaceKey: z.string().min(1, { message: "spaceKey is required and cannot be empty" }),
  pageTitle: z.string().min(1, { message: "pageTitle is required and cannot be empty" }),
  parentPageTitle: z.string().optional(),
  templatePath: z.string().default('./confluence-template.html'),
  macroTemplatePath: z.string().nullable().default(null),
  includedFiles: z.array(z.string()).default([]),
  excludedFiles: z.array(z.string()).default([]),
  distDir: z.string().default('./dist'),
  childPages: z.array(pageConfigSchema).optional()
}));

/**
 * Default configuration values for the publish-confluence tool
 * These values are used when specific options are not provided in the configuration file
 */
export const DEFAULT_CONFIG: Partial<PublishConfig> = {
  spaceKey: '',
  pageTitle: '',
  parentPageTitle: '',
  templatePath: './confluence-template.html',
  macroTemplatePath: null, // Changed from './macro-template.html' to null
  includedFiles: [],
  excludedFiles: [],
  distDir: './dist'
};

/**
 * Initialize logger
 */
const log = createLogger();

/**
 * Validates user configuration against the schema
 * 
 * This function uses Zod to validate the configuration against the defined schema,
 * providing detailed error messages for any validation failures.
 * 
 * @param config - User configuration to validate
 * @returns Validated configuration object that conforms to the schema
 * @throws Error with detailed validation messages if the configuration is invalid
 */
function validateConfig(config: Partial<PublishConfig>): PublishConfig {
  try {
    // Parse and cast result to PublishConfig
    const validated = pageConfigSchema.parse(config) as PublishConfig;

    // Apply special logic for macroTemplatePath defaults
    if (validated.macroTemplatePath !== null && validated.includedFiles.length === 0) {
      validated.includedFiles = DEFAULT_CONFIG.includedFiles || [];
    }
    if (validated.macroTemplatePath !== null && validated.excludedFiles.length === 0) {
      validated.excludedFiles = DEFAULT_CONFIG.excludedFiles || [];
    }

    return validated;
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      const formattedErrors = err.errors
        .map((issue) => {
          const path = issue.path.join('.');
          return `- ${path}: ${issue.message}`;
        })
        .join('\n');

      log.error(`Configuration validation failed:\n${formattedErrors}`);
      throw new Error(`Invalid configuration. Please check your publish-confluence.json file:\n${formattedErrors}`);
    }
    // Re-throw other errors
    throw err;
  }
}

/**
 * Load configuration from package.json and publish-confluence.json
 * 
 * This function loads and merges configuration from multiple sources:
 * 1. Default configuration
 * 2. package.json (for page title)
 * 3. publish-confluence.json (for all options)
 * 
 * It also validates required environment variables and the final configuration.
 * 
 * @returns A complete, validated PublishConfig object
 * @throws Error if configuration is invalid or required environment variables are missing
 */
export async function loadConfiguration(): Promise<PublishConfig> {
  let config: Partial<PublishConfig> = { ...DEFAULT_CONFIG };
  
  // Try to load package.json
  try {
    const packageJsonPath = path.resolve(process.cwd(), 'package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);
    
    // Use package name as page title if not specified
    if (!config.pageTitle) {
      config.pageTitle = packageJson.name || '';
    }
    
    log.verbose(`Loaded project name from package.json: ${packageJson.name}`);
  } catch (error) {
    log.verbose('Could not load package.json');
  }
  
  // Try to load publish-confluence.json
  try {
    const configPath = path.resolve(process.cwd(), 'publish-confluence.json');
    const configContent = await fs.readFile(configPath, 'utf8');
    
    try {
      const userConfig = JSON.parse(configContent);
      
      // If user config doesn't specify includedFiles or excludedFiles, set them to empty
      // to avoid conflicts with the default when macroTemplatePath is null
      if (userConfig.macroTemplatePath === null) {
        if (!userConfig.includedFiles) userConfig.includedFiles = [];
        if (!userConfig.excludedFiles) userConfig.excludedFiles = [];
      }
      
      // Merge with defaults
      config = { 
        ...config, 
        ...userConfig,
        includedFiles: userConfig.includedFiles !== undefined ? userConfig.includedFiles : config.includedFiles,
        excludedFiles: userConfig.excludedFiles !== undefined ? userConfig.excludedFiles : config.excludedFiles
      };
      // Handle nested childPages if provided
      if ((userConfig as any).childPages) {
        (config as any).childPages = (userConfig as any).childPages;
      }

      log.verbose('Loaded configuration from publish-confluence.json');
    } catch (parseError) {
      log.error(`Failed to parse publish-confluence.json: ${(parseError as Error).message}`);
      throw new Error(`Invalid JSON in publish-confluence.json: ${(parseError as Error).message}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.error(`Error reading publish-confluence.json: ${(error as Error).message}`);
    } else {
      log.verbose('No publish-confluence.json found, using defaults');
    }
  }
  
  // Check required environment variables
  const requiredEnvVars = [
    'CONFLUENCE_TOKEN',
    'CONFLUENCE_BASE_URL'
  ];
  
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingEnvVars.length > 0) {
    log.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  }
  
  // Validate the configuration using Zod
  return validateConfig(config);
}