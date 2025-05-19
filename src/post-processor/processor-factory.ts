// src/post-processor/processor-factory.ts
import { PostProcessor } from './types';

/**
 * Factory for creating post-processors
 * 
 * Manages registration and creation of post-processors
 */
export class ProcessorFactory {
  /**
   * Map of registered processors by name (lowercase)
   * 
   * @private
   */
  private static processors: Map<string, new () => PostProcessor> = new Map();

  /**
   * Register a post-processor
   * 
   * @param name - The name of the processor (will be converted to lowercase)
   * @param processorClass - The processor class constructor
   */
  static register(name: string, processorClass: new () => PostProcessor): void {
    ProcessorFactory.processors.set(name.toLowerCase(), processorClass);
  }

  /**
   * Create a post-processor instance
   * 
   * @param name - The name of the processor to create
   * @returns A new instance of the requested processor
   * @throws Error if the processor is not registered
   */
  static createProcessor(name: string): PostProcessor {
    const ProcessorClass = ProcessorFactory.processors.get(name.toLowerCase());
    
    if (!ProcessorClass) {
      throw new Error(
        `Post-processor "${name}" not found. Available processors: ${
          Array.from(ProcessorFactory.processors.keys()).join(', ')
        }`
      );
    }
    
    return new ProcessorClass();
  }

  /**
   * Get a list of all available post-processors
   * 
   * @returns Array of processor names
   */
  static getAvailableProcessors(): string[] {
    return Array.from(ProcessorFactory.processors.keys());
  }
}
