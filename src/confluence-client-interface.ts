// src/confluence-client-interface.ts
import { ConfluenceAttachment, ConfluencePage } from './types';

/**
 * Interface for Confluence client API that can be implemented by both
 * the real client and the dry-run mock client
 */
export interface IConfluenceClient {
  /**
   * Find a page by title in a given space
   */
  findPageByTitle(spaceKey: string, title: string): Promise<ConfluencePage | null>;

  /**
   * Create a new page
   */
  createPage(
    spaceKey: string,
    title: string,
    content: string,
    parentPageId?: string
  ): Promise<ConfluencePage>;

  /**
   * Update an existing page
   */
  updatePage(
    pageId: string,
    title: string,
    content: string,
    version: number,
    updateMessage?: string
  ): Promise<ConfluencePage>;

  /**
   * Create or update a page
   */
  upsertPage(
    spaceKey: string,
    title: string,
    content: string,
    parentPageTitle?: string,
    updateMessage?: string,
    retryCount?: number,
    retryDelay?: number
  ): Promise<ConfluencePage>;

  /**
   * Upload an attachment to a page
   */
  uploadAttachment(
    pageId: string,
    filePath: string,
    comment?: string
  ): Promise<ConfluenceAttachment>;

  /**
   * List attachments on a page
   */
  listAttachments(pageId: string): Promise<ConfluenceAttachment[]>;
}
