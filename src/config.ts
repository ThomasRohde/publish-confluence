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
  spaceKey: z.string().min(1, { message: "spaceKey is required and cannot be empty" }).optional(),
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
    // First process the inheritance from parent to child pages
    const processedConfig = processConfigInheritance(config);
    
    // Then parse and cast result to PublishConfig
    const validated = pageConfigSchema.parse(processedConfig) as PublishConfig;

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
 * Recursively processes configuration to apply inheritance
 * from parent to child pages for properties like spaceKey
 * 
 * @param config - Configuration object to process
 * @param parentConfig - Parent configuration to inherit from
 * @returns Processed configuration with inheritance applied
 */
function processConfigInheritance(config: Partial<PublishConfig>, parentConfig?: Partial<PublishConfig>): Partial<PublishConfig> {
  // For root config, no inheritance needed
  if (!parentConfig) {
    // Process child pages if they exist
    if (config.childPages && Array.isArray(config.childPages)) {
      // Need to cast to any to avoid TypeScript circular reference issues
      (config.childPages as any) = config.childPages.map((childConfig: Partial<PublishConfig>) => 
        processConfigInheritance(childConfig, config)
      );
    }
    return config;
  }

  // For child configs, inherit properties from parent if they're missing
  const inheritedConfig = { ...config };
  
  // Properties that should be inherited if not specified in child
  if (!inheritedConfig.spaceKey && parentConfig.spaceKey) {
    inheritedConfig.spaceKey = parentConfig.spaceKey;
    log.verbose(`Child page "${inheritedConfig.pageTitle}" inherited spaceKey "${parentConfig.spaceKey}" from parent`);
  }

  // Additional properties that make sense to inherit
  if (!inheritedConfig.templatePath && parentConfig.templatePath) {
    inheritedConfig.templatePath = parentConfig.templatePath;
  }
  
  if (!('macroTemplatePath' in inheritedConfig) && 'macroTemplatePath' in parentConfig) {
    inheritedConfig.macroTemplatePath = parentConfig.macroTemplatePath;
  }

  // Process nested child pages recursively
  if (inheritedConfig.childPages && Array.isArray(inheritedConfig.childPages)) {
    // Need to cast to any to avoid TypeScript circular reference issues
    (inheritedConfig.childPages as any) = inheritedConfig.childPages.map((childConfig: Partial<PublishConfig>) => 
      processConfigInheritance(childConfig, inheritedConfig)
    );
  }

  return inheritedConfig;
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
 * @param skipEnvCheck - Skip checking for environment variables (for dry-run mode)
 * @returns A complete, validated PublishConfig object
 * @throws Error if configuration is invalid or required environment variables are missing
 */
export async function loadConfiguration(skipEnvCheck: boolean = false): Promise<PublishConfig> {
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
  
  if (!skipEnvCheck) {
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingEnvVars.length > 0) {
      log.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
      throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    }
  }
  
  // Validate the configuration using Zod
  return validateConfig(config);
}

/**
 * Read the publish-confluence.json config file specifically for fetch command
 * @param configPath Path to the config file
 * @returns The parsed configuration or a default configuration if the file doesn't exist
 */
export async function readFetchConfigFile(configPath: string): Promise<import('./types').PublishConfluenceConfig> {
  try {
    const configData = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configData) as import('./types').PublishConfluenceConfig;
    
    // Ensure the pages array exists
    if (!config.pages) {
      config.pages = [];
    }
    
    return config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist, return empty config
      return { pages: [] };
    }
    throw error;
  }
}

/**
 * Save the publish-confluence.json config file for fetch command
 * @param configPath Path to save the config file
 * @param config Configuration object to save
 */
export async function saveFetchConfigFile(
  configPath: string, 
  config: import('./types').PublishConfluenceConfig
): Promise<void> {
  // Create directory if it doesn't exist
  const dir = path.dirname(configPath);
  await fs.mkdir(dir, { recursive: true });
  
  // Write the config with pretty formatting
  await fs.writeFile(
    configPath, 
    JSON.stringify(config, null, 2)
  );
  
  log.success(`Updated config file at ${configPath}`);
}

/**
 * Add or update a page in the config
 * @param config Current configuration object
 * @param page Page data to add or update
 * @returns Updated configuration object
 */
export function updatePageInConfig(
  config: import('./types').PublishConfluenceConfig, 
  page: import('./types').PageConfig
): import('./types').PublishConfluenceConfig {
  const updatedConfig = { ...config };
  const existingPageIndex = updatedConfig.pages.findIndex(
    p => p.id === page.id || (p.title === page.title && p.spaceKey === page.spaceKey)
  );
  
  if (existingPageIndex >= 0) {
    // Update existing page
    updatedConfig.pages[existingPageIndex] = {
      ...updatedConfig.pages[existingPageIndex],
      ...page,
      lastFetched: new Date().toISOString()
    };
  } else {
    // Add new page
    updatedConfig.pages.push({
      ...page,
      lastFetched: new Date().toISOString()
    });
  }
  
  return updatedConfig;
}