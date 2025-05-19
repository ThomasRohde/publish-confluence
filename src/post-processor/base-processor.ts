// src/post-processor/base-processor.ts
import { PostProcessor, PostProcessorOptions, ProcessorResult } from './types';

/**
 * Abstract base class for post-processors
 * 
 * Provides common functionality for all processors
 */
export abstract class BasePostProcessor implements PostProcessor {
  /** The name of the processor */
  abstract readonly name: string;
  
  /** The default file extension for output files */
  abstract readonly outputExtension: string;

  /**
   * Convert Confluence macros to a more usable format
   * 
   * @param content - The content with Confluence macros
   * @returns The processed content with converted macros
   */
  protected convertConfluenceMacros(content: string): string {
    // Base implementation with common macro conversion logic
    // This will be extended by concrete processors
    
    // Process structured macros (ac:structured-macro)
    let processedContent = content.replace(
      /<ac:structured-macro ac:name="([^"]+)"([^>]*)>([\s\S]*?)<\/ac:structured-macro>/g,
      (match, macroName, attributes, macroBody) => {
        // Basic default implementation that will be overridden by specific processors
        return `{{> ${macroName}}}`;
      }
    );
    
    return processedContent;
  }

  /**
   * Process Confluence storage format content
   * 
   * @param content - The content in Confluence storage format
   * @param options - Processor-specific options
   * @returns A promise resolving to the processed content and metadata
   */
  abstract process(content: string, options: PostProcessorOptions): Promise<ProcessorResult>;
}
