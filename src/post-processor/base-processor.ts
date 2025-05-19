// src/post-processor/base-processor.ts
import { DOMParser } from 'xmldom';
import { createLogger } from '../logger';
import { PostProcessor, PostProcessorOptions, ProcessorResult } from './types';

const log = createLogger();

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
  
  /** XML DOM parser with error handling */
  protected readonly domParser = new DOMParser({
    errorHandler: {
      warning: () => { }, // Suppress warnings
      error: (msg) => log.debug(`XML Parse Error: ${msg}`),
      fatalError: (msg) => log.error(`Fatal XML Parse Error: ${msg}`)
    }
  });

  /**
   * Prepare XML content for parsing by handling special entities and ensuring valid structure
   * 
   * @param content - Raw XML content that may contain special entities
   * @returns Sanitized XML content ready for parsing
   */
  protected prepareXmlContent(content: string): string {
    // Handle special XML entities
    const sanitizedContent = content
      .replace(/&nbsp;/g, '\u00A0')  // Non-breaking space
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      // Handle encoded XML tags in code blocks
      .replace(/&lt;(\/?)code(\s+[^>]*)?>/gi, '<$1code$2>')
      .replace(/&amp;([a-z]+);/g, '&$1;'); // Fix double-escaped entities

    // Wrap in a root element if not already present to ensure valid XML
    return sanitizedContent.trim().startsWith('<')
      ? `<div>${sanitizedContent}</div>`
      : sanitizedContent;
  }

  /**
   * Process a DOM node and convert Confluence-specific elements
   * 
   * @param node - The DOM node to process
   * @returns The processed content as a string
   */
  protected processNode(node: Node): string {
    if (!node) {
      return '';
    }

    // Handle different node types
    switch (node.nodeType) {
      case 1: // Element node
        return this.processElementNode(node as Element);
      
      case 3: // Text node
        return (node as Text).data || '';
      
      case 9: // Document node
        return this.processNode((node as Document).documentElement);
      
      default:
        return '';
    }
  }

  /**
   * Process an Element node and handle Confluence-specific elements
   * 
   * @param element - The Element node to process
   * @returns The processed content as a string
   */
  protected processElementNode(element: Element): string {
    // Special handling for Confluence macros
    if (element.nodeName === 'ac:structured-macro') {
      const macroName = element.getAttribute('ac:name') || '';
      return this.processMacro(macroName, element);
    }

    // Process children and combine their output
    let output = '';
    for (let i = 0; i < element.childNodes.length; i++) {
      output += this.processNode(element.childNodes[i]);
    }

    return output;
  }

  /**
   * Process a Confluence macro element
   * 
   * @param macroName - The name of the macro
   * @param macroElement - The macro element
   * @returns The processed macro as a string
   */
  protected processMacro(macroName: string, macroElement: Element): string {
    // Basic default implementation that should be overridden by specific processors
    return `{{> ${macroName}}}`;
  }

  /**
   * Convert Confluence macros to a more usable format using XML DOM parsing
   * 
   * @param content - The content with Confluence macros
   * @returns The processed content with converted macros
   */
  protected convertConfluenceMacros(content: string): string {
    try {
      // Prepare content for XML parsing
      const xmlContent = this.prepareXmlContent(content);
      
      // Parse the XML content
      const doc = this.domParser.parseFromString(xmlContent, 'text/xml');
      
      // Process the DOM tree and convert to the desired format
      return this.processNode(doc.documentElement);
    } catch (error) {
      log.error(`Error converting macros: ${(error as Error).message}`);
      return content; // Return original content on error
    }
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
