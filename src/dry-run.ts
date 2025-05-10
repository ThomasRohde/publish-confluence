// src/dry-run.ts
import fs from 'fs/promises';
import path from 'path';
import { createLogger } from './logger';
import { PublishConfig, ConfluencePage, ConfluenceAttachment } from './types';

// Initialize logger
const log = createLogger();

/**
 * Interface for a dry-run context that simulates Confluence operations
 */
export interface DryRunContext {
  baseDir: string;
  simulatedPages: Map<string, SimulatedPage>;
}

/**
 * Interface for a simulated Confluence page
 */
interface SimulatedPage {
  id: string;
  title: string;
  spaceKey: string;
  content: string;
  parentId?: string;
  version: number;
  attachments: Map<string, string>; // filename -> filepath
}

/**
 * Makes a string safe for use as a directory name
 * @param name The name to sanitize
 * @returns A sanitized string that can be used as a directory name
 */
function sanitizeDirName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid file characters with underscore
    .replace(/\s+/g, '-')         // Replace spaces with hyphens
    .replace(/[.]+$/, '')          // Remove trailing dots
    .substring(0, 250);           // Limit length to avoid path length issues
}

/**
 * Generates a UUID for use as page ID
 * @returns A string UUID
 */
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Creates a new DryRunContext
 * @param baseDir The directory where simulated Confluence content will be saved
 * @returns A new DryRunContext
 */
export async function createDryRunContext(baseDir: string): Promise<DryRunContext> {
  // Create the base directory if it doesn't exist
  await fs.mkdir(baseDir, { recursive: true });
  
  // Create spaces directory
  await fs.mkdir(path.join(baseDir, 'spaces'), { recursive: true });
  
  log.info(`Created dry-run context in directory: ${baseDir}`);
  
  return {
    baseDir,
    simulatedPages: new Map()
  };
}

/**
 * Gets the directory for a page based on title
 * @param context The dry-run context
 * @param spaceKey The space key
 * @param title The page title
 * @returns The path to the page directory
 */
async function getPageDirPath(
  context: DryRunContext,
  spaceKey: string,
  title: string,
  parentId?: string
): Promise<string> {
  const sanitizedTitle = sanitizeDirName(title);
  const spaceDir = path.join(context.baseDir, 'spaces', spaceKey);
  
  if (!parentId) {
    // Root level page
    return path.join(spaceDir, sanitizedTitle);
  }
  
  // Find parent page's directory recursively
  const findParentDirRecursively = async (dirPath: string): Promise<string | null> => {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const metadataPath = path.join(dirPath, entry.name, 'metadata.json');
          
          try {
            const metadataContent = await fs.readFile(metadataPath, 'utf8');
            const metadata = JSON.parse(metadataContent);
            
            if (metadata.id === parentId) {
              // Found parent directory
              return path.join(dirPath, entry.name);
            }
          } catch (error) {
            // No metadata file or can't read it
          }
          
          // Recursively check subdirectories
          const result = await findParentDirRecursively(path.join(dirPath, entry.name));
          if (result) return result;
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  };
  
  const parentDir = await findParentDirRecursively(spaceDir);
  
  if (parentDir) {
    return path.join(parentDir, sanitizedTitle);
  }
  
  // If parent directory not found, place at root level
  log.warn(`[DRY-RUN] Parent page with ID ${parentId} not found. Creating page at root level.`);
  return path.join(spaceDir, sanitizedTitle);
}

/**
 * Simulates finding a page by title in Confluence
 * @param context The dry-run context
 * @param spaceKey The space key
 * @param title The page title
 * @returns The page if found, null otherwise
 */
export async function findPageByTitle(
  context: DryRunContext,
  spaceKey: string,
  title: string
): Promise<ConfluencePage | null> {
  // Normalize keys for consistent lookup
  const key = `${spaceKey}:${title}`;
  
  try {
    // Check if we have this page in our simulated pages
    const page = context.simulatedPages.get(key);
    
    if (page) {
      log.verbose(`[DRY-RUN] Found page: ${page.title} (ID: ${page.id})`);
      
      return {
        id: page.id,
        type: 'page',
        status: 'current',
        title: page.title,
        space: { key: spaceKey },
        version: { number: page.version, minorEdit: false },
        _links: {
          webui: `/spaces/${spaceKey}/pages/${page.id}`,
          self: `/rest/api/content/${page.id}`
        }
      };
    }

    // Try to find page from the file system recursively
    const spaceDir = path.join(context.baseDir, 'spaces', spaceKey);
    
    // Check if the space directory exists
    try {
      await fs.access(spaceDir);
    } catch (error) {
      // Space doesn't exist yet
      log.verbose(`[DRY-RUN] Space ${spaceKey} doesn't exist yet`);
      return null;
    }

    // Search for page recursively in the directory structure
    const findPageRecursively = async (dirPath: string): Promise<ConfluencePage | null> => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const metadataPath = path.join(dirPath, entry.name, 'metadata.json');
            
            try {
              const metadataContent = await fs.readFile(metadataPath, 'utf8');
              const metadata = JSON.parse(metadataContent);
              
              if (metadata.title === title) {
                // Found a matching page
                log.verbose(`[DRY-RUN] Found page from disk: ${title} (ID: ${metadata.id})`);
                
                // Add to in-memory cache
                context.simulatedPages.set(key, {
                  id: metadata.id,
                  title: metadata.title,
                  spaceKey: metadata.spaceKey,
                  content: metadata.content || '',
                  parentId: metadata.parentId,
                  version: metadata.version,
                  attachments: new Map(Object.entries(metadata.attachments || {}))
                });
                
                return {
                  id: metadata.id,
                  type: 'page',
                  status: 'current',
                  title: metadata.title,
                  space: { key: spaceKey },
                  version: { number: metadata.version, minorEdit: false },
                  _links: {
                    webui: `/spaces/${spaceKey}/pages/${metadata.id}`,
                    self: `/rest/api/content/${metadata.id}`
                  }
                };
              }
              
              // Continue searching in subdirectories
              const childResult = await findPageRecursively(path.join(dirPath, entry.name));
              if (childResult) return childResult;
            } catch (error) {
              // No metadata file or can't read it, check subdirectory anyway
              const result = await findPageRecursively(path.join(dirPath, entry.name));
              if (result) return result;
            }
          }
        }
        
        return null;
      } catch (error) {
        return null;
      }
    };
    
    const result = await findPageRecursively(spaceDir);
    if (result) return result;
    
    // Page not found
    log.verbose(`[DRY-RUN] Page not found: ${title} in space ${spaceKey}`);
    return null;
  } catch (error) {
    log.error(`[DRY-RUN] Error finding page: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Simulates creating a new page in Confluence
 * @param context The dry-run context
 * @param spaceKey The space key
 * @param title The page title
 * @param content The page content
 * @param parentId Optional parent page ID
 * @returns The created page
 */
export async function createPage(
  context: DryRunContext,
  spaceKey: string,
  title: string,
  content: string,
  parentId?: string
): Promise<ConfluencePage> {
  try {
    // Generate a new page ID
    const pageId = generateUuid();
    
    // Create a new simulated page
    const newPage: SimulatedPage = {
      id: pageId,
      title,
      spaceKey,
      content,
      parentId,
      version: 1,
      attachments: new Map()
    };
    
    // Add to in-memory cache
    const key = `${spaceKey}:${title}`;
    context.simulatedPages.set(key, newPage);
    
    // Create space directory
    const spaceDir = path.join(context.baseDir, 'spaces', spaceKey);
    await fs.mkdir(spaceDir, { recursive: true });
    
    // Get page directory path based on hierarchy
    const pageDirPath = await getPageDirPath(context, spaceKey, title, parentId);
    await fs.mkdir(pageDirPath, { recursive: true });
    
    // Create attachments directory
    const attachmentsDir = path.join(pageDirPath, 'attachments');
    await fs.mkdir(attachmentsDir, { recursive: true });
    
    // Write content and metadata
    await fs.writeFile(path.join(pageDirPath, 'content.html'), content);
    
    const metadata = {
      id: pageId,
      title,
      spaceKey,
      parentId,
      version: 1,
      attachments: {}
    };
    
    await fs.writeFile(
      path.join(pageDirPath, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    log.info(`[DRY-RUN] Created page: ${title} (ID: ${pageId})`);
    
    return {
      id: pageId,
      type: 'page',
      status: 'current',
      title,
      space: { key: spaceKey },
      version: { number: 1, minorEdit: false },
      _links: {
        webui: `/spaces/${spaceKey}/pages/${pageId}`,
        self: `/rest/api/content/${pageId}`
      }
    };
  } catch (error) {
    log.error(`[DRY-RUN] Error creating page: ${(error as Error).message}`);
    throw new Error(`Failed to create page in dry-run mode: ${(error as Error).message}`);
  }
}

/**
 * Finds a page directory by page ID
 * @param context The dry-run context
 * @param pageId The page ID to find
 * @returns The path to the page directory if found
 */
async function findPageDirById(context: DryRunContext, pageId: string): Promise<string | null> {
  try {
    // Find in the in-memory cache first
    for (const page of context.simulatedPages.values()) {
      if (page.id === pageId) {
        // Try to find the directory containing this page ID in metadata
        const spaceDir = path.join(context.baseDir, 'spaces', page.spaceKey);
        
        // Recursively search for directory with matching ID in metadata
        const findDirRecursively = async (dirPath: string): Promise<string | null> => {
          try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
              if (entry.isDirectory()) {
                const metadataPath = path.join(dirPath, entry.name, 'metadata.json');
                
                try {
                  const metadataContent = await fs.readFile(metadataPath, 'utf8');
                  const metadata = JSON.parse(metadataContent);
                  
                  if (metadata.id === pageId) {
                    // Found the directory
                    return path.join(dirPath, entry.name);
                  }
                } catch (error) {
                  // No metadata or can't read it, continue with subdirectories
                }
                
                // Recursively check subdirectories
                const result = await findDirRecursively(path.join(dirPath, entry.name));
                if (result) return result;
              }
            }
            
            return null;
          } catch (error) {
            return null;
          }
        };
        
        return await findDirRecursively(spaceDir);
      }
    }
    
    // Search all spaces if not found in cache
    const spacesDir = path.join(context.baseDir, 'spaces');
    const spaces = await fs.readdir(spacesDir);
    
    for (const spaceKey of spaces) {
      const spaceDir = path.join(spacesDir, spaceKey);
      
      // Recursively search for directory with matching ID in metadata
      const findDirRecursively = async (dirPath: string): Promise<string | null> => {
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const metadataPath = path.join(dirPath, entry.name, 'metadata.json');
              
              try {
                const metadataContent = await fs.readFile(metadataPath, 'utf8');
                const metadata = JSON.parse(metadataContent);
                
                if (metadata.id === pageId) {
                  // Found the directory
                  return path.join(dirPath, entry.name);
                }
              } catch (error) {
                // No metadata or can't read it, continue with subdirectories
              }
              
              // Recursively check subdirectories
              const result = await findDirRecursively(path.join(dirPath, entry.name));
              if (result) return result;
            }
          }
          
          return null;
        } catch (error) {
          return null;
        }
      };
      
      const result = await findDirRecursively(spaceDir);
      if (result) return result;
    }
    
    return null;
  } catch (error) {
    log.error(`[DRY-RUN] Error finding page directory: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Simulates updating an existing page in Confluence
 * @param context The dry-run context
 * @param pageId The page ID
 * @param title The page title
 * @param content The page content
 * @param version The current version number
 * @returns The updated page
 */
export async function updatePage(
  context: DryRunContext,
  pageId: string,
  title: string,
  content: string,
  version: number
): Promise<ConfluencePage> {
  try {
    // Find the page in the in-memory cache first
    let existingPage: SimulatedPage | undefined;
    let key: string = '';
    
    for (const [k, page] of context.simulatedPages.entries()) {
      if (page.id === pageId) {
        existingPage = page;
        key = k;
        break;
      }
    }
    
    // Find the page directory 
    const pageDirPath = await findPageDirById(context, pageId);
    
    if (!pageDirPath) {
      throw new Error(`Page directory with ID ${pageId} not found in dry-run context`);
    }
    
    if (!existingPage) {
      // Page not in cache, load from metadata
      const metadataPath = path.join(pageDirPath, 'metadata.json');
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent);
      
      existingPage = {
        id: metadata.id,
        title: metadata.title,
        spaceKey: metadata.spaceKey,
        content: metadata.content || '',
        parentId: metadata.parentId,
        version: metadata.version,
        attachments: new Map(Object.entries(metadata.attachments || {}))
      };
      
      key = `${metadata.spaceKey}:${metadata.title}`;
      context.simulatedPages.set(key, existingPage);
    }
    
    // Check if title is changing, which requires directory rename
    const isTitleChanged = existingPage.title !== title;
    
    // Update the page in memory
    existingPage.content = content;
    existingPage.title = title;
    existingPage.version = version + 1;
    
    // Update in-memory cache if title changed
    if (isTitleChanged && key) {
      // Title changed, update the key
      context.simulatedPages.delete(key);
      context.simulatedPages.set(`${existingPage.spaceKey}:${title}`, existingPage);
    }
    
    // Write updated content
    await fs.writeFile(path.join(pageDirPath, 'content.html'), content);
    
    // Update metadata
    const metadata = {
      id: pageId,
      title,
      spaceKey: existingPage.spaceKey,
      parentId: existingPage.parentId,
      version: existingPage.version,
      attachments: Object.fromEntries(existingPage.attachments)
    };
    
    await fs.writeFile(
      path.join(pageDirPath, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    // If title changed, rename the directory
    if (isTitleChanged) {
      try {
        const parentDir = path.dirname(pageDirPath);
        const newDirName = sanitizeDirName(title);
        const newDirPath = path.join(parentDir, newDirName);
        
        // Only rename if the new directory doesn't exist
        try {
          await fs.access(newDirPath);
          // Directory exists, skip renaming
          log.warn(`[DRY-RUN] Cannot rename directory to "${newDirName}" because it already exists`);
        } catch {
          // Directory doesn't exist, safe to rename
          await fs.rename(pageDirPath, newDirPath);
          log.verbose(`[DRY-RUN] Renamed directory from "${path.basename(pageDirPath)}" to "${newDirName}"`);
        }
      } catch (error) {
        log.warn(`[DRY-RUN] Failed to rename directory: ${(error as Error).message}`);
        // Continue anyway as this is not critical
      }
    }
    
    log.info(`[DRY-RUN] Updated page: ${title} (ID: ${pageId}, version: ${existingPage.version})`);
    
    return {
      id: pageId,
      type: 'page',
      status: 'current',
      title,
      space: { key: existingPage.spaceKey },
      version: { number: existingPage.version, minorEdit: false },
      _links: {
        webui: `/spaces/${existingPage.spaceKey}/pages/${pageId}`,
        self: `/rest/api/content/${pageId}`
      }
    };
  } catch (error) {
    log.error(`[DRY-RUN] Error updating page: ${(error as Error).message}`);
    throw new Error(`Failed to update page in dry-run mode: ${(error as Error).message}`);
  }
}

/**
 * Simulates uploading an attachment to a page in Confluence
 * @param context The dry-run context
 * @param pageId The page ID
 * @param filePath The path to the file to attach
 * @returns The attachment information
 */
export async function uploadAttachment(
  context: DryRunContext,
  pageId: string,
  filePath: string
): Promise<ConfluenceAttachment> {
  try {
    // Find the page directory by ID
    const pageDirPath = await findPageDirById(context, pageId);
    
    if (!pageDirPath) {
      throw new Error(`Page directory with ID ${pageId} not found in dry-run context`);
    }
    
    // Find the page in the in-memory cache
    let existingPage: SimulatedPage | undefined;
    
    for (const page of context.simulatedPages.values()) {
      if (page.id === pageId) {
        existingPage = page;
        break;
      }
    }
    
    if (!existingPage) {
      // Page not in cache, load from metadata
      const metadataPath = path.join(pageDirPath, 'metadata.json');
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent);
      
      existingPage = {
        id: metadata.id,
        title: metadata.title,
        spaceKey: metadata.spaceKey,
        content: metadata.content || '',
        parentId: metadata.parentId,
        version: metadata.version,
        attachments: new Map(Object.entries(metadata.attachments || {}))
      };
      
      context.simulatedPages.set(`${metadata.spaceKey}:${metadata.title}`, existingPage);
    }
    
    // Get the attachment filename and prepare destination
    const fileName = path.basename(filePath);
    
    // Create attachments directory
    const attachmentsDir = path.join(pageDirPath, 'attachments');
    await fs.mkdir(attachmentsDir, { recursive: true });
    
    // Copy the file to the attachments directory
    const destinationPath = path.join(attachmentsDir, fileName);
    
    // Read source file content
    const fileContent = await fs.readFile(filePath);
    
    // Write to destination
    await fs.writeFile(destinationPath, fileContent);
    
    // Update the page's attachments
    existingPage.attachments.set(fileName, destinationPath);
    
    // Update metadata
    const metadata = {
      id: pageId,
      title: existingPage.title,
      spaceKey: existingPage.spaceKey,
      parentId: existingPage.parentId,
      version: existingPage.version,
      attachments: Object.fromEntries(existingPage.attachments)
    };
    
    await fs.writeFile(
      path.join(pageDirPath, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    log.info(`[DRY-RUN] Attached file: ${fileName} to page: ${existingPage.title} (ID: ${pageId})`);
    
    // Generate attachment ID
    const attachmentId = generateUuid();
    
    return {
      id: attachmentId,
      type: 'attachment',
      status: 'current',
      title: fileName,
      version: { number: 1, minorEdit: false },
      extensions: {
        mediaType: 'application/octet-stream',
        fileSize: fileContent.length,
      },
      _links: {
        webui: `/spaces/${existingPage.spaceKey}/pages/${pageId}/attachments/${attachmentId}`,
        self: `/rest/api/content/${pageId}/child/attachment/${attachmentId}`,
        download: `/download/attachments/${pageId}/${fileName}`
      }
    };
  } catch (error) {
    log.error(`[DRY-RUN] Error uploading attachment: ${(error as Error).message}`);
    throw new Error(`Failed to upload attachment in dry-run mode: ${(error as Error).message}`);
  }
}

/**
 * Creates a mock Confluence client for dry-run mode
 * @param baseDir The directory where simulated Confluence content will be saved
 * @returns A mock Confluence client
 */
export async function createDryRunClient(baseDir: string) {
  // Create the context
  const context = await createDryRunContext(baseDir);
  
  // Return a mock client with the necessary methods
  return {
    findPageByTitle: (spaceKey: string, title: string) => 
      findPageByTitle(context, spaceKey, title),
    
    createPage: (spaceKey: string, title: string, content: string, parentId?: string) => 
      createPage(context, spaceKey, title, content, parentId),
    
    updatePage: (pageId: string, title: string, content: string, version: number) => 
      updatePage(context, pageId, title, content, version),
    
    upsertPage: async (
      spaceKey: string,
      title: string,
      content: string,
      parentTitle?: string,
      updateMessage?: string,
      retryCount: number = 3,
      retryDelay: number = 2000
    ) => {
      // Find if the page already exists
      const existingPage = await findPageByTitle(context, spaceKey, title);
      
      if (existingPage) {
        // Update the page
        return updatePage(
          context,
          existingPage.id,
          title,
          content,
          existingPage.version?.number || 1
        );
      } else {
        // Create a new page
        // If parent title is provided, find the parent page
        let parentId: string | undefined;
        
        if (parentTitle) {
          const parentPage = await findPageByTitle(context, spaceKey, parentTitle);
          if (parentPage) {
            parentId = parentPage.id;
          } else {
            log.warn(`[DRY-RUN] Parent page "${parentTitle}" not found, creating page at root level`);
          }
        }
        
        return createPage(context, spaceKey, title, content, parentId);
      }
    },
    
    uploadAttachment: (pageId: string, filePath: string) => 
      uploadAttachment(context, pageId, filePath),
    
    // Mock for listAttachments - returns empty array for simplicity
    listAttachments: async (pageId: string) => {
      log.verbose(`[DRY-RUN] Listing attachments for page: ${pageId}`);
      return [];
    }
  };
}
