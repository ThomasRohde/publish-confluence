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
 * Formats parameters for Handlebars output, excluding empty string values
 * 
 * @param params - Record of parameter key-value pairs
 * @returns Formatted parameters string for Handlebars template
 */
  private formatParameters(params: Record<string, string>): string {
    return Object.entries(params)
      .filter(([_, value]) => value !== '')
      .map(([key, value]) => {
        // For boolean values and numbers, don't use quotes
        if (value === 'true' || value === 'false' || /^\d+$/.test(value)) {
          return `${key}=${value}`;
        }
        // For strings, use quotes
        return `${key}="${value}"`;
      })
      .join(' ');
  }

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
    const bodyContent = this.extractMacroBody(macroElement);    // Handle different macro types with specific formatting
    switch (macroName.toLowerCase()) {      case 'code':
        const language = parameters.language || 'text';        // Format and indent code blocks properly
        let formattedCodeContent = bodyContent.replace(/\n/g, '\n  ');        // Checking for the 'handlebars' or 'hbs' language which might indicate intentional unescaped handlebar templates
        const isHandlebarsCode = ['handlebars', 'hbs'].includes(language.toLowerCase());        // Escape Handlebars syntax in code blocks, unless it's explicitly a Handlebars template
        if (!isHandlebarsCode) {
          formattedCodeContent = formattedCodeContent.replace(/(?<!\\)\{\{/g, '\\{{');
        }
        const codeParams = {
          language,
          title: parameters.title || '',
          linenumbers: parameters.linenumbers || 'false'
        };
        return `\n\n{{#confluence-code ${this.formatParameters(codeParams)}}}\n  ${formattedCodeContent}\n{{/confluence-code}}\n\n`;      case 'info':
        // Format info blocks with proper indentation
        const formattedInfoContent = bodyContent.replace(/\n/g, '\n  ');
        const infoParams = {
          title: parameters.title || ''
        };
        return `\n\n{{#confluence-info ${this.formatParameters(infoParams)}}}\n  ${formattedInfoContent}\n{{/confluence-info}}\n\n`;      case 'note':
        // Format note blocks with proper indentation
        const formattedNoteContent = bodyContent.replace(/\n/g, '\n  ');
        const noteParams = {
          title: parameters.title || ''
        };
        return `\n\n{{#confluence-note ${this.formatParameters(noteParams)}}}\n  ${formattedNoteContent}\n{{/confluence-note}}\n\n`;      case 'warning':
        // Format warning blocks with proper indentation
        const formattedWarningContent = bodyContent.replace(/\n/g, '\n  ');
        const warningParams = {
          title: parameters.title || ''
        };
        return `\n\n{{#confluence-warning ${this.formatParameters(warningParams)}}}\n  ${formattedWarningContent}\n{{/confluence-warning}}\n\n`;      case 'tip':
        // Format tip blocks with proper indentation
        const formattedTipContent = bodyContent.replace(/\n/g, '\n  ');
        const tipParams = {
          title: parameters.title || ''
        };
        return `\n\n{{#confluence-tip ${this.formatParameters(tipParams)}}}\n  ${formattedTipContent}\n{{/confluence-tip}}\n\n`;      case 'panel':
        // Format panel blocks with proper indentation
        const formattedPanelContent = bodyContent.replace(/\n/g, '\n  ');
        const panelParams = {
          title: parameters.title || ''
        };
        return `\n\n{{#confluence-panel ${this.formatParameters(panelParams)}}}\n  ${formattedPanelContent}\n{{/confluence-panel}}\n\n`;      case 'expand':
        const formattedExpandContent = bodyContent.replace(/\n/g, '\n  ');
        const expandParams = {
          title: parameters.title || ''
        };
        return `\n\n{{#confluence-expand ${this.formatParameters(expandParams)}}}\n  ${formattedExpandContent}\n{{/confluence-expand}}\n\n`;      case 'toc':
        const tocParams = {
          minLevel: parameters.minLevel || '1',
          maxLevel: parameters.maxLevel || '5'
        };
        return `\n\n{{confluence-toc ${this.formatParameters(tocParams)}}}\n\n`;

      case 'html':
        const formattedHtmlContent = bodyContent.replace(/\n/g, '\n  ');
        return `\n\n{{#confluence-html}}\n  ${formattedHtmlContent}\n{{/confluence-html}}\n\n`;      case 'children':
        const childrenParams = {
          sortBy: parameters.sort || '',
          reverse: parameters.reverse || 'false',
          includeLabels: parameters.labels || '',
          excludeLabels: parameters.excludeLabels || '',
          mode: parameters.mode || ''
        };
        return `\n\n{{confluence-children ${this.formatParameters(childrenParams)}}}\n\n`;      case 'status':
        const statusParams = {
          type: parameters.colour || parameters.color || 'neutral',
          text: parameters.title || ''
        };
        return `\n\n{{confluence-status ${this.formatParameters(statusParams)}}}\n\n`;      case 'anchor':
        const anchorParams = {
          name: parameters.name || ''
        };
        return `\n\n{{confluence-anchor ${this.formatParameters(anchorParams)}}}\n\n`;

      case 'tabs-group':
        // Process and format tabs content
        const formattedTabsContent = bodyContent.replace(/\n/g, '\n  ');
        const tabsParams = {
          disposition: parameters.disposition || 'horizontal',
          outline: parameters.outline || 'false',
          color: parameters.color || ''
        };
        return `\n\n{{#confluence-tabs ${this.formatParameters(tabsParams)}}}\n  ${formattedTabsContent}\n{{/confluence-tabs}}\n\n`;

      case 'tab-pane':
        // Process and format tab pane content
        const formattedTabContent = bodyContent.replace(/\n/g, '\n  ');
        const tabParams = {
          name: parameters.title || 'Tab',
          icon: parameters.icon || '',
          anchor: parameters.anchor || ''
        };
        return `\n\n{{#confluence-tab ${this.formatParameters(tabParams)}}}\n  ${formattedTabContent}\n{{/confluence-tab}}\n\n`;

      // For all other macros, use a partial
      default:
        return `\n\n{{> ${macroName}}}\n\n`;
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
   * Extract attributes from an HTML element
   * 
   * @param element - The element to extract attributes from
   * @returns Record of attribute name-value pairs
   */
  private extractElementAttributes(element: Element): Record<string, string> {
    const attributes: Record<string, string> = {};
    // Get all attributes from the element
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      const name = attr.name;
      const value = attr.value;
      
      // Skip ac: and xmlns: prefixed attributes - they're Confluence-specific
      if (!name.startsWith('ac:') && !name.startsWith('xmlns:')) {
        attributes[name] = value;
      }
    }
    
    return attributes;
  }

  /**
   * Process an HTML element node for Handlebars output
   * 
   * @param element - The Element node to process
   * @returns The processed content as a Handlebars-compatible string
   * @override
   */
  protected override processElementNode(element: Element): string {
    // Skip our special root element and just process its children
    if (element.nodeName === 'confluence-root') {
      let output = '';
      for (let i = 0; i < element.childNodes.length; i++) {
        output += this.processNode(element.childNodes[i]);
      }
      return output;
    }

    // Special handling for Confluence macros
    if (element.nodeName === 'ac:structured-macro') {
      const macroName = element.getAttribute('ac:name') || '';
      return this.processMacro(macroName, element);
    }    // Handle Confluence layout elements
    if (element.nodeName === 'ac:layout') {
      // Process children of the layout element
      let layoutContent = '';
      for (let i = 0; i < element.childNodes.length; i++) {
        layoutContent += this.processNode(element.childNodes[i]);
      }

      return `\n\n{{#confluence-layout}}\n  ${layoutContent}\n{{/confluence-layout}}\n\n`;
    }

    if (element.nodeName === 'ac:layout-section') {
      // Get the section type
      const sectionType = element.getAttribute('ac:type') || 'single';

      // Process children (layout cells)
      let sectionContent = '';
      for (let i = 0; i < element.childNodes.length; i++) {
        sectionContent += this.processNode(element.childNodes[i]);
      }

      // Indent the content and add newlines
      const indentedContent = sectionContent.split('\n').map(line => line ? '    ' + line : line).join('\n');

      const sectionParams = {
        type: sectionType
      };
      return `\n  {{#layout-section ${this.formatParameters(sectionParams)}}}\n${indentedContent}\n  {{/layout-section}}\n`;
    } if (element.nodeName === 'ac:layout-cell') {
      // Process cell content
      let cellContent = '';
      for (let i = 0; i < element.childNodes.length; i++) {
        cellContent += this.processNode(element.childNodes[i]);
      }

      // Indent the content and add newlines
      const indentedContent = cellContent.split('\n').map(line => line ? '      ' + line : line).join('\n');

      return `\n\n    {{#layout-cell}}\n${indentedContent}\n    {{/layout-cell}}\n\n`;
    }

    // Handle Confluence-specific tags
    if (element.nodeName === 'ac:image') {
      const attachmentNode = element.getElementsByTagName('ri:attachment')[0];
      if (attachmentNode) {
        const filename = attachmentNode.getAttribute('ri:filename') || '';
        const imageParams = {
          src: filename
        };
        return `{{confluence-image ${this.formatParameters(imageParams)}}}`;
      }
      return '';
    }    // Handle regular HTML elements
    const tagName = element.nodeName.toLowerCase();    // These elements can be preserved as-is in Handlebars
    const preserveTags = ['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'a', 'strong', 'em', 'code', 'pre'];

    if (preserveTags.includes(tagName)) {
      // Process children
      let innerContent = '';
      for (let i = 0; i < element.childNodes.length; i++) {
        innerContent += this.processNode(element.childNodes[i]);
      }
      
      // Extract attributes for this element
      const attributes = this.extractElementAttributes(element);
      const attributesString = Object.keys(attributes).length > 0 
        ? ' ' + Object.entries(attributes)
            .map(([key, value]) => `${key}="${value}"`)
            .join(' ')
        : '';

      // Escape Handlebars syntax in code and pre elements
      if (['code', 'pre'].includes(tagName)) {
        // Check for class attribute to see if this is explicitly marked as Handlebars code
        const classAttr = element.getAttribute('class') || '';
        const isHandlebarsCode = classAttr.includes('handlebars') || classAttr.includes('hbs');        
        // Only escape if not explicitly marked as Handlebars content
        if (!isHandlebarsCode) {
          // Use a direct single backslash instead of String.fromCharCode(92)
          innerContent = innerContent.replace(/(?<!\\)\{\{/g, '\\{{');
        }
      }

      // Add special formatting for heading elements
      if (tagName.startsWith('h') && tagName.length === 2) {
        // Add extra newlines around headings 
        return `\n\n<${tagName}${attributesString}>${innerContent}</${tagName}>\n`;
      }

      // Add special formatting for lists and tables
      if (['ul', 'ol', 'table'].includes(tagName)) {
        const formattedContent = innerContent.replace(/\n/g, '\n  ');
        return `\n<${tagName}${attributesString}>\n  ${formattedContent}\n</${tagName}>\n`;
      }

      // For simple elements with attributes, include the attributes
      return `<${tagName}${attributesString}>${innerContent}</${tagName}>`;
    }

    // For other elements, just process their children
    let output = '';
    for (let i = 0; i < element.childNodes.length; i++) {
      output += this.processNode(element.childNodes[i]);
    }

    return output;
  }

  /**
   * Escapes Handlebars syntax ({{ }}) in code blocks to prevent it from being interpreted as actual Handlebars code
   * 
   * @param content - The content to process
   * @returns Content with Handlebars syntax escaped in code blocks
   */  private escapeHandlebarsInCodeBlocks(content: string): string {    // Function to escape Handlebars syntax
    const escapeHandlebars = (match: string): string => {
      // Only escape double braces that aren't already escaped
      return match.replace(/(?<!\\)\{\{/g, '\\{{');
    };

    // Escape Handlebars syntax in code blocks (identified by confluence-code blocks)
    let result = content.replace(
      /(\{\{#confluence-code[^}]*\}\})([\s\S]*?)(\{\{\/confluence-code\}\})/g,
      (match, opening, codeContent, closing) => {
        return opening + escapeHandlebars(codeContent) + closing;
      }
    );

    // Also escape Handlebars syntax in pre and code tags
    result = result.replace(
      /(<pre[^>]*>)([\s\S]*?)(<\/pre>)/gi,
      (match, opening, content, closing) => {
        return opening + escapeHandlebars(content) + closing;
      }
    );

    result = result.replace(
      /(<code[^>]*>)([\s\S]*?)(<\/code>)/gi,
      (match, opening, content, closing) => {
        return opening + escapeHandlebars(content) + closing;
      }
    );

    return result;
  }
  /**
   * Process Confluence storage format content into a Handlebars template
   * 
   * @param content - The content in Confluence storage format
   * @param options - Processor-specific options
   * @returns A promise resolving to the processed content and metadata
   */  async process(content: string, options: PostProcessorOptions): Promise<ProcessorResult> {
    try {
      log.verbose(`Converting Confluence storage format to Handlebars template...`);      // Convert macros and process content
      let processedContent = this.convertConfluenceMacros(content);      // Apply prefix to macro names if specified
      let finalContent = options.macroPrefix
        ? processedContent.replace(/\{\{\s*>\s*(\w+)\s*\}\}/g, `{{> ${options.macroPrefix}$1}}`)
        : processedContent;

      // Remove the special root element tag
      finalContent = finalContent.replace(/<confluence-root>|<\/confluence-root>/g, '');

      // Remove extra div wrappers that might be present from Confluence storage format
      finalContent = finalContent.replace(/^<div>\s*/, '').replace(/\s*<\/div>$/, '');      // Clean up extra whitespace and normalize formatting
      finalContent = finalContent
        // Limit consecutive newlines to a maximum of 1
        .replace(/\n{2,}/g, '\n')
        // Fix spacing around Handlebars expressions to ensure only one newline
        .replace(/(\{\{[^}]+\}\})\n+(\{\{[^}]+\}\})/g, '$1\n$2')
        // Ensure proper spacing between layout cells (only one newline)
        .replace(/\}\}\n\s*\{\{#layout-cell/g, '}}\n    {{#layout-cell')
        // Clean up any trailing whitespace on lines
        .replace(/[ \t]+$/gm, '')
        // Ensure proper whitespace at beginning/end of document
        .trim() + '\n';

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
