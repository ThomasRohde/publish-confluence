// src/dry-run-preview.ts
import * as fs from 'fs/promises';
import Handlebars from 'handlebars';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ConfluenceConverter } from './confluence-converter';
import { DryRunContext } from './dry-run';
import { createLogger } from './logger';

// Initialize logger
const log = createLogger();

// Get the directory name in ESM context
const getDirname = () => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    return path.dirname(__filename);
  } catch (error) {
    return process.cwd();
  }
};

/**
 * Interface for a page in the preview
 */
interface PreviewPage {
  id: string;
  title: string;
  isActive?: boolean;
  children: PreviewPage[];
}

/**
 * Interface for a space in the preview
 */
interface PreviewSpace {
  key: string;
  pages: PreviewPage[];
}

/**
 * Interface for the spaces data used in the index.html
 */
interface SpacesData {
  spaces: PreviewSpace[];
}

/**
 * Interface for the page data used in the preview.hbs template
 */
interface PageData {
  id: string;
  title: string;
  spaceKey: string;
  version: number;
  content: string;
  attachments: Array<{
    name: string;
    path: string;
    size: string;
  }>;
  spaces: PreviewSpace[];
}

/**
 * Generates HTML preview files for all pages in the dry-run context
 * @param context The dry-run context
 * @returns The path to the index.html file
 */
export async function generatePreview(context: DryRunContext): Promise<string> {
  try {
    log.info('[DRY-RUN] Generating HTML preview...');
    
    // Create the preview directory
    const previewDir = path.join(context.baseDir, 'preview');
    await fs.mkdir(previewDir, { recursive: true });
    
    // Copy template files
    await copyTemplateFiles(previewDir);
    
    // Create space directories
    const spacesDir = path.join(context.baseDir, 'spaces');
    const spaces = await fs.readdir(spacesDir);
    
    // Initialize spaces data
    const spacesData: SpacesData = {
      spaces: []
    };
    
    // Process each space
    for (const spaceKey of spaces) {
      const spaceDir = path.join(spacesDir, spaceKey);
      const spacePreviewDir = path.join(previewDir, spaceKey);
      await fs.mkdir(spacePreviewDir, { recursive: true });
      
      // Get all pages in this space
      const pageTree = await buildPageTree(spaceDir, spaceKey);
      
      // Add to spaces data
      spacesData.spaces.push({
        key: spaceKey,
        pages: pageTree
      });
      
      // Generate preview for each page
      await generatePagesForSpace(context, spaceDir, spacePreviewDir, spaceKey, pageTree, spacesData);
    }
    
    // Write spaces data to JSON file
    await fs.writeFile(
      path.join(previewDir, 'spacesData.json'),
      JSON.stringify(spacesData, null, 2)
    );
    
    const indexHtmlPath = path.join(previewDir, 'index.html');
    log.info(`[DRY-RUN] Preview generated successfully. Open ${indexHtmlPath} to view.`);
    
    return indexHtmlPath;
  } catch (error) {
    log.error(`[DRY-RUN] Failed to generate preview: ${(error as Error).message}`);
    throw new Error(`Failed to generate preview: ${(error as Error).message}`);
  }
}

/**
 * Copies template files to the preview directory
 * @param previewDir The preview directory
 */
async function copyTemplateFiles(previewDir: string): Promise<void> {
  try {    
    // In development mode (running with tsx), template paths are relative to src
    // In production (built with vite), they're in dist/templates
    const isProduction = !process.argv[0].includes('tsx');
    const dirname = getDirname(); // Use the getDirname helper consistently
    
    // We'll try multiple template locations in order
    const templateLocations = [
      // Primary locations based on environment
      isProduction
        ? path.resolve(path.dirname(process.argv[1]), 'templates')  // dist/templates
        : path.resolve(process.cwd(), 'src', 'templates'),          // src/templates
      
      // Alternative locations to try as fallbacks
      path.resolve(process.cwd(), 'dist', 'templates'),             // Project root dist/templates
      path.resolve(process.cwd(), 'src', 'templates'),              // Project root src/templates
      path.resolve(dirname, '..', 'templates'),                     // Relative to this file
      path.resolve(dirname, 'templates')                            // Direct templates subdirectory
    ];
    
    // Add this after initializing templateLocations
    log.debug(`[DRY-RUN] Looking for templates in the following locations:`);
    templateLocations.forEach(location => {
      log.debug(`[DRY-RUN] - ${location}`);
    });
    
    // Try each location until we find the template files
    let templatesFound = false;
    let templateDir = '';
    
    for (const location of templateLocations) {
      try {
        // Check if the directory exists and contains index.html
        const indexHtmlPath = path.resolve(location, 'index.html');
        await fs.access(indexHtmlPath);
        
        // Found a valid template directory
        templateDir = location;
        templatesFound = true;
        log.info(`[DRY-RUN] Found templates in: ${location}`);
        break;
      } catch (error) {
        // Try the next location
        log.debug(`[DRY-RUN] Templates not found in: ${location}`);
      }
    }
    
    // Copy index.html
    try {
      if (!templatesFound) {
        throw new Error("No template directory found after checking multiple locations");
      }
      
      const indexHtmlPath = path.resolve(templateDir, 'index.html');
      const indexHtmlContent = await fs.readFile(indexHtmlPath, 'utf8');
      await fs.writeFile(path.join(previewDir, 'index.html'), indexHtmlContent);
      log.verbose(`[DRY-RUN] Copied index.html from ${indexHtmlPath}`);
    } catch (error) {
      log.warn(`[DRY-RUN] Failed to copy index.html: ${(error as Error).message}`);
      // Try alternative location
      const altTemplatePath = path.resolve(process.cwd(), 'dist', 'templates', 'index.html');
      try {
        const indexHtmlContent = await fs.readFile(altTemplatePath, 'utf8');
        await fs.writeFile(path.join(previewDir, 'index.html'), indexHtmlContent);
        log.verbose(`[DRY-RUN] Copied index.html from alternative location: ${altTemplatePath}`);
      } catch {
        // Will fall back to creating a simple template
        throw error;
      }
    }
    
    log.verbose('[DRY-RUN] Copied template files to preview directory');
  } catch (error) {
    log.warn(`[DRY-RUN] Failed to copy template files: ${(error as Error).message}`);
    
    // Create a simple index.html if templates aren't available
    const simpleIndexHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Confluence Preview</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #0052CC; }
        </style>
      </head>
      <body>
        <h1>Confluence Preview</h1>
        <p>This is a preview of your Confluence pages.</p>
        <p>Note: Template files couldn't be loaded. Using simplified view.</p>
        <div id="content">Loading...</div>
        <script>          fetch('spacesData.json')
            .then(response => response.json())
            .then(data => {
              let html = '<h2>Spaces</h2>';
              data.spaces.forEach(space => {
                html += \`<h3>\${space.key}</h3><ul>\`;
                space.pages.forEach(page => {
                  // Use a more URL-safe filename approach by replacing problematic characters
                  const safeFilename = page.title.replace(/[^a-zA-Z0-9-_.]/g, '_');
                  html += \`<li><a href="\${space.key}/\${safeFilename}.html">\${page.title}</a></li>\`;
                });
                html += '</ul>';
              });
              document.getElementById('content').innerHTML = html;
            })
            .catch(error => {
              document.getElementById('content').innerHTML = 
                \`<p style="color: red">Error loading data: \${error.message}</p>\`;
            });
        </script>
      </body>
      </html>
    `;
    
    await fs.writeFile(path.join(previewDir, 'index.html'), simpleIndexHtml);
  }
}

/**
 * Builds a page tree for a space
 * @param spaceDir The space directory
 * @param spaceKey The space key
 * @returns A tree of pages in the space
 */
async function buildPageTree(spaceDir: string, spaceKey: string): Promise<PreviewPage[]> {
  // Get all page directories
  const pages = await getAllPages(spaceDir);
  
  log.debug(`[DRY-RUN] Found ${pages.length} pages in space ${spaceKey}`);
  pages.forEach(page => {
    log.debug(`[DRY-RUN] Page: ${page.title} (ID: ${page.id}), Parent: ${page.parentId || 'none'}`);
  });
  
  // Build parent-child relationships
  const rootPages: PreviewPage[] = [];
  const pageMap = new Map<string, PreviewPage>();
  
  // First pass: create page objects
  for (const page of pages) {
    const pageObj: PreviewPage = {
      id: page.id,
      title: page.title,
      children: []
    };
    
    pageMap.set(page.id, pageObj);
  }
    // Second pass: build tree
  for (const page of pages) {
    const pageObj = pageMap.get(page.id);
    
    if (!pageObj) continue;
    
    if (page.parentId) {
      const parentPage = pageMap.get(page.parentId);
      if (parentPage) {
        parentPage.children.push(pageObj);
        log.debug(`[DRY-RUN] Added ${page.title} as child of ${parentPage.title}`);
      } else {
        // Parent not found, add to root
        rootPages.push(pageObj);
        log.debug(`[DRY-RUN] Parent ${page.parentId} not found for ${page.title}, adding to root`);
      }
    } else {
      // Root page
      rootPages.push(pageObj);
      log.debug(`[DRY-RUN] Added ${page.title} as root page`);
    }
  }
  
  log.debug(`[DRY-RUN] Root pages: ${rootPages.length}`);
  rootPages.forEach(page => {
    log.debug(`[DRY-RUN] Root page: ${page.title} with ${page.children.length} children`);
  });
  
  return rootPages;
}

/**
 * Gets all pages in a space
 * @param spaceDir The space directory
 * @returns An array of pages with their metadata
 */
async function getAllPages(spaceDir: string): Promise<Array<{id: string, title: string, parentId?: string}>> {
  const pages: Array<{id: string, title: string, parentId?: string}> = [];
  
  // Recursively search for pages
  async function searchDirectory(dirPath: string): Promise<void> {
    try {
      log.debug(`[DRY-RUN] Searching directory: ${dirPath}`);
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      // Check if this directory has a metadata.json file
      for (const entry of entries) {
        if (entry.isFile() && entry.name === 'metadata.json') {
          try {
            const metadataPath = path.join(dirPath, entry.name);
            const metadataContent = await fs.readFile(metadataPath, 'utf8');
            const metadata = JSON.parse(metadataContent);
            
            // Found a page
            log.debug(`[DRY-RUN] Found page in directory: ${dirPath}`);
            pages.push({
              id: metadata.id,
              title: metadata.title,
              parentId: metadata.parentId
            });
            
            // Don't break - continue to look for subdirectories
          } catch (error) {
            log.debug(`[DRY-RUN] Error reading metadata: ${(error as Error).message}`);
          }
        }
      }
      
      // Look in all subdirectories
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subDirPath = path.join(dirPath, entry.name);
          await searchDirectory(subDirPath);
        }
      }
    } catch (error) {
      // Ignore errors and continue
      log.debug(`[DRY-RUN] Error reading directory: ${(error as Error).message}`);
    }
  }
  
  await searchDirectory(spaceDir);
  log.debug(`[DRY-RUN] Found ${pages.length} total pages`);
  return pages;
}

/**
 * Generates preview HTML files for all pages in a space
 * @param context The dry-run context
 * @param spaceDir The space directory
 * @param spacePreviewDir The space preview directory
 * @param spaceKey The space key
 * @param pages The pages in the space
 * @param spacesData The spaces data
 */
async function generatePagesForSpace(
  context: DryRunContext,
  spaceDir: string,
  spacePreviewDir: string,
  spaceKey: string,
  pages: PreviewPage[],
  spacesData: SpacesData
): Promise<void> {
  // Process all pages recursively
  async function processPages(pagesArray: PreviewPage[]): Promise<void> {
    for (const page of pagesArray) {
      await generatePagePreview(context, spaceDir, spacePreviewDir, spaceKey, page, spacesData);
      
      if (page.children.length > 0) {
        await processPages(page.children);
      }
    }
  }
  
  await processPages(pages);
}

/**
 * Generates a preview HTML file for a page
 * @param context The dry-run context
 * @param spaceDir The space directory
 * @param spacePreviewDir The space preview directory
 * @param spaceKey The space key
 * @param page The page
 * @param spacesData The spaces data
 */
async function generatePagePreview(
  context: DryRunContext,
  spaceDir: string,
  spacePreviewDir: string,
  spaceKey: string,
  page: PreviewPage,
  spacesData: SpacesData
): Promise<void> {
  try {
    // Find the page directory
    const pageDirPath = await findPageDirById(context, spaceDir, page.id);
    
    if (!pageDirPath) {
      log.warn(`[DRY-RUN] Could not find directory for page ${page.title} (ID: ${page.id})`);
      return;
    }
    
    // Read page metadata and content
    const metadataPath = path.join(pageDirPath, 'metadata.json');
    const contentPath = path.join(pageDirPath, 'content.html');
    
    const metadataContent = await fs.readFile(metadataPath, 'utf8');
    const metadata = JSON.parse(metadataContent);
    
    const content = await fs.readFile(contentPath, 'utf8');
    
    // Convert Confluence storage format to HTML
    const attachmentsDir = path.join(pageDirPath, 'attachments');
    const attachmentBaseUrl = `../attachments/${page.id}`;
    
    const convertedContent = ConfluenceConverter.convertStorageToHtml(content, attachmentBaseUrl);
    
    // Get attachments
    const attachments: Array<{name: string, path: string, size: string}> = [];
    
    try {
      // Create attachments directory in preview folder
      const previewAttachmentsDir = path.join(spacePreviewDir, 'attachments', page.id);
      await fs.mkdir(previewAttachmentsDir, { recursive: true });
      
      const attachmentEntries = await fs.readdir(attachmentsDir, { withFileTypes: true });
      
      for (const entry of attachmentEntries) {
        if (entry.isFile()) {
          const sourcePath = path.join(attachmentsDir, entry.name);
          const targetPath = path.join(previewAttachmentsDir, entry.name);
          
          // Copy attachment file
          await fs.copyFile(sourcePath, targetPath);
          
          // Get file size
          const stats = await fs.stat(sourcePath);
          const size = formatFileSize(stats.size);
          
          attachments.push({
            name: entry.name,
            path: `attachments/${page.id}/${entry.name}`,
            size
          });
        }
      }
    } catch (error) {
      // No attachments or error reading attachments directory
      log.debug(`[DRY-RUN] No attachments or error reading attachments: ${(error as Error).message}`);
    }
    
    // Copy active flag to page tree
    markActivePage(spacesData, spaceKey, page.id);
    
    // Prepare template data
    const pageData: PageData = {
      id: page.id,
      title: page.title,
      spaceKey,
      version: metadata.version,
      content: convertedContent,
      attachments,
      spaces: spacesData.spaces
    };
      // Compile template
    const previewHtml = await renderPreviewTemplate(pageData);
    
    // Write preview HTML file
    // Use a more URL-safe filename by replacing problematic characters
    // instead of relying on encodeURIComponent, which creates issues with some HTTP servers
    const safeFilename = page.title.replace(/[^a-zA-Z0-9-_.]/g, '_');
    const previewFilePath = path.join(spacePreviewDir, `${safeFilename}.html`);
    await fs.writeFile(previewFilePath, previewHtml);
    
    log.verbose(`[DRY-RUN] Generated preview for page: ${page.title}`);
  } catch (error) {
    log.warn(`[DRY-RUN] Failed to generate preview for page ${page.title}: ${(error as Error).message}`);
  }
}

/**
 * Finds a page directory by page ID
 * @param context The dry-run context
 * @param spaceDir The space directory
 * @param pageId The page ID
 * @returns The path to the page directory if found
 */
async function findPageDirById(
  context: DryRunContext,
  spaceDir: string,
  pageId: string
): Promise<string | null> {
  // First try the in-memory cache
  for (const page of context.simulatedPages.values()) {
    if (page.id === pageId) {
      // Try to find the directory containing this page ID in metadata
      // Recursively search for directory with matching ID in metadata
      return await findDirRecursively(spaceDir);
    }
  }
  
  // Recursively search for directory with matching ID in metadata
  return await findDirRecursively(spaceDir);
  
  // Helper function to recursively search directories
  async function findDirRecursively(dirPath: string): Promise<string | null> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const entryPath = path.join(dirPath, entry.name);
          
          // Check if this directory has metadata.json
          try {
            const metadataPath = path.join(entryPath, 'metadata.json');
            const metadataContent = await fs.readFile(metadataPath, 'utf8');
            const metadata = JSON.parse(metadataContent);
            
            if (metadata.id === pageId) {
              return entryPath;
            }
          } catch (error) {
            // Not a page directory or error reading metadata
          }
          
          // Recursively search subdirectories
          const result = await findDirRecursively(entryPath);
          if (result) return result;
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
}

/**
 * Formats a file size in bytes to a human-readable string
 * @param sizeInBytes The file size in bytes
 * @returns A human-readable file size string
 */
function formatFileSize(sizeInBytes: number): string {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  } else if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  } else if (sizeInBytes < 1024 * 1024 * 1024) {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    return `${(sizeInBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}

/**
 * Renders the preview template with the given data
 * @param pageData The page data
 * @returns The rendered HTML
 */
async function renderPreviewTemplate(pageData: PageData): Promise<string> {
  try {    
    const dirname = getDirname(); // Get dirname consistently
    
    // We'll try multiple template locations in order
    const templateLocations = [
      // Primary locations based on environment
      !process.argv[0].includes('tsx')
        ? path.resolve(path.dirname(process.argv[1]), 'templates')  // dist/templates
        : path.resolve(process.cwd(), 'src', 'templates'),          // src/templates
      
      // Alternative locations to try as fallbacks
      path.resolve(process.cwd(), 'dist', 'templates'),             // Project root dist/templates
      path.resolve(process.cwd(), 'src', 'templates'),              // Project root src/templates
      path.resolve(dirname, '..', 'templates'),                     // Relative to this file
      path.resolve(dirname, 'templates')                            // Direct templates subdirectory
    ];
    
    // Add this after initializing templateLocations
    log.debug(`[DRY-RUN] Looking for templates in the following locations:`);
    templateLocations.forEach(location => {
      log.debug(`[DRY-RUN] - ${location}`);
    });
    
    // Try each location until we find the template file
    let templateContent: string | null = null;
    let templatePath: string = '';
    
    for (const location of templateLocations) {
      try {
        // Try to read template file
        const tryPath = path.resolve(location, 'preview.hbs');
        const content = await fs.readFile(tryPath, 'utf8');
        templateContent = content;
        templatePath = tryPath;
        log.info(`[DRY-RUN] Found preview template in: ${tryPath}`);
        break;
      } catch (error) {
        // Try the next location
        log.debug(`[DRY-RUN] Preview template not found in: ${location}`);
      }
    }
    
    // If no template found after trying all locations, use a fallback
    if (!templateContent) {
      log.warn(`[DRY-RUN] Failed to find preview template in any location`);
      
      // Create a simple template as fallback
      templateContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>{{title}} - Confluence Preview</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #0052CC; }
            .content { margin: 20px 0; padding: 20px; border: 1px solid #DFE1E6; border-radius: 3px; }
            .attachments { margin-top: 20px; }
            .attachment { padding: 5px; border-bottom: 1px solid #f0f0f0; }
          </style>
        </head>
        <body>
          <h1>{{title}}</h1>
          <div class="content">{{{content}}}</div>
          {{#if attachments.length}}
          <div class="attachments">
            <h2>Attachments</h2>
            {{#each attachments}}
            <div class="attachment">
              <a href="{{path}}">{{name}}</a> ({{size}})
            </div>
            {{/each}}
          </div>
          {{/if}}
        </body>
        </html>
      `;
      log.info('[DRY-RUN] Using fallback preview template');
    }    // Register helpers
    Handlebars.registerHelper('encode', function(str) {
      if (typeof str !== 'string') {
        return '';
      }
      
      // Replace problematic characters with underscores for URL safety
      // This has to match the same encoding used in generatePagePreview when writing the files
      return str.replace(/[^a-zA-Z0-9-_.]/g, '_');
    });
    
    // Try to load partial templates
    try {
      for (const location of templateLocations) {
        try {
          const partialsDir = path.resolve(location, 'partials');
          
          // Check if the partials directory exists
          await fs.access(partialsDir);
          
          // Load all partial templates
          const partialFiles = await fs.readdir(partialsDir);
          
          for (const partialFile of partialFiles) {
            if (partialFile.endsWith('.hbs')) {
              const partialPath = path.join(partialsDir, partialFile);
              const partialContent = await fs.readFile(partialPath, 'utf8');
              const partialName = path.basename(partialFile, '.hbs');
              
              // Register the partial
              Handlebars.registerPartial(partialName, partialContent);
              log.verbose(`[DRY-RUN] Registered partial template: ${partialName}`);
            }
          }
          
          break; // Successfully loaded partials, no need to check other locations
        } catch (error) {
          // No partials directory or error reading partials, try next location
          log.debug(`[DRY-RUN] No partials found in: ${location}/partials`);
        }
      }
    } catch (error) {
      log.debug(`[DRY-RUN] Error loading partial templates: ${(error as Error).message}`);
    }
      // Define the recursive page tree partial inline if it wasn't loaded from a file
    if (!Handlebars.partials['recursivePageTree']) {
      Handlebars.registerPartial('recursivePageTree', `
        {{#each pages}}
          <div class="page-item">
            <a href="../{{../spaceKey}}/{{encode title}}.html" class="page-link {{#if isActive}}active{{/if}}" data-id="{{id}}">
              {{title}}
            </a>
            {{#if children.length}}
              <div class="page-children">
                {{> recursivePageTree pages=children spaceKey=../spaceKey}}
              </div>
            {{/if}}
          </div>
        {{/each}}
      `);
      log.verbose(`[DRY-RUN] Registered inline recursivePageTree partial`);
    }
    
    // Log availability of partials
    log.debug(`[DRY-RUN] Available Handlebars partials: ${Object.keys(Handlebars.partials).join(', ')}`);
    
    // Log page data for debugging
    log.debug(`[DRY-RUN] Rendering template for page: ${pageData.title}`);
    log.debug(`[DRY-RUN] Page has ${pageData.spaces.length} spaces`);
    pageData.spaces.forEach(space => {
      log.debug(`[DRY-RUN] Space ${space.key} has ${space.pages.length} root pages`);
      space.pages.forEach(page => {
        logPageHierarchy(page, 1);
      });
    });
    
    // Helper function to log page hierarchy
    function logPageHierarchy(page: PreviewPage, level: number) {
      const indent = '  '.repeat(level);
      log.debug(`[DRY-RUN] ${indent}Page: ${page.title} (${page.id}), ${page.children.length} children, active: ${page.isActive}`);
      page.children.forEach(child => {
        logPageHierarchy(child, level + 1);
      });
    }
    
    // Compile the template
    const template = Handlebars.compile(templateContent);
    
    // Render the template
    return template(pageData);
  } catch (error) {
    log.warn(`[DRY-RUN] Failed to render preview template: ${(error as Error).message}`);
    
    // Create a simple HTML page
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${pageData.title} - Confluence Preview</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #0052CC; }
          .metadata { color: #666; margin-bottom: 20px; }
          .attachments { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; }
          .attachment-item { padding: 5px; border: 1px solid #ddd; margin-bottom: 5px; display: flex; }
          .attachment-name { flex: 1; }
        </style>
      </head>
      <body>
        <h1>${pageData.title}</h1>
        <div class="metadata">
          <div>Space: ${pageData.spaceKey}</div>
          <div>Version: ${pageData.version}</div>
          <div>ID: ${pageData.id}</div>
        </div>
        <div>${pageData.content}</div>
        ${pageData.attachments.length > 0 ? `
          <div class="attachments">
            <h2>Attachments</h2>
            ${pageData.attachments.map(att => `
              <div class="attachment-item">
                <div class="attachment-name">${att.name} (${att.size})</div>
                <div><a href="${att.path}" target="_blank">View</a></div>
              </div>
            `).join('')}
          </div>
        ` : ''}
        <div>
          <p><a href="../index.html">Back to Index</a></p>
        </div>
      </body>
      </html>
    `;
  }
}

/**
 * Marks a page as active in the spaces data
 * @param spacesData The spaces data
 * @param spaceKey The space key
 * @param pageId The page ID
 */
function markActivePage(spacesData: SpacesData, spaceKey: string, pageId: string): void {
  const space = spacesData.spaces.find(s => s.key === spaceKey);
  if (!space) return;
  
  // Reset all pages first
  const resetAllPages = (pages: PreviewPage[]) => {
    for (const page of pages) {
      page.isActive = false;
      if (page.children.length > 0) {
        resetAllPages(page.children);
      }
    }
  };
  
  resetAllPages(space.pages);
  
  // Set the active page
  const setActivePage = (pages: PreviewPage[]): boolean => {
    for (const page of pages) {
      if (page.id === pageId) {
        page.isActive = true;
        return true;
      }
      
      if (page.children.length > 0 && setActivePage(page.children)) {
        return true;
      }
    }
    
    return false;
  };
  
  setActivePage(space.pages);
}
