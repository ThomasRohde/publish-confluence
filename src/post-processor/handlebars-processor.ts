// src/post-processor/handlebars-processor.ts
import { createLogger } from '../logger';
import { BasePostProcessor } from './base-processor';
import { PostProcessorOptions, ProcessorResult } from './types';

const log = createLogger();

/**
 * Processor that converts Confluence storage format to Handlebars templates
 */
export class HandlebarsProcessor extends BasePostProcessor {
  /** The name of the processor */
  readonly name = 'handlebars';
  
  /** The default file extension for output files */
  readonly outputExtension = 'hbs';

  /**
   * Process a Confluence macro element specifically for Handlebars output
   * 
   * @param macroName - The name of the macro
   * @param macroElement - The macro element
   * @returns The processed macro as a Handlebars partial or helper
   * @override
   */
  protected override processMacro(macroName: string, macroElement: Element): string {
    // Extract macro parameters to use as helper arguments if needed
    const parameters: Record<string, string> = {};
    const parameterNodes = macroElement.getElementsByTagName('ac:parameter');
    
    for (let i = 0; i < parameterNodes.length; i++) {
      const param = parameterNodes[i];
      const name = param.getAttribute('ac:name') || '';
      const value = param.textContent || '';
      if (name) {
        parameters[name] = value;
      }
    }

    // Get macro body content
    const bodyContent = this.extractMacroBody(macroElement);

    // Handle different macro types with specific formatting
    switch (macroName.toLowerCase()) {
      case 'code':
        const language = parameters.language || 'text';
        return `{{#code language="${language}"}}${bodyContent}{{/code}}`;

      case 'info':
      case 'note':
      case 'warning':
      case 'tip':
        return `{{#${macroName}}}${bodyContent}{{/${macroName}}}`;

      case 'panel':
        return `{{#panel title="${parameters.title || ''}"}}${bodyContent}{{/panel}}`;

      // For all other macros, use a partial
      default:
        return `{{> ${macroName}}}`;
    }
  }

  /**
   * Extract the body content of a macro element
   * 
   * @param macroElement - The macro element
   * @returns The body content as a string
   */
  private extractMacroBody(macroElement: Element): string {
    const bodyNode = macroElement.getElementsByTagName('ac:rich-text-body')[0] ||
                     macroElement.getElementsByTagName('ac:plain-text-body')[0];
    
    return bodyNode ? this.processNode(bodyNode) : '';
  }

  /**
   * Process an HTML element node for Handlebars output
   * 
   * @param element - The Element node to process
   * @returns The processed content as a Handlebars-compatible string
   * @override
   */
  protected override processElementNode(element: Element): string {
    // Special handling for Confluence macros
    if (element.nodeName === 'ac:structured-macro') {
      const macroName = element.getAttribute('ac:name') || '';
      return this.processMacro(macroName, element);
    }

    // Handle Confluence-specific tags
    if (element.nodeName === 'ac:image') {
      const attachmentNode = element.getElementsByTagName('ri:attachment')[0];
      if (attachmentNode) {
        const filename = attachmentNode.getAttribute('ri:filename') || '';
        return `{{image "${filename}"}}`;
      }
      return '';
    }

    // Handle regular HTML elements
    const tagName = element.nodeName.toLowerCase();
    
    // These elements can be preserved as-is in Handlebars
    const preserveTags = ['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
      'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'a', 'strong', 'em', 'code', 'pre'];
    
    if (preserveTags.includes(tagName)) {
      // Process children
      let innerContent = '';
      for (let i = 0; i < element.childNodes.length; i++) {
        innerContent += this.processNode(element.childNodes[i]);
      }
      
      // For simple elements with no attributes, just wrap the inner content
      return `<${tagName}>${innerContent}</${tagName}>`;
    }
    
    // For other elements, just process their children
    let output = '';
    for (let i = 0; i < element.childNodes.length; i++) {
      output += this.processNode(element.childNodes[i]);
    }
    
    return output;
  }

  /**
   * Process Confluence storage format content into a Handlebars template
   * 
   * @param content - The content in Confluence storage format
   * @param options - Processor-specific options
   * @returns A promise resolving to the processed content and metadata
   */
  async process(content: string, options: PostProcessorOptions): Promise<ProcessorResult> {
    try {
      log.verbose(`Converting Confluence storage format to Handlebars template...`);
      
      // Convert macros and process content
      const processedContent = this.convertConfluenceMacros(content);
      
      // Apply prefix to macro names if specified
      const finalContent = options.macroPrefix 
        ? processedContent.replace(/\{\{\s*>\s*(\w+)\s*\}\}/g, `{{> ${options.macroPrefix}$1}}`)
        : processedContent;

      return {
        content: finalContent,
        outputExtension: this.outputExtension
      };
    } catch (error) {
      log.error(`Error processing content with Handlebars processor: ${(error as Error).message}`);
      log.debug((error as Error).stack || 'No stack trace available');
      
      // Return original content on error
      return {
        content,
        outputExtension: 'html'
      };
    }
  }
}
