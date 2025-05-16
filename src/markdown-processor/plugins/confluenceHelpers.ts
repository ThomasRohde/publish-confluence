/**
 * Utility functions for handling Confluence handlebars macros and helpers
 */

// Regular expression for Handlebars expressions
export const handlebarsRegex = /{{([^{}]*)}}/g;

/**
 * Creates a confluence-image helper string from image properties
 * 
 * @param src The image source URL or path
 * @param alt The image alt text
 * @param width Optional width of the image
 * @param height Optional height of the image
 * @param additionalProps Additional properties to add to the helper
 * @returns A string with the confluence-image helper
 */
export function createImageHelper(
  src: string, 
  alt: string, 
  width?: string | number,
  height?: string | number,
  additionalProps: Record<string, string> = {}
): string {
  let helper = `{{confluence-image src="${src}" alt="${alt}"`;
  
  if (width) {
    helper += ` width="${width}"`;
  }
  
  if (height) {
    helper += ` height="${height}"`;
  }
  
  // Add any additional properties
  Object.entries(additionalProps).forEach(([key, value]) => {
    helper += ` ${key}="${value}"`;
  });
  
  helper += '}}';
  
  return helper;
}
