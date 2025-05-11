// filepath: c:\Users\E29667\GitHub\publish-confluence\src\local-preview-converter.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfluenceConverter } from './confluence-converter';
import { createLogger } from './logger';

const log = createLogger();

/**
 * Extends the ConfluenceConverter with functionality specifically for local preview
 */
export class LocalPreviewConverter {  /**
   * Converts content for local preview, handling {{{scripts}}} and {{{styles}}} placeholders
   * @param content The page content
   * @param attachmentBaseUrl Base URL for attachment references
   * @param pageId The page ID
   * @param spaceKey The space key
   * @returns The converted content
   */
  static async convertForPreview(
    content: string, 
    attachmentBaseUrl: string, 
    pageId: string,
    spaceKey: string
  ): Promise<string> {
    try {
      // First use the standard converter to handle Confluence markup
      let convertedContent = ConfluenceConverter.convertStorageToHtml(content, attachmentBaseUrl);
      
      // Remove any Confluence server URLs and replace with local URLs
      // This regex matches URLs like https://dry-run.confluence.example.com/download/attachments/PAGE-ID/file.ext
      const confluenceUrlPattern = /(https?:\/\/[^\/]+\/download\/attachments\/[^\/]+\/[^"']+)/g;
      convertedContent = convertedContent.replace(confluenceUrlPattern, (match) => {
        // Extract the filename from the Confluence URL
        const filename = match.split('/').pop()?.split('?')[0];
        if (!filename) return match;
        
        // Create local file path
        return `${attachmentBaseUrl}/${filename}`;
      });
      
      // Extract the directory path from the attachment base URL
      // For preview environment, attachmentBaseUrl is something like './attachments/pageId'
      // We need to find the actual filesystem path to scan for files
      const attachmentsDir = path.resolve(process.cwd(), 'preview', spaceKey, 'attachments', pageId);
      
      // Process the placeholders
      if (content.includes('{{{styles}}}')) {
        const styleLinks = await LocalPreviewConverter.generateStyleLinks(attachmentBaseUrl, pageId, attachmentsDir);
        convertedContent = convertedContent.replace('{{{styles}}}', styleLinks);
      }
      
      if (content.includes('{{{scripts}}}')) {
        const scriptTags = await LocalPreviewConverter.generateScriptTags(attachmentBaseUrl, pageId, attachmentsDir);
        convertedContent = convertedContent.replace('{{{scripts}}}', scriptTags);
      }
      
      return convertedContent;
    } catch (error) {
      log.warn(`[DRY-RUN] Error processing content for preview: ${(error as Error).message}`);
      return content;
    }
  }
  
  /**
   * Generates style links for CSS files in attachments
   * @param attachmentBaseUrl Base URL for attachment references
   * @param pageId The page ID
   * @param attachmentsDir The filesystem directory where attachments are stored
   * @returns HTML string with style links
   */
  private static async generateStyleLinks(
    attachmentBaseUrl: string, 
    pageId: string,
    attachmentsDir: string
  ): Promise<string> {
    let styleLinks = '<!-- Automatically generated CSS links for preview -->\n';
    
    try {
      // Check if the directory exists
      await fs.access(attachmentsDir);
      
      // Get all files in the directory
      const files = await fs.readdir(attachmentsDir);
      
      // Filter for CSS files
      const cssFiles = files.filter(file => 
        file.toLowerCase().endsWith('.css') || 
        file.toLowerCase().includes('.css.')
      );
        // Add a link tag for each CSS file
      for (const cssFile of cssFiles) {
        styleLinks += `<link rel="stylesheet" href="${attachmentBaseUrl}/${cssFile}">\n`;
      }
      
      // If no CSS files were found, add a comment
      if (cssFiles.length === 0) {
        styleLinks += '<!-- No CSS files found in attachments -->\n';
      }
    } catch (error) {
      log.debug(`[DRY-RUN] Error finding CSS files: ${(error as Error).message}`);
      styleLinks += '<!-- Error finding CSS files in attachments -->\n';
    }
    
    return styleLinks;
  }
  
  /**
   * Generates script tags for JS files in attachments
   * @param attachmentBaseUrl Base URL for attachment references
   * @param pageId The page ID
   * @param attachmentsDir The filesystem directory where attachments are stored
   * @returns HTML string with script tags
   */
  private static async generateScriptTags(
    attachmentBaseUrl: string, 
    pageId: string,
    attachmentsDir: string
  ): Promise<string> {
    let scriptTags = '<!-- Automatically generated script tags for preview -->\n';
    
    try {
      // Check if the directory exists
      await fs.access(attachmentsDir);
      
      // Get all files in the directory
      const files = await fs.readdir(attachmentsDir);
      
      // Filter for JavaScript files
      const jsFiles = files.filter(file => 
        file.toLowerCase().endsWith('.js') || 
        file.toLowerCase().includes('.js.')
      );
        // Add a script tag for each JS file
      for (const jsFile of jsFiles) {
        scriptTags += `<script src="${attachmentBaseUrl}/${jsFile}"></script>\n`;
      }
      
      // If no JS files were found, add a comment
      if (jsFiles.length === 0) {
        scriptTags += '<!-- No JavaScript files found in attachments -->\n';
      }
    } catch (error) {
      log.debug(`[DRY-RUN] Error finding JavaScript files: ${(error as Error).message}`);
      scriptTags += '<!-- Error finding JavaScript files in attachments -->\n';
    }
    
    return scriptTags;
  }
}
