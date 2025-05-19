// src/post-processor/index.ts

// Export types
export * from './base-processor';
export * from './processor-factory';
export * from './types';

// Export concrete processors
export * from './handlebars-processor';
export * from './markdown-processor';

// Import and re-export the processor factory for easier access
import { HandlebarsProcessor } from './handlebars-processor';
import { MarkdownProcessor } from './markdown-processor';
import { ProcessorFactory } from './processor-factory';

export { ProcessorFactory };

/**
 * Initialize post-processors by registering default ones
 * 
 * This function should be called before any post-processor is used
 */
export function initializePostProcessors(): void {
  // Register default processors
  ProcessorFactory.register('handlebars', HandlebarsProcessor);
  ProcessorFactory.register('markdown', MarkdownProcessor);
}
