// src/post-processor/types.ts

/**
 * Common options for all post-processors
 */
export interface PostProcessorOptions {
  /** The space key containing the page */
  spaceKey: string;
  /** The unique ID of the page in Confluence */
  pageId: string;
  /** The title of the page */
  pageTitle: string;
  /** Optional prefix to use for macro names */
  macroPrefix?: string;
  /** Additional processor-specific options */
  [key: string]: unknown;
}

/**
 * Result of a post-processing operation
 */
export interface ProcessorResult {
  /** The processed content */
  content: string;
  /** The file extension to use for the output */
  outputExtension: string;
  /** Optional metadata from the processing operation */
  metadata?: Record<string, unknown>;
}

/**
 * Interface that all post-processors must implement
 */
export interface PostProcessor {
  /** The name of the processor */
  readonly name: string;
  /** The default file extension for output files */
  readonly outputExtension: string;
  /** Process Confluence storage format content */
  process(content: string, options: PostProcessorOptions): Promise<ProcessorResult>;
}

/**
 * Options for fetch operations, including post-processing
 */
export interface FetchOptions {
  /** Confluence space key */
  spaceKey?: string;
  /** Title of the page to fetch */
  pageTitle?: string;
  /** Save output to a file */
  outputFile?: string;
  /** Directory to save fetched pages */
  outputDir?: string;
  /** Recursively fetch all child pages */
  children?: boolean;
  /** Path to configuration file */
  configFile?: string;
  /** Suppress all output except errors */
  quiet?: boolean;
  /** Enable verbose output */
  verbose?: boolean;
  /** Enable debug output */
  debug?: boolean;
  /** Allow self-signed SSL certificates */
  allowSelfSigned?: boolean;
  /** Post-processor to use */
  processor?: string;
  /** Additional options for the post-processor */
  processorOptions?: Record<string, unknown>;
}
