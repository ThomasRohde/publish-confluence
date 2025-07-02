// src/post-processor/markdown-processor.ts
import { createLogger } from '../logger';
import { BasePostProcessor } from './base-processor';
import { PostProcessorOptions, ProcessorResult } from './types';

const log = createLogger();

/**
 * Processor that converts Confluence storage format to Markdown
 */
export class MarkdownProcessor extends BasePostProcessor {
  /** The name of the processor */
  readonly name = 'markdown';
  
  /** The default file extension for output files */
  readonly outputExtension = 'md';

  /**
   * Normalizes text for Markdown output by properly handling whitespace
   * 
   * @param text - The text to normalize
   * @param preserveIndentation - Whether to preserve intentional indentation (for code blocks, etc.)
   * @returns Normalized text for markdown output
   */
  private normalizeText(text: string, preserveIndentation = false): string {
    if (!text) return '';

    if (preserveIndentation) {
      // For code blocks, we preserve all formatting
      return text;
    } else {
      // For normal text, we normalize whitespace
      // 1. Trim all lines
      // 2. Replace consecutive spaces with a single space
      // 3. Preserve paragraph breaks (double newlines)
      return text
        .split('\n')
        .map(line => line.trim())
        .join('\n')
        .replace(/ {2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n');
    }
  }

  /**
   * Process a Confluence macro element specifically for Markdown output
   * 
   * @param macroName - The name of the macro
   * @param macroElement - The macro element
   * @returns The processed macro as Markdown
   * @override
   */
  protected override processMacro(macroName: string, macroElement: Element): string {
    // Extract macro parameters
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
    const bodyContent = this.normalizeText(this.extractMacroBody(macroElement));    // Handle different macro types with specific Markdown formatting
    switch (macroName.toLowerCase()) {
      // Code block with syntax highlighting
      case 'code':
        const language = parameters.language || '';
        const title = parameters.title ? `${parameters.title}\n` : '';
        return `${title}\`\`\`${language}\n${bodyContent}\n\`\`\`\n`;

      // HTML macro for embedding HTML content
      case 'html':
        return `<div class="confluence-html-macro">\n${bodyContent}\n</div>\n`;

      // Admonition blocks
      case 'info':
        const infoTitle = parameters.title || 'Info';
        return `> ℹ️ **${infoTitle}:** ${bodyContent}\n`;
      
      case 'note':
        const noteTitle = parameters.title || 'Note';
        return `> 📝 **${noteTitle}:** ${bodyContent}\n`;
      
      case 'warning':
        const warnTitle = parameters.title || 'Warning';
        return `> ⚠️ **${warnTitle}:** ${bodyContent}\n`;
      
      case 'tip':
        const tipTitle = parameters.title || 'Tip';
        return `> 💡 **${tipTitle}:** ${bodyContent}\n`;

      // Panel with optional styling
      case 'panel':
        const panelTitle = parameters.title ? `**${parameters.title}**\n\n` : '';
        const borderStyle = parameters.borderStyle ? `Border: ${parameters.borderStyle}` : '';
        const borderColor = parameters.borderColor ? `Color: ${parameters.borderColor}` : '';
        const bgColor = parameters.bgColor ? `Background: ${parameters.bgColor}` : '';
        
        let panelInfo = [borderStyle, borderColor, bgColor].filter(Boolean).join(', ');
        if (panelInfo) {
          panelInfo = ` (${panelInfo})`;
        }
        
        return `---${panelInfo}\n${panelTitle}${bodyContent}\n---\n`;

      // Table of contents
      case 'toc':
        const minLevel = parameters.minLevel || '1';
        const maxLevel = parameters.maxLevel || '6';
        return `<!-- Table of Contents (${minLevel}-${maxLevel}) -->\n\n`;

      // Status indicator
      case 'status':
        const color = parameters.colour || '';
        const statusText = parameters.title || color || 'Status';
        return `[${statusText}]`;
      
      // Children display
      case 'children':
        const sortBy = parameters.sort ? `Sort by: ${parameters.sort}` : '';
        const reverse = parameters.reverse === 'true' ? 'Reversed' : '';
        const childInfo = [sortBy, reverse].filter(Boolean).join(', ');
        
        return `<!-- Child Pages List${childInfo ? ` (${childInfo})` : ''} -->\n\n`;
      
      // Tabs group and tab panes (Vector)
      case 'tabs-group':
        const disposition = parameters.disposition || 'horizontal';
        return `## Tabs (${disposition})\n\n${bodyContent}\n`;
      
      case 'tab-pane':
        const tabName = parameters.name || 'Tab';
        const icon = parameters.icon ? `(${parameters.icon}) ` : '';
        return `### ${icon}${tabName}\n\n${bodyContent}\n`;

      // Layout structure
      case 'layout':
        return `${bodyContent}\n`;
      
      case 'layout-section':
        const sectionType = parameters.type ? `[Layout: ${parameters.type}]\n` : '';
        return `${sectionType}${bodyContent}\n`;
      
      case 'layout-cell':
        return `${bodyContent}\n\n`;

      // Expand/Collapse macro
      case 'expand':
        const expandTitle = parameters.title || 'Click to expand';
        return `<details>\n<summary>${expandTitle}</summary>\n\n${bodyContent}\n</details>\n\n`;

      // Anchor macro
      case 'anchor':
        // Find the first parameter which is the anchor name (might not have ac:name attribute)
        let anchorName = '';
        for (let i = 0; i < parameterNodes.length; i++) {
          const param = parameterNodes[i];
          if (!param.getAttribute('ac:name') || param.getAttribute('ac:name') === '') {
            anchorName = param.textContent || '';
            break;
          }
        }
        
        return anchorName ? `<a id="${anchorName}"></a>\n\n` : '';
      
      // Date macro
      case 'date':
        // The date is stored directly in the datetime attribute in the actual content
        return `[Date: ${parameters.date || 'current'}]`;

      // For unsupported or complex macros, use HTML comment with the macro name
      default:
        if (bodyContent) {
          return `<!-- Confluence ${macroName} macro -->\n${bodyContent}\n<!-- End ${macroName} macro -->\n`;
        } else {
          return `<!-- Confluence ${macroName} macro -->\n`;
        }
    }
  }

  /**
   * Extract the body content of a macro element
   * 
   * @param macroElement - The macro element
   * @returns The body content as a string
   */  private extractMacroBody(macroElement: Element): string {
    // Determine if this is a code-like macro that should preserve formatting
    const macroName = macroElement.getAttribute('ac:name')?.toLowerCase() || '';
    const preserveFormatting = macroName === 'code' || macroName === 'codeblock' || macroName === 'pre';
    
    // Try to find rich text body first (formatted content)
    const richBodyNode = macroElement.getElementsByTagName('ac:rich-text-body')[0];
    if (richBodyNode) {
      const content = this.processNode(richBodyNode);
      return preserveFormatting ? content : this.normalizeText(content);
    }
    
    // If no rich text body, try plain text body (unformatted content)
    const plainBodyNode = macroElement.getElementsByTagName('ac:plain-text-body')[0];
    if (plainBodyNode) {
      // Plain text body might be wrapped in CDATA section
      const content = plainBodyNode.textContent || '';
      return preserveFormatting ? content.trim() : this.normalizeText(content);
    }
    
    // If neither is found, look for content parameter which some macros use
    const contentParam = Array.from(macroElement.getElementsByTagName('ac:parameter'))
      .find(param => param.getAttribute('ac:name') === 'content');
    
    if (contentParam) {
      const content = contentParam.textContent || '';
      return preserveFormatting ? content : this.normalizeText(content);
    }
    
    return '';
  }

  /**
   * Process an HTML element node for Markdown output
   * 
   * @param element - The Element node to process
   * @returns The processed content as a Markdown string
   * @override
   */  /**
   * Extract the body content of a link element
   * 
   * @param linkElement - The link element
   * @returns The body content as a string
   */  private extractLinkBody(linkElement: Element): string {
    // Try rich link body first
    const linkBody = linkElement.getElementsByTagName('ac:link-body')[0];
    if (linkBody) {
      return this.normalizeText(this.processNode(linkBody));
    }
    
    // Then try plain text link body
    const plainTextLinkBody = linkElement.getElementsByTagName('ac:plain-text-link-body')[0];
    if (plainTextLinkBody) {
      return this.normalizeText(plainTextLinkBody.textContent || '');
    }
    
    return '';
  }
  protected override processElementNode(element: Element): string {
    const nodeName = element.nodeName.toLowerCase();
    
    // Handle Confluence macros
    if (nodeName === 'ac:structured-macro') {
      const macroName = element.getAttribute('ac:name') || '';
      return this.processMacro(macroName, element);
    }
    
    // Handle tables - let the base class handle the table structure
    if (nodeName === 'table') {
      return this.processTable(element);
    }
    
    // Handle Confluence images
    if (nodeName === 'ac:image') {
      // Try to get attachment reference
      const attachmentNode = element.getElementsByTagName('ri:attachment')[0];
      if (attachmentNode) {
        const filename = attachmentNode.getAttribute('ri:filename') || '';
        const altText = element.getAttribute('ac:alt') || filename;
        return `![${this.normalizeText(altText)}](${filename})`;
      }
      
      // Try URL reference if there's no attachment
      const urlNode = element.getElementsByTagName('ri:url')[0];
      if (urlNode) {
        const url = urlNode.getAttribute('ri:value') || '';
        return `![Image](${url})`;
      }
      
      return '';
    }
    
    // Handle Confluence links
    if (nodeName === 'ac:link') {
      const linkBody = this.extractLinkBody(element);
      
      // Link to another page
      const pageNode = element.getElementsByTagName('ri:page')[0];
      if (pageNode) {
        const pageTitle = pageNode.getAttribute('ri:content-title') || '';
        const spaceKey = pageNode.getAttribute('ri:space-key') || '';
        const anchor = element.getAttribute('ac:anchor') || '';
        
        let linkText = linkBody || pageTitle;
        let target = pageTitle;
        
        if (spaceKey) {
          target = `${spaceKey}:${target}`;
        }
        
        if (anchor) {
          target = `${target}#${anchor}`;
        }
        
        return `[${linkText}](${target})`;
      }
      
      // Link to an attachment
      const attachmentNode = element.getElementsByTagName('ri:attachment')[0];
      if (attachmentNode) {
        const filename = attachmentNode.getAttribute('ri:filename') || '';
        return `[${linkBody || filename}](${filename})`;
      }
      
      // Link with external URL
      const urlNode = element.getElementsByTagName('ri:url')[0];
      if (urlNode) {
        const url = urlNode.getAttribute('ri:value') || '';
        return `[${linkBody || url}](${url})`;
      }
    }
    
    // Handle task lists
    if (nodeName === 'ac:task-list') {
      let taskListContent = '\n';
      const tasks = element.getElementsByTagName('ac:task');
      
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const statusNode = task.getElementsByTagName('ac:task-status')[0];
        const bodyNode = task.getElementsByTagName('ac:task-body')[0];
        
        const isComplete = statusNode && statusNode.textContent === 'complete';
        const taskBody = bodyNode ? this.processNode(bodyNode) : '';
        
        taskListContent += isComplete ? 
          `- [x] ${taskBody}\n` : 
          `- [ ] ${taskBody}\n`;
      }
      
      return taskListContent;
    }
    
    // Handle emoticons
    if (nodeName === 'ac:emoticon') {
      const name = element.getAttribute('ac:name') || '';
      
      // Map Confluence emoticon names to emoji or text equivalents
      const emoticons: Record<string, string> = {
        'smile': ':smile:',
        'sad': ':frowning:',
        'cheeky': ':stuck_out_tongue:',
        'laugh': ':grin:',
        'wink': ':wink:',
        'thumbs-up': ':+1:',
        'thumbs-down': ':-1:',
        'information': ':information_source:',
        'tick': ':white_check_mark:',
        'cross': ':x:',
        'warning': ':warning:'
      };
      
      return emoticons[name] || `(${name})`;
    }    // Process children content first
    let innerContent = '';
    for (let i = 0; i < element.childNodes.length; i++) {
      innerContent += this.processNode(element.childNodes[i]);
    }

    // Handle regular HTML elements with Markdown equivalents
    const tagName = element.nodeName.toLowerCase();
    
    switch (tagName) {
      case 'h1': return `# ${this.normalizeText(innerContent)}\n\n`;
      case 'h2': return `## ${this.normalizeText(innerContent)}\n\n`;
      case 'h3': return `### ${this.normalizeText(innerContent)}\n\n`;
      case 'h4': return `#### ${this.normalizeText(innerContent)}\n\n`;
      case 'h5': return `##### ${this.normalizeText(innerContent)}\n\n`;
      case 'h6': return `###### ${this.normalizeText(innerContent)}\n\n`;
      
      case 'p': return `${this.normalizeText(innerContent)}\n\n`;
      case 'br': return '\n';
      
      case 'strong':
      case 'b': return `**${this.normalizeText(innerContent)}**`;
      
      case 'em':
      case 'i': return `*${this.normalizeText(innerContent)}*`;
      
      case 'code': return `\`${innerContent}\``; // Preserve spacing in inline code
      case 'pre': return `\`\`\`\n${innerContent}\n\`\`\`\n\n`; // Preserve spacing in code blocks
      
      case 'a': {
        const href = element.getAttribute('href') || '';
        return `[${this.normalizeText(innerContent)}](${href})`;
      }        case 'ul': return `${innerContent}\n`;
      case 'ol': return `${innerContent}\n`;
      case 'li': {
        // Check if parent is an ordered list to use numbers instead of bullets
        const parentNode = element.parentNode;
        if (parentNode && parentNode.nodeName.toLowerCase() === 'ol') {
          return `1. ${this.normalizeText(innerContent)}\n`; // Markdown will auto-number regardless of the actual number used
        }
        return `- ${this.normalizeText(innerContent)}\n`;
      }
      
      // Table elements inside table structure are handled by base class processTable method
      // These cases are for when table elements appear outside of proper table structure
      case 'tbody':
      case 'thead':
      case 'tr':
      case 'th':
      case 'td':
        // If we reach here, these elements are not within a proper table structure
        // Just return the inner content
        return this.normalizeText(innerContent);
      
      // For other elements or those with complex attributes, 
      // just return the inner content
      default: return this.normalizeText(innerContent);
    }
  }

  /**
   * Format table data as Markdown table
   * 
   * @param tableData - 2D array of table cell contents
   * @param hasHeader - Whether the first row should be treated as a header
   * @returns Formatted Markdown table string
   * @override
   */
  protected override formatTable(tableData: string[][], hasHeader: boolean): string {
    if (tableData.length === 0) {
      log.warn('Empty table data received');
      return '\n<!-- Empty table -->\n';
    }

    let result = '\n';
    
    // Determine the maximum number of columns
    const maxColumns = Math.max(...tableData.map(row => row.length));
    log.debug(`Formatting table with ${tableData.length} rows and ${maxColumns} columns`);
    
    // Ensure all rows have the same number of columns
    const normalizedData = tableData.map((row, index) => {
      const normalizedRow = [...row];
      while (normalizedRow.length < maxColumns) {
        normalizedRow.push('');
      }
      
      // Log any rows that were padded
      if (normalizedRow.length !== row.length) {
        log.debug(`Padded row ${index} from ${row.length} to ${normalizedRow.length} columns`);
      }
      
      return normalizedRow;
    });

    // If we don't have a header but have data, treat first row as header for better Markdown table formatting
    if (!hasHeader && normalizedData.length > 0) {
      hasHeader = true;
      log.debug('Treating first row as header for Markdown table formatting');
    }

    // Process each row
    for (let rowIndex = 0; rowIndex < normalizedData.length; rowIndex++) {
      const row = normalizedData[rowIndex];
      
      // Format row - escape pipes and clean up cell content
      const formattedCells = row.map((cell, cellIndex) => {
        try {
          // Additional cell content cleaning for Markdown
          let cleanCell = this.normalizeText(cell)
            .replace(/\|/g, '\\|')        // Escape pipes in cell content
            .replace(/\r?\n/g, ' ')       // Replace any remaining newlines with spaces
            .replace(/\s+/g, ' ')         // Collapse multiple spaces
            .trim();                      // Trim whitespace
          
          // Handle empty cells
          if (!cleanCell) {
            cleanCell = ' ';
          }
          
          return cleanCell;
        } catch (error) {
          log.warn(`Error processing cell [${rowIndex}][${cellIndex}]: ${(error as Error).message}`);
          return ' '; // Return empty cell on error
        }
      });
      
      result += '| ' + formattedCells.join(' | ') + ' |\n';
      
      // Add header separator after first row if it's a header
      if (rowIndex === 0 && hasHeader) {
        result += '|' + ' --- |'.repeat(maxColumns) + '\n';
      }
    }
    
    result += '\n';
    log.debug(`Generated Markdown table with ${normalizedData.length} rows`);
    return result;
  }

  /**
   * Process Confluence storage format content into Markdown
   * 
   * @param content - The content in Confluence storage format
   * @param options - Processor-specific options
   * @returns A promise resolving to the processed content and metadata
   */
  async process(content: string, options: PostProcessorOptions): Promise<ProcessorResult> {
    try {
      log.verbose(`Converting Confluence storage format to Markdown...`);
      
      // Convert macros and process content
      const processedContent = this.convertConfluenceMacros(content);
      
      // Post-process Markdown for better formatting
      const finalContent = this.cleanupMarkdown(processedContent);

      return {
        content: finalContent,
        outputExtension: this.outputExtension,
        metadata: {
          originalTitle: options.pageTitle
        }
      };
    } catch (error) {
      log.error(`Error processing content with Markdown processor: ${(error as Error).message}`);
      log.debug((error as Error).stack || 'No stack trace available');
      
      // Return original content on error
      return {
        content,
        outputExtension: 'html'
      };
    }
  }

  /**
   * Clean up the generated Markdown for better formatting
   * 
   * @param markdown - The raw Markdown content
   * @returns Cleaned up Markdown
   */
  private cleanupMarkdown(markdown: string): string {
    return markdown
      // Remove old table cleanup patterns since we now handle tables properly
      // Fix list formatting - ensure proper spacing between list items and following paragraphs
      .replace(/(\n- .+)\n([^\n-])/g, '$1\n\n$2')
      .replace(/(\n\d+\. .+)\n([^\n\d])/g, '$1\n\n$2')
      // Fix nested list indentation
      .replace(/\n(- .+)\n([ \t]+- )/g, '\n$1\n\n$2')
      // Fix code block spacing
      .replace(/(```.*\n[\s\S]*?```)\n([^\n])/g, '$1\n\n$2')
      // Ensure headings have space after them
      .replace(/^(#{1,6} .+)\n([^\n])/gm, '$1\n\n$2')
      // Remove duplicate newlines (we still need this as a final pass)
      .replace(/\n{3,}/g, '\n\n')
      // Trim trailing whitespace on lines (this is still useful)
      .replace(/[ \t]+$/gm, '');
  }
}
