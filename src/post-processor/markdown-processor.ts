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
    const bodyContent = this.extractMacroBody(macroElement);

    // Handle different macro types with specific Markdown formatting
    switch (macroName.toLowerCase()) {
      case 'code':
        const language = parameters.language || '';
        return `\`\`\`${language}\n${bodyContent}\n\`\`\``;

      case 'info':
        return `> ℹ️ **Info:** ${bodyContent}\n`;
      
      case 'note':
        return `> 📝 **Note:** ${bodyContent}\n`;
      
      case 'warning':
        return `> ⚠️ **Warning:** ${bodyContent}\n`;
      
      case 'tip':
        return `> 💡 **Tip:** ${bodyContent}\n`;

      case 'panel':
        const title = parameters.title ? `**${parameters.title}**\n\n` : '';
        return `---\n${title}${bodyContent}\n---\n`;

      // For more complex macros, use Handlebars syntax as a fallback
      default:
        return `<!-- {{> ${macroName}}} -->\n`;
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
   * Process an HTML element node for Markdown output
   * 
   * @param element - The Element node to process
   * @returns The processed content as a Markdown string
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
        return `![${filename}](${filename})`;
      }
      return '';
    }

    // Process children content first
    let innerContent = '';
    for (let i = 0; i < element.childNodes.length; i++) {
      innerContent += this.processNode(element.childNodes[i]);
    }

    // Handle regular HTML elements with Markdown equivalents
    const tagName = element.nodeName.toLowerCase();
    
    switch (tagName) {
      case 'h1': return `# ${innerContent}\n\n`;
      case 'h2': return `## ${innerContent}\n\n`;
      case 'h3': return `### ${innerContent}\n\n`;
      case 'h4': return `#### ${innerContent}\n\n`;
      case 'h5': return `##### ${innerContent}\n\n`;
      case 'h6': return `###### ${innerContent}\n\n`;
      
      case 'p': return `${innerContent}\n\n`;
      case 'br': return '\n';
      
      case 'strong':
      case 'b': return `**${innerContent}**`;
      
      case 'em':
      case 'i': return `*${innerContent}*`;
      
      case 'code': return `\`${innerContent}\``;
      case 'pre': return `\`\`\`\n${innerContent}\n\`\`\`\n\n`;
      
      case 'a': {
        const href = element.getAttribute('href') || '';
        return `[${innerContent}](${href})`;
      }
      
      case 'ul': return `${innerContent}\n`;
      case 'ol': return `${innerContent}\n`;
      case 'li': return `- ${innerContent}\n`;
      
      case 'table': return `\n${innerContent}\n`;
      case 'tr': return `${innerContent}|\n`;
      case 'th': return `| ${innerContent} `;
      case 'td': return `| ${innerContent} `;
      
      // For other elements or those with complex attributes, 
      // just return the inner content
      default: return innerContent;
    }
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
      // Fix multiple consecutive newlines
      .replace(/\n{3,}/g, '\n\n')
      // Fix table formatting
      .replace(/\|\n\|/g, '|\n|')
      // Add table headers when needed
      .replace(/(\n\|[^\n]+\|)\n\|/g, (match, header) => {
        const columns = (header.match(/\|/g) || []).length - 1;
        const separator = '|' + ' --- |'.repeat(columns) + '\n';
        return `${header}\n${separator}|`;
      })
      // Trim trailing whitespace on lines
      .replace(/[ \t]+$/gm, '');
  }
}
