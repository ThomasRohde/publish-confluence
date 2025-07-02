// src/post-processor/base-processor.ts
import { DOMParser } from '@xmldom/xmldom';
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
  protected readonly domParser = new DOMParser();

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
      .replace(/&hellip;/g, '…')
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&lsquo;/g, "'")
      .replace(/&rsquo;/g, "'")
      // Handle encoded XML tags in code blocks
      .replace(/&lt;(\/?)code(\s+[^>]*)?>/gi, '<$1code$2>')
      .replace(/&lt;(\/?)pre(\s+[^>]*)?>/gi, '<$1pre$2>')
      // Handle table-specific entities and formatting
      .replace(/&lt;(\/?)table(\s+[^>]*)?>/gi, '<$1table$2>')
      .replace(/&lt;(\/?)tr(\s+[^>]*)?>/gi, '<$1tr$2>')
      .replace(/&lt;(\/?)td(\s+[^>]*)?>/gi, '<$1td$2>')
      .replace(/&lt;(\/?)th(\s+[^>]*)?>/gi, '<$1th$2>')
      .replace(/&lt;(\/?)tbody(\s+[^>]*)?>/gi, '<$1tbody$2>')
      .replace(/&lt;(\/?)thead(\s+[^>]*)?>/gi, '<$1thead$2>')
      // Fix double-escaped entities
      .replace(/&amp;([a-z]+);/g, '&$1;');

    // Wrap in a root element if not already present to ensure valid XML
    // Use a special root tag that will be removed in post-processing
    // Include common Confluence namespaces to prevent namespace errors
    return sanitizedContent.trim().startsWith('<')
      ? `<confluence-root xmlns:ac="http://www.atlassian.com/schema/confluence/4/ac/" xmlns:ri="http://www.atlassian.com/schema/confluence/4/ri/">${sanitizedContent}</confluence-root>`
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

    // Special handling for tables - extract table structure
    if (element.nodeName.toLowerCase() === 'table') {
      return this.processTable(element);
    }

    // Process children and combine their output
    let output = '';
    for (let i = 0; i < element.childNodes.length; i++) {
      output += this.processNode(element.childNodes[i]);
    }

    return output;
  }

  /**
   * Process a table element and extract its structure
   * 
   * @param tableElement - The table element to process
   * @returns The processed table content
   */
  protected processTable(tableElement: Element): string {
    const tableData: string[][] = [];
    let hasHeader = false;

    log.debug('Processing table element');

    // Helper function to get elements by tag name from direct children
    const getDirectChildrenByTagName = (parent: Element, tagName: string): Element[] => {
      const children: Element[] = [];
      for (let i = 0; i < parent.childNodes.length; i++) {
        const child = parent.childNodes[i];
        if (child.nodeType === 1 && (child as Element).nodeName.toLowerCase() === tagName) {
          children.push(child as Element);
        }
      }
      return children;
    };

    // Get all child elements by tag name (works with xmldom)
    const getAllChildrenByTagName = (parent: Element, tagName: string): Element[] => {
      const elements: Element[] = [];
      const traverse = (node: Node) => {
        if (node.nodeType === 1) {
          const element = node as Element;
          if (element.nodeName.toLowerCase() === tagName) {
            elements.push(element);
          }
        }
        for (let i = 0; i < node.childNodes.length; i++) {
          traverse(node.childNodes[i]);
        }
      };
      traverse(parent);
      return elements;
    };

    // Process table body or direct rows
    const tbodyElements = getAllChildrenByTagName(tableElement, 'tbody');
    const theadElements = getAllChildrenByTagName(tableElement, 'thead');
    
    // Check if we have a table header
    if (theadElements.length > 0) {
      hasHeader = true;
      const thead = theadElements[0];
      const headerRows = getAllChildrenByTagName(thead, 'tr');
      log.debug(`Found ${headerRows.length} header rows`);
      
      for (let i = 0; i < headerRows.length; i++) {
        const row = this.processTableRow(headerRows[i]);
        if (row.length > 0) {
          tableData.push(row);
          log.debug(`Header row ${i}: ${row.length} columns`);
        }
      }
    }

    // Process table body rows
    let bodyRows: Element[] = [];
    if (tbodyElements.length > 0) {
      // Get rows from tbody
      bodyRows = getAllChildrenByTagName(tbodyElements[0], 'tr');
    } else {
      // Get direct tr children from table
      bodyRows = getAllChildrenByTagName(tableElement, 'tr');
    }
    
    log.debug(`Found ${bodyRows.length} body rows`);
    
    for (let i = 0; i < bodyRows.length; i++) {
      const row = this.processTableRow(bodyRows[i]);
      if (row.length > 0) {
        tableData.push(row);
        log.debug(`Body row ${i}: ${row.length} columns`);
      }
    }

    // If no header was found but we have rows, treat first row as header if it contains th elements
    if (!hasHeader && tableData.length > 0) {
      const firstRowElement = bodyRows[0];
      if (firstRowElement) {
        const thElements = getAllChildrenByTagName(firstRowElement, 'th');
        if (thElements.length > 0) {
          hasHeader = true;
          log.debug('Detected first row as header based on th elements');
        }
      }
    }

    log.debug(`Table processed: ${tableData.length} rows, hasHeader: ${hasHeader}`);
    return this.formatTable(tableData, hasHeader);
  }

  /**
   * Process a table row and extract cell contents
   * 
   * @param rowElement - The table row element
   * @returns Array of cell contents
   */
  protected processTableRow(rowElement: Element): string[] {
    const cells: string[] = [];
    
    // Get all child elements that are td or th
    const cellElements: Element[] = [];
    for (let i = 0; i < rowElement.childNodes.length; i++) {
      const child = rowElement.childNodes[i];
      if (child.nodeType === 1) { // Element node
        const element = child as Element;
        const tagName = element.nodeName.toLowerCase();
        if (tagName === 'td' || tagName === 'th') {
          cellElements.push(element);
        }
      }
    }
    
    for (let i = 0; i < cellElements.length; i++) {
      const cell = cellElements[i];
      let cellContent = '';
      
      // Process cell contents recursively
      for (let j = 0; j < cell.childNodes.length; j++) {
        cellContent += this.processNode(cell.childNodes[j]);
      }
      
      // Clean up cell content - remove excess whitespace and newlines
      // Handle nested elements that might introduce unwanted formatting
      cellContent = cellContent
        .replace(/\n+/g, ' ')           // Replace newlines with spaces
        .replace(/\s+/g, ' ')           // Collapse multiple spaces
        .replace(/^\s+|\s+$/g, '')      // Trim leading/trailing whitespace
        .replace(/\|\|/g, '|')          // Fix doubled pipe characters
        .replace(/\\\\/g, '\\');        // Fix doubled backslashes
      
      // Handle rowspan and colspan - add empty cells for merged columns
      const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
      const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10);
      
      cells.push(cellContent);
      
      // Add empty cells for colspan > 1
      for (let k = 1; k < colspan; k++) {
        cells.push('');
      }
      
      // Note: rowspan handling is more complex and would require 
      // tracking state across multiple rows. For now, we just process
      // the content in the current row and let the markdown processor
      // handle the display as best it can.
    }
    
    return cells;
  }

  /**
   * Format table data as the target format (should be overridden by specific processors)
   * 
   * @param tableData - 2D array of table cell contents
   * @param hasHeader - Whether the first row should be treated as a header
   * @returns Formatted table string
   */
  protected formatTable(tableData: string[][], hasHeader: boolean): string {
    // Default implementation - just return the content
    return tableData.map(row => row.join(' | ')).join('\n');
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
      
      // Check for parsing errors (like namespace issues)
      const parseError = doc.getElementsByTagName('parsererror')[0];
      if (parseError) {
        log.warn('XML parsing failed, trying HTML parsing mode');
        // Try parsing as HTML instead
        const htmlDoc = this.domParser.parseFromString(xmlContent, 'text/html');
        if (htmlDoc && htmlDoc.documentElement) {
          return this.processNode(htmlDoc.documentElement as any);
        }
      }
      
      // Process the DOM tree and convert to the desired format
      if (!doc.documentElement) {
        log.error('Failed to parse XML content - no document element found');
        return content;
      }
      
      return this.processNode(doc.documentElement as any);
    } catch (error) {
      log.error(`Error converting macros: ${(error as Error).message}`);
      // Try a fallback approach: strip namespaces and try again
      if ((error as Error).message.includes('namespace') || (error as Error).message.includes('Namespace')) {
        log.warn('Attempting namespace fallback parsing');
        try {
          const fallbackContent = this.stripNamespaces(content);
          const fallbackXml = this.prepareXmlContent(fallbackContent);
          const fallbackDoc = this.domParser.parseFromString(fallbackXml, 'text/xml');
          if (fallbackDoc && fallbackDoc.documentElement) {
            return this.processNode(fallbackDoc.documentElement as any);
          }
        } catch (fallbackError) {
          log.debug(`Fallback parsing also failed: ${(fallbackError as Error).message}`);
        }
      }
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

  /**
   * Strip XML namespaces from content as a fallback when namespace parsing fails
   * 
   * @param content - Content with XML namespaces
   * @returns Content with namespaces removed
   */
  private stripNamespaces(content: string): string {
    // Remove namespace declarations
    let result = content.replace(/\s+xmlns:[^=]+="[^"]*"/g, '');
    
    // Convert namespaced elements to simple elements (e.g., ac:structured-macro -> structured-macro)
    result = result.replace(/<\/?([a-zA-Z]+):([a-zA-Z0-9-]+)/g, '<$2');
    
    // Handle self-closing namespaced elements
    result = result.replace(/<([a-zA-Z]+):([a-zA-Z0-9-]+)([^>]*?)\/>/, '<$2$3/>');
    
    return result;
  }
}