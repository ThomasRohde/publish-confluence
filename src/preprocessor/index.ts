/**
 * Preprocessor interface and registry for content format preprocessing
 * before template rendering.
 */

/**
 * Interface for content preprocessors
 */
export interface Preprocessor {
  /** The format this preprocessor handles */
  readonly format: 'html' | 'markdown';
  
  /**
   * Process the raw content and return the processed content
   * @param raw The raw content to process
   * @returns Promise resolving to the processed content
   */
  process(raw: string): Promise<string>;
}

// Registry to store available preprocessors
const registry = new Map<string, Preprocessor>();

/**
 * Register a preprocessor in the global registry
 * @param p The preprocessor to register
 */
export function registerPreprocessor(p: Preprocessor): void {
  registry.set(p.format, p);
}

/**
 * Preprocess content according to the specified format
 * @param format The format to preprocess (html, markdown, etc.)
 * @param raw The raw content to process
 * @returns Promise resolving to the processed content
 */
export async function preprocessContent(format: string, raw: string): Promise<string> {
  const p = registry.get(format) ?? registry.get('html'); // html = identity
  return p!.process(raw);
}

// Register the default identity preprocessor
registerPreprocessor({
  format: 'html',
  process: async (s: string) => s
});
