// src/post-processor/index.ts

// Export types
export * from './base-processor';
export * from './processor-factory';
export * from './types';

// Import and re-export the processor factory for easier access
import { ProcessorFactory } from './processor-factory';

export { ProcessorFactory };

/**
 * Initialize post-processors by registering default ones
 * 
 * This function should be called before any post-processor is used
 */
export function initializePostProcessors(): void {
  // This will be populated with default processors in Phase 2
  // For now, we're just setting up the framework
}
