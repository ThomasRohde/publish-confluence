// src/client.ts
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import FormData from 'form-data'; // Import specifically for Node.js usage
import * as fs from 'fs';
import * as path from 'path';
import {
  AuthenticationError,
  BadRequestError,
  ConfluenceApiError,
  PermissionDeniedError,
  ResourceNotFoundError
} from './errors';
import { createLogger, setVerbosityLevel, VERBOSITY } from './logger';
import {
  ConfluenceAttachment,
  ConfluenceClientConfig,
  ConfluenceContentArray,
  ConfluencePage,
  ConfluenceSpace,
  ConfluenceUser,
  ContentWatchersResponse,
  ServerInfo,
  SpaceTaskResponse,
  UserGroupsResponse,
  WatchStatus
} from './types';

export class ConfluenceClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly restApiBase: string;
  private readonly debug: boolean;
  private readonly logger: ReturnType<typeof createLogger>;
  private readonly customErrorHandler?: (error: any) => boolean;

  constructor(config: ConfluenceClientConfig) {
    if (!config.baseUrl) {
      throw new Error('Confluence base URL is required.');
    }
    
    // Check for valid authentication options
    const { auth } = config;
    if (!auth) {
      throw new Error('Confluence authentication credentials are required.');
    }
    
    // Ensure token authentication is provided
    if (!auth.token) {
      throw new Error('A token for authentication is required.');
    }

    const { baseUrl, axiosConfig = {} } = config;
    this.restApiBase = `${baseUrl.replace(/\/$/, '')}/rest/api`; // Ensure no trailing slash
    this.debug = config.verbose || false;
    
    // Store custom error handler if provided
    this.customErrorHandler = config.customErrorHandler;
    
    // Initialize logger with component name
    this.logger = createLogger(true, 'ConfluenceClient');
    
    // Set verbosity based on debug flag
    if (this.debug) {
      setVerbosityLevel(VERBOSITY.DEBUG);
    }

    // Log authentication details (safely)
    const truncatedToken = auth.token.substring(0, 5) + '...' + 
      auth.token.substring(auth.token.length - 5);
    
    this.logger.debug('Initializing ConfluenceClient', {
      baseUrl: this.restApiBase,
      authMethod: 'Token Authentication',
      sslVerification: config.rejectUnauthorized === false ? 'Disabled' : 'Enabled',
      token: `${truncatedToken} (${auth.token.length} chars)`,
      hasCustomErrorHandler: !!this.customErrorHandler
    });

    // Configure authorization headers based on auth method
    // Use Record<string, string> instead of AxiosRequestHeaders to avoid type issues
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'X-Atlassian-Token': 'nocheck', // Required for POST/PUT/DELETE in DC/Server
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${auth.token}`,
      ...(axiosConfig.headers as Record<string, string> || {}), // Allow overriding/adding headers
    };

    // Configure Axios with base options
    const axiosOptions: AxiosRequestConfig = {
      baseURL: this.restApiBase,
      headers,
      ...axiosConfig, // Spread other custom Axios config
    };    
    // Handle SSL certificate validation
    if (config.rejectUnauthorized === false) {
      // Set the environment variable to disable certificate checking
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      
      // Suppress Node.js warning about insecure TLS connections
      const originalEmitWarning = process.emitWarning;
      process.emitWarning = function(warning: string | Error, ...args: any[]): void {
        if (typeof warning === 'string' && warning.includes('NODE_TLS_REJECT_UNAUTHORIZED')) {
          return; // Suppress this specific warning
        }
        if (warning instanceof Error && warning.message.includes('NODE_TLS_REJECT_UNAUTHORIZED')) {
          return; // Suppress this specific warning when provided as Error object
        }
        return originalEmitWarning.call(process, warning, ...args);
      };
    }

    this.axiosInstance = axios.create(axiosOptions);

    // Add error interceptor for comprehensive error handling based on status codes
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          const status = error.response.status;
          const resourcePath = error.config?.url || 'unknown';
          
          // Additional logging for authentication errors
          if (status === 401) {
            this.logger.error('Authentication failed', {
              url: `${this.restApiBase}${resourcePath}`,
              status,
              statusText: error.response.statusText,
              headers: error.response.headers,
              data: error.response.data,
              possibleCauses: [
                'Invalid API token (expired or malformed)',
                'URL domain issues (e.g., using cloud URL for server instance)',
                'User lacks permissions for this operation',
                'Token scopes may not include the required permissions'
              ]
            });
          }
          
          // Create the error context object
          const errorContext = {
            url: `${this.restApiBase}${resourcePath}`,
            method: error.config?.method?.toUpperCase() || 'GET',
            status,
            statusText: error.response.statusText,
            responseData: error.response.data,
            requestPath: resourcePath
          };

          // Try to handle the error with the custom error handler if provided
          if (this.customErrorHandler) {
            const wrappedError = this.createCustomError(status, errorContext, error);
            const wasHandled = this.customErrorHandler(wrappedError);
            if (wasHandled) {
              // If the custom handler indicates it handled the error, we return the error
              // but without rejecting the promise, which allows the calling code to continue
              return Promise.resolve({ 
                data: { 
                  _handledError: true,
                  originalError: wrappedError
                } 
              });
            }
          }

          // Handle different status codes according to OpenAPI spec
          switch (status) {
            case 400:
              this.logger.error('Invalid request parameters', errorContext);
              return Promise.reject(new BadRequestError('Invalid request parameters', error));
            case 401:
              // Authentication errors are already logged above
              return Promise.reject(new AuthenticationError('Authentication credentials are invalid', error));
            case 403:
              this.logger.error('Permission denied', {
                ...errorContext,
                possibleSolutions: [
                  'Ensure the user has appropriate permissions in Confluence',
                  'Check space restrictions and page restrictions',
                  'Verify token has sufficient scopes'
                ]
              });
              return Promise.reject(new PermissionDeniedError('You do not have permission to perform this action', error));
            case 404:
              this.logger.error('Resource not found', errorContext);
              return Promise.reject(new ResourceNotFoundError('Resource', resourcePath, error));
            default:
              this.logger.error(`API request failed with status ${status}`, errorContext);
              return Promise.reject(new ConfluenceApiError('API request failed', error));
          }
        }
        return Promise.reject(new ConfluenceApiError('API request failed', error));
      }
    );
  }

  /**
   * Creates a custom error object based on the status code
   */
  private createCustomError(status: number, errorContext: any, originalError: AxiosError): any {
    // Create the appropriate error type based on status code
    let error;
    switch (status) {
      case 400:
        error = new BadRequestError('Invalid request parameters', originalError);
        break;
      case 401:
        error = new AuthenticationError('Authentication credentials are invalid', originalError);
        break;
      case 403:
        error = new PermissionDeniedError('You do not have permission to perform this action', originalError);
        break;
      case 404:
        error = new ResourceNotFoundError('Resource', errorContext.requestPath, originalError);
        break;
      default:
        error = new ConfluenceApiError('API request failed', originalError);
    }

    // Add additional context to the error
    // We're using non-readonly properties that we added to the class
    error.requestPath = errorContext.requestPath;
    error.responseData = errorContext.responseData;
    error.url = errorContext.url;
    error.method = errorContext.method;

    return error;
  }

  /** Make a generic request to the Confluence API */
  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      // Log API request details with appropriate verbosity
      this.logger.debug(`API Request: ${config.method?.toUpperCase() || 'GET'} ${config.url}`, {
        method: config.method?.toUpperCase() || 'GET',
        url: config.url,
        params: config.params || {},
        hasData: !!config.data,
        dataType: config.data ? (config.data instanceof FormData ? 'FormData' : typeof config.data) : 'none'
      });
      
      // Log request body at highest verbosity level for non-FormData requests
      if (config.data && !(config.data instanceof FormData)) {
        const bodyPreview = typeof config.data === 'string' ? 
          config.data.substring(0, 500) : JSON.stringify(config.data, null, 2).substring(0, 500);
        
        this.logger.verbose(`Request body preview: ${bodyPreview}`);
      }
      
      const response = await this.axiosInstance.request<T>(config);
      
      // Log response details
      this.logger.debug(`API Response: ${response.status} ${response.statusText}`, {
        status: response.status,
        statusText: response.statusText,
        dataType: typeof response.data,
        headers: response.headers
      });
      
      return response.data;
    } catch (error) {
      if (error instanceof ConfluenceApiError) {
        // Re-throw custom error already created by interceptor
         throw error;
      }
      
      // Wrap other unexpected errors with contextual information
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during the request';
      this.logger.error(`Unexpected error during API request: ${errorMessage}`, {
        method: config.method?.toUpperCase() || 'GET',
        url: config.url,
        errorType: error instanceof Error ? error.constructor.name : typeof error
      });
      
      throw new ConfluenceApiError(errorMessage);
    }
  }

  // The rest of the class remains unchanged
  /** Find a page by its title within a specific space */
  async findPageByTitle(spaceKey: string, title: string): Promise<ConfluencePage | null> {
    // Log the search operation with contextual information
    this.logger.debug(`Finding page by title`, {
      spaceKey,
      title,
      operation: 'findPageByTitle'
    });
    
    try {
      // First try direct CQL search which is more efficient
      const searchParams = {
        cql: `type=page AND space.key="${spaceKey}" AND title="${title.replace(/"/g, '\\"')}"`,
      };
      
      const results = await this.request<ConfluenceContentArray<ConfluencePage>>({
        method: 'GET',
        url: '/content/search',
        params: searchParams
      });

      if (results.results && results.results.length > 0) {
        // Page found
        if (this.debug) {
          console.log(`Page found: "${title}" (ID: ${results.results[0].id})`);
        }
        return results.results[0];
      }
      
      // If no results, return null
      if (this.debug) {
        console.log(`Page not found: "${title}" in space "${spaceKey}"`);
      }
      return null;
    } catch (error) {
       console.error(`Error finding page "${title}" in space "${spaceKey}":`, error);
       throw error; // Re-throw other errors
    }
  }

  /** Get the home page ID for a given space */
  async getSpaceHomepageId(spaceKey: string): Promise<string> {
    try {
      const space = await this.request<ConfluenceSpace>({
        method: 'GET',
        url: `/space/${spaceKey}`,
        params: {
          expand: 'homepage',
        },
      });

      if (!space.homepage || !space.homepage.id) {
        throw new Error(`Homepage not found or not configured for space "${spaceKey}".`);
      }
      return space.homepage.id;
    } catch (error) {
      console.error(`Error getting homepage for space "${spaceKey}":`, error);
      throw error; // Re-throw
    }
  }

  /**
   * Creates or updates a Confluence page.
   * If the page exists (matched by title and space), it updates it. Otherwise, it creates a new page.
   *
   * @param spaceKey The key of the space where the page should reside.
   * @param title The title of the page.
   * @param bodyContent Confluence Storage Format (XHTML) content for the page body.
   * @param parentPageTitle Optional title of the parent page. If omitted, defaults to the space's homepage.
   * @param updateMessage Optional message for the page history update.
   * @param retryCount Optional number of retries if parent page is not found (default: 3).
   * @param retryDelay Optional delay between retries in milliseconds (default: 2000).
   * @returns The created or updated Confluence page object.
   */
  async upsertPage(
    spaceKey: string,
    title: string,
    bodyContent: string,
    parentPageTitle?: string,
    updateMessage?: string,
    retryCount: number = 3,
    retryDelay: number = 2000
  ): Promise<ConfluencePage> {
    // Try to find existing page with up to 2 retries if not found initially
    // This helps handle cases where the page might be in process of being indexed by Confluence
    let existingPage = null;
    let attempts = 0;
    const maxFindAttempts = 2;
    
    while (!existingPage && attempts < maxFindAttempts) {
      existingPage = await this.findPageByTitle(spaceKey, title);
      
      if (!existingPage && attempts < maxFindAttempts - 1) {
        if (this.debug) {
          console.log(`Page "${title}" not found on attempt ${attempts + 1}. Waiting before retry...`);
        }
        // Short wait between retries (500ms)
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      } else {
        break;
      }
    }
    
    // If page exists, update it
    if (existingPage) {
      return this.updatePage(
        existingPage.id,
        title,
        bodyContent,
        existingPage.version?.number ?? 1,
        updateMessage
      );
    }

    // Otherwise, create a new page
    let parentPageId: string | undefined;
    
    // Handle parent page retrieval with retries
    if (parentPageTitle) {
      let parentAttempts = 0;
      
      while (parentAttempts <= retryCount) {
        try {
          const parentPage = await this.findPageByTitle(spaceKey, parentPageTitle);
          
          if (!parentPage) {
            // Parent page not found, but we still have retries left
            if (parentAttempts < retryCount) {
              if (this.debug) {
                console.log(`Parent page "${parentPageTitle}" not found on attempt ${parentAttempts + 1}. Waiting ${retryDelay}ms before retry...`);
              }
              
              // Wait before retrying - use exponential backoff for better results
              const backoffDelay = retryDelay * Math.pow(1.5, parentAttempts);
              await new Promise(resolve => setTimeout(resolve, backoffDelay));
              parentAttempts++;
              continue;
            }
            
            // We've exhausted all retries - report the error
            throw new ResourceNotFoundError('Parent page', parentPageTitle);
          }
          
          // Parent page found, store its ID and break out of the retry loop
          parentPageId = parentPage.id;
          if (this.debug && parentAttempts > 0) {
            console.log(`Parent page "${parentPageTitle}" found after ${parentAttempts + 1} attempts.`);
          }
          break;
        } catch (error) {
          // Only retry ResourceNotFoundError, let other errors bubble up immediately
          if (!(error instanceof ResourceNotFoundError) || parentAttempts >= retryCount) {
            throw error;
          }
          
          parentAttempts++;
          
          if (this.debug) {
            console.log(`Error finding parent page "${parentPageTitle}" (attempt ${parentAttempts}): ${error.message}`);
          }
        }
      }
    } else {
      // Default to space homepage if no parent specified
      parentPageId = await this.getSpaceHomepageId(spaceKey);
    }

    return this.createPage(spaceKey, title, bodyContent, parentPageId);
  }

  /**
   * Updates an existing page
   */
  private async updatePage(
    pageId: string,
    title: string,
    bodyContent: string,
    version: number,
    updateMessage?: string
  ): Promise<ConfluencePage> {
    try {
      // First, get the latest version of the page to ensure we're using the correct version number
      const latestPage = await this.getContentById(pageId, ['version']);
      const currentVersion = latestPage.version?.number || version;
      
      if (this.debug) {
        console.log(`Updating page ${pageId}, provided version: ${version}, current version from server: ${currentVersion}`);
      }
      
      const response = await this.request<ConfluencePage>({
        method: 'PUT',
        url: `/content/${pageId}`,
        data: {
          version: {
            number: currentVersion + 1,
            message: updateMessage || `Updated page ${title}`,
            minorEdit: false
          },
          title,
          type: 'page',
          body: {
            storage: {
              value: bodyContent,
              representation: 'storage'
            }
          }
        }
      });
      return response;
    } catch (error) {
      console.error(`Error updating page with ID ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Creates a new page
   */
  private async createPage(
    spaceKey: string,
    title: string,
    bodyContent: string,
    parentPageId?: string
  ): Promise<ConfluencePage> {
    try {
      const data: Record<string, any> = {
        type: 'page',
        title,
        space: { key: spaceKey },
        body: {
          storage: {
            value: bodyContent,
            representation: 'storage'
          }
        }
      };

      // Add ancestor if parent page ID is provided
      if (parentPageId) {
        data.ancestors = [{ id: parentPageId }];
      }

      const response = await this.request<ConfluencePage>({
        method: 'POST',
        url: '/content',
        data
      });
      
      return response;
    } catch (error) {
      // Check if this is a "page already exists" error
      if (error instanceof BadRequestError && 
          error.apiErrorData && 
          typeof error.apiErrorData === 'object' && 
          'message' in error.apiErrorData && 
          typeof error.apiErrorData.message === 'string' &&
          error.apiErrorData.message.includes('A page with this title already exists')) {
        
        if (this.debug) {
          console.log(`Page "${title}" already exists but wasn't found earlier. Retrying with findPageByTitle.`);
        }
        
        // Retry finding the page with exponential backoff
        let existingPage = null;
        let attempts = 0;
        const maxAttempts = 3;
        const initialBackoff = 1000; // 1 second initial wait
        
        while (!existingPage && attempts < maxAttempts) {
          // Wait with exponential backoff: 1s, 2s, 4s, etc.
          const backoffTime = initialBackoff * Math.pow(2, attempts);
          if (this.debug) {
            console.log(`Waiting ${backoffTime}ms before retry attempt ${attempts + 1}...`);
          }
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          
          // Try to find the page again
          existingPage = await this.findPageByTitle(spaceKey, title);
          attempts++;
          
          if (existingPage) {
            if (this.debug) {
              console.log(`Page found on attempt ${attempts}. Updating instead of creating.`);
            }
            // Page now found, update it instead
            return this.updatePage(
              existingPage.id,
              title,
              bodyContent,
              existingPage.version?.number ?? 1
            );
          } else if (this.debug && attempts < maxAttempts) {
            console.log(`Page still not found after attempt ${attempts}. Retrying...`);
          }
        }
        
        if (!existingPage) {
          console.error(`Unable to find existing page "${title}" after ${maxAttempts} attempts despite Confluence reporting it exists.`);
        }
      }
      
      console.error(`Error creating page "${title}" in space ${spaceKey}:`, error);
      throw error;
    }
  }

  /**
   * List attachments on a page
   */
  async listAttachments(pageId: string): Promise<ConfluenceAttachment[]> {
    try {
      const response = await this.request<ConfluenceContentArray<ConfluenceAttachment>>({
        method: 'GET',
        url: `/content/${pageId}/child/attachment`,
        params: {
          expand: 'version'
        }
      });
      
      return response.results;
    } catch (error) {
      console.error(`Error listing attachments for page ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Upload a file as an attachment to a page
   * 
   * Workaround for Confluence API limitation: attachments cannot be directly updated via 
   * POST/PUT on the attachment endpoint. Instead, we must delete the existing attachment
   * (if it exists) and then create a new one with the same name.
   * 
   * This approach is necessary because:
   * 1. Confluence doesn't provide an "update" endpoint for attachments
   * 2. Attempting to create an attachment with the same name would fail with a conflict
   * 3. The delete-then-create pattern is the documented approach in Atlassian's API docs
   */
  async uploadAttachment(
    pageId: string, 
    filePath: string, 
    comment?: string
  ): Promise<ConfluenceAttachment> {
    try {
      // Make sure the file exists before proceeding
      try {
        await fs.promises.access(filePath, fs.constants.R_OK);
      } catch (error) {
        throw new Error(`File not found or not readable: ${filePath}. Original error: ${(error as Error).message}`);
      }
      
      const formData = new FormData();
      
      // Read file content
      const fileContent = await fs.promises.readFile(filePath);
      const fileName = path.basename(filePath);
      
      // Add file to form data
      formData.append('file', fileContent, fileName);
      
      // Add comment if provided
      if (comment) {
        formData.append('comment', comment);
      }
      
      // Check if attachment with same name exists
      const existingAttachments = await this.listAttachments(pageId);
      const existingAttachment = existingAttachments.find(att => att.title === fileName);
      
      // Confluence API approach: Always use POST, but with different endpoints
      // For updates, we need to delete the old attachment first, then create a new one
      if (existingAttachment) {
        if (this.debug) {
          console.log(`Attachment ${fileName} already exists (ID: ${existingAttachment.id}). Deleting it before creating a new version.`);
        }
        
        // Delete the existing attachment
        await this.deleteContent(existingAttachment.id);
        
        if (this.debug) {
          console.log(`Existing attachment deleted. Creating new version.`);
        }
      }
      
      // Always create a new attachment (either fresh or replacing deleted one)
      const url = `/content/${pageId}/child/attachment`;
      
      // Make request with form data
      const response = await this.request<ConfluenceContentArray<ConfluenceAttachment>>({
        method: 'POST',
        url,
        headers: {
          ...formData.getHeaders(),
        },
        data: formData
      });
      
      // Return the first result
      if (response.results && response.results.length > 0) {
        return response.results[0];
      }
      throw new Error('No attachment was created');
    } catch (error) {
      // Get file size using fs.promises for better ESM compatibility
      let fileSize: string = 'unknown';
      try {
        const stats = await fs.promises.stat(filePath);
        fileSize = `${stats.size} bytes`;
      } catch {
        // Ignore errors when getting file size
      }
      
      this.logger.error(`Failed to upload attachment ${path.basename(filePath)} to page ${pageId}`, {
        error: (error as Error).message,
        pageId,
        filePath,
        fileSize,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  /**
   * Search for content in Confluence using the Confluence Query Language (CQL)
   * 
   * @param cqlQuery The CQL query to execute 
   * @param expand Optional fields to expand in the response
   * @param limit Optional maximum number of results to return (default 25)
   * @param additionalParams Optional additional parameters to pass to the search endpoint
   * @returns Search results
   */
  async search(
    cqlQuery: string, 
    expand?: string[], 
    limit?: number,
    additionalParams: Record<string, string> = {}
  ): Promise<ConfluenceContentArray<any>> {
    try {
      return await this.request<ConfluenceContentArray<any>>({
        method: 'GET',
        url: '/search',
        params: {
          cql: cqlQuery,
          ...(expand?.length ? { expand: expand.join(',') } : {}),
          ...(limit ? { limit } : {}),
          ...additionalParams
        }
      });
    } catch (error) {
      console.error(`Error executing search query "${cqlQuery}":`, error);
      throw error;
    }
  }

  /**
   * Search for content in Confluence with context for specific spaces
   * 
   * @param query The search term
   * @param spaceKey Optional space key to restrict the search
   * @param contentId Optional content ID to provide context for the search
   * @returns Search results
   */
  async siteSearch(
    query: string, 
    spaceKey?: string, 
    contentId?: string
  ): Promise<ConfluenceContentArray<any>> {
    // Create a CQL query with proper escaping
    const escapedQuery = query.replace(/'/g, "\\'");
    let cqlQuery = `siteSearch~'${escapedQuery}'`;
    
    // Build CQL context if needed
    const cqlContext: Record<string, string> = {};
    if (spaceKey) cqlContext.spaceKey = spaceKey;
    if (contentId) cqlContext.contentId = contentId;
    
    const params: Record<string, string> = {};
    if (Object.keys(cqlContext).length > 0) {
      params.cqlcontext = JSON.stringify(cqlContext);
    }
    
    return this.search(cqlQuery, ['content.space', 'space.homepage'], 25, params);
  }

  /**
   * Get server information including version
   * 
   * @returns Information about the Confluence server
   */
  async getServerInfo(): Promise<ServerInfo> {
    try {
      return await this.request<ServerInfo>({
        method: 'GET',
        url: '/server-information',
      });
    } catch (error) {
      console.error('Error fetching server information:', error);
      throw error;
    }
  }

  /**
   * Get a list of spaces
   * 
   * @param params Optional parameters to filter spaces (keys, type, status, etc.)
   * @param expand Optional list of properties to expand in the response
   * @param limit Optional maximum number of spaces to return
   * @returns Paginated list of spaces
   */
  async getSpaces(
    params: { 
      spaceKey?: string[],
      type?: 'global' | 'personal',
      status?: 'current' | 'archived',
      label?: string[]
    } = {},
    expand: string[] = [],
    limit?: number
  ): Promise<ConfluenceContentArray<ConfluenceSpace>> {
    try {
      const requestParams: Record<string, any> = {
        ...params,
        ...(expand.length ? { expand: expand.join(',') } : {}),
        ...(limit ? { limit } : {}),
      };

      // Handle array parameters
      if (params.spaceKey && Array.isArray(params.spaceKey)) {
        delete requestParams.spaceKey;
        params.spaceKey.forEach((key, i) => {
          requestParams[`spaceKey${i > 0 ? '.' + i : ''}`] = key;
        });
      }

      if (params.label && Array.isArray(params.label)) {
        delete requestParams.label;
        params.label.forEach((label, i) => {
          requestParams[`label${i > 0 ? '.' + i : ''}`] = label;
        });
      }

      return await this.request<ConfluenceContentArray<ConfluenceSpace>>({
        method: 'GET',
        url: '/space',
        params: requestParams,
      });
    } catch (error) {
      console.error('Error fetching spaces:', error);
      throw error;
    }
  }

  /**
   * Get a specific space by key
   * 
   * @param spaceKey The key of the space to retrieve
   * @param expand Optional list of properties to expand in the response (e.g., description, homepage)
   * @returns The requested space or throws an error if not found
   */
  async getSpace(
    spaceKey: string,
    expand: string[] = []
  ): Promise<ConfluenceSpace> {
    try {
      return await this.request<ConfluenceSpace>({
        method: 'GET',
        url: `/space/${spaceKey}`,
        params: {
          ...(expand.length ? { expand: expand.join(',') } : {})
        }
      });
    } catch (error) {
      console.error(`Error fetching space with key "${spaceKey}":`, error);
      throw error;
    }
  }

  /**
   * Create a new space
   * 
   * @param key The key for the new space
   * @param name The name for the new space
   * @param description Optional description for the space
   * @returns The created space
   */
  async createSpace(
    key: string, 
    name: string, 
    description?: string
  ): Promise<ConfluenceSpace> {
    try {
      const payload = {
        key,
        name,
        description: description ? {
          plain: {
            value: description,
            representation: 'plain'
          }
        } : undefined
      };

      return await this.request<ConfluenceSpace>({
        method: 'POST',
        url: '/space',
        data: payload,
      });
    } catch (error) {
      console.error(`Error creating space with key "${key}":`, error);
      throw error;
    }
  }

  /**
   * Update a space
   * 
   * @param spaceKey The key of the space to update
   * @param name New name for the space
   * @param description Optional new description for the space
   * @returns The updated space
   */
  async updateSpace(
    spaceKey: string, 
    name: string, 
    description?: string
  ): Promise<ConfluenceSpace> {
    try {
      const payload = {
        name,
        description: description ? {
          plain: {
            value: description,
            representation: 'plain'
          }
        } : undefined
      };

      return await this.request<ConfluenceSpace>({
        method: 'PUT',
        url: `/space/${spaceKey}`,
        data: payload,
      });
    } catch (error) {
      console.error(`Error updating space with key "${spaceKey}":`, error);
      throw error;
    }
  }

  /**
   * Archive a space
   * 
   * @param spaceKey The key of the space to archive
   * @returns Nothing on success (204 status)
   */
  async archiveSpace(spaceKey: string): Promise<void> {
    try {
      await this.request({
        method: 'PUT',
        url: `/space/${spaceKey}/archive`,
      });
    } catch (error) {
      console.error(`Error archiving space with key "${spaceKey}":`, error);
      throw error;
    }
  }

  /**
   * Restore a previously archived space
   * 
   * @param spaceKey The key of the space to restore
   * @returns Nothing on success (204 status)
   */
  async restoreSpace(spaceKey: string): Promise<void> {
    try {
      await this.request({
        method: 'PUT',
        url: `/space/${spaceKey}/restore`,
      });
    } catch (error) {
      console.error(`Error restoring space with key "${spaceKey}":`, error);
      throw error;
    }
  }

  /**
   * Delete a space permanently (this is an asynchronous operation in Confluence)
   * 
   * @param spaceKey The key of the space to delete
   * @returns Information about the long-running task for the deletion
   */
  async deleteSpace(spaceKey: string): Promise<SpaceTaskResponse> {
    try {
      return await this.request<SpaceTaskResponse>({
        method: 'DELETE',
        url: `/space/${spaceKey}`,
      });
    } catch (error) {
      console.error(`Error deleting space with key "${spaceKey}":`, error);
      throw error;
    }
  }

  /**
   * Get information about the currently authenticated user
   * 
   * @param expand Optional properties to expand in the response
   * @returns User information
   */
  async getCurrentUser(expand: string[] = []): Promise<ConfluenceUser> {
    try {
      return await this.request<ConfluenceUser>({
        method: 'GET',
        url: '/user/current',
        params: {
          ...(expand.length ? { expand: expand.join(',') } : {})
        }
      });
    } catch (error) {
      console.error('Error fetching current user information:', error);
      throw error;
    }
  }

  /**
   * Get information about a specific user by username or key
   * 
   * @param usernameOrKey The username or key of the user to retrieve
   * @param isKey Whether the provided identifier is a key (true) or username (false)
   * @param expand Optional properties to expand in the response
   * @returns User information
   */
  async getUser(
    usernameOrKey: string,
    isKey: boolean = false,
    expand: string[] = []
  ): Promise<ConfluenceUser> {
    try {
      return await this.request<ConfluenceUser>({
        method: 'GET',
        url: '/user',
        params: {
          ...(isKey ? { key: usernameOrKey } : { username: usernameOrKey }),
          ...(expand.length ? { expand: expand.join(',') } : {})
        }
      });
    } catch (error) {
      console.error(`Error fetching user "${usernameOrKey}":`, error);
      throw error;
    }
  }

  /**
   * Get a paginated list of all users
   * 
   * @param start Optional starting index for pagination (default 0)
   * @param limit Optional maximum number of users to return (default 25)
   * @param expand Optional properties to expand in the response
   * @returns Paginated list of users
   */
  async getUsers(
    start: number = 0,
    limit: number = 25,
    expand: string[] = []
  ): Promise<ConfluenceContentArray<ConfluenceUser>> {
    try {
      return await this.request<ConfluenceContentArray<ConfluenceUser>>({
        method: 'GET',
        url: '/user/list',
        params: {
          start,
          limit,
          ...(expand.length ? { expand: expand.join(',') } : {})
        }
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  /**
   * Get the groups a user belongs to
   * 
   * @param usernameOrKey The username or key of the user
   * @param isKey Whether the provided identifier is a key (true) or username (false)
   * @returns Paginated list of groups the user belongs to
   */
  async getUserGroups(
    usernameOrKey: string,
    isKey: boolean = false
  ): Promise<UserGroupsResponse> {
    try {
      return await this.request<UserGroupsResponse>({
        method: 'GET',
        url: '/user/memberof',
        params: {
          ...(isKey ? { key: usernameOrKey } : { username: usernameOrKey })
        }
      });
    } catch (error) {
      console.error(`Error fetching groups for user "${usernameOrKey}":`, error);
      throw error;
    }
  }

  /**
   * Get specific content by ID
   * 
   * @param contentId The ID of the content to retrieve
   * @param expand Optional fields to expand in the response
   * @returns The content object
   */
  async getContentById(
    contentId: string,
    expand: string[] = []
  ): Promise<ConfluencePage> {
    try {
      return await this.request<ConfluencePage>({
        method: 'GET',
        url: `/content/${contentId}`,
        params: {
          ...(expand.length ? { expand: expand.join(',') } : {})
        }
      });
    } catch (error) {
      console.error(`Error fetching content with ID "${contentId}":`, error);
      throw error;
    }
  }

  /**
   * Delete content (page, blog post, or attachment)
   * 
   * @param contentId The ID of the content to delete
   * @returns No content on success
   */
  async deleteContent(contentId: string): Promise<void> {
    try {
      await this.request({
        method: 'DELETE',
        url: `/content/${contentId}`,
      });
    } catch (error) {
      console.error(`Error deleting content with ID "${contentId}":`, error);
      throw error;
    }
  }

  /**
   * Get the child content of a page or space (e.g., child pages, attachments, comments)
   * 
   * @param contentId The ID of the parent content
   * @param type The type of children to retrieve ('page', 'blogpost', 'comment', 'attachment')
   * @param expand Optional fields to expand in the response
   * @param limit Optional maximum number of children to return
   * @returns A paginated list of child content
   */
  async getChildContent(
    contentId: string,
    type: 'page' | 'blogpost' | 'comment' | 'attachment',
    expand: string[] = [],
    limit?: number
  ): Promise<ConfluenceContentArray<ConfluencePage>> {
    try {
      return await this.request<ConfluenceContentArray<ConfluencePage>>({
        method: 'GET',
        url: `/content/${contentId}/child/${type}`,
        params: {
          ...(expand.length ? { expand: expand.join(',') } : {}),
          ...(limit ? { limit } : {}),
        }
      });
    } catch (error) {
      console.error(`Error fetching ${type} children of content "${contentId}":`, error);
      throw error;
    }
  }

  /**
   * Get a specific version of content
   * 
   * @param contentId The ID of the content
   * @param versionNumber The version number to retrieve
   * @param expand Optional fields to expand in the response
   * @returns The content at the specified version
   */
  async getContentVersion(
    contentId: string,
    versionNumber: number,
    expand: string[] = []
  ): Promise<ConfluencePage> {
    try {
      return await this.request<ConfluencePage>({
        method: 'GET',
        url: `/content/${contentId}/version/${versionNumber}`,
        params: {
          ...(expand.length ? { expand: expand.join(',') } : {})
        }
      });
    } catch (error) {
      console.error(`Error fetching version ${versionNumber} of content "${contentId}":`, error);
      throw error;
    }
  }

  /**
   * Get watchers of a piece of content
   * 
   * @param contentId The ID of the content to get watchers for
   * @returns List of watchers
   */
  async getContentWatchers(contentId: string): Promise<ContentWatchersResponse> {
    try {
      return await this.request<ContentWatchersResponse>({
        method: 'GET',
        url: `/content/${contentId}/watchers`,
      });
    } catch (error) {
      console.error(`Error fetching watchers of content "${contentId}":`, error);
      throw error;
    }
  }

  /**
   * Check if a user is watching content
   * 
   * @param contentId The ID of the content
   * @param usernameOrKey Optional username or key (defaults to current user)
   * @param isKey Whether the provided identifier is a key (true) or username (false)
   * @returns Information about whether the user is watching the content
   */
  async isWatchingContent(
    contentId: string,
    usernameOrKey?: string,
    isKey: boolean = false
  ): Promise<WatchStatus> {
    try {
      return await this.request<WatchStatus>({
        method: 'GET',
        url: `/user/watch/content/${contentId}`,
        params: {
          ...(usernameOrKey ? (isKey ? { key: usernameOrKey } : { username: usernameOrKey }) : {})
        }
      });
    } catch (error) {
      console.error(`Error checking watch status for content "${contentId}":`, error);
      throw error;
    }
  }

  /**
   * Add a watcher to content
   * 
   * @param contentId The ID of the content to watch
   * @param usernameOrKey Optional username or key (defaults to current user)
   * @param isKey Whether the provided identifier is a key (true) or username (false)
   * @returns Information about the watch status
   */
  async watchContent(
    contentId: string,
    usernameOrKey?: string,
    isKey: boolean = false
  ): Promise<WatchStatus> {
    try {
      return await this.request<WatchStatus>({
        method: 'POST',
        url: `/user/watch/content/${contentId}`,
        params: {
          ...(usernameOrKey ? (isKey ? { key: usernameOrKey } : { username: usernameOrKey }) : {})
        }
      });
    } catch (error) {
      console.error(`Error adding watcher to content "${contentId}":`, error);
      throw error;
    }
  }

  /**
   * Remove a watcher from content
   * 
   * @param contentId The ID of the content to unwatch
   * @param usernameOrKey Optional username or key (defaults to current user)
   * @param isKey Whether the provided identifier is a key (true) or username (false)
   */
  async unwatchContent(
    contentId: string,
    usernameOrKey?: string,
    isKey: boolean = false
  ): Promise<void> {
    try {
      await this.request({
        method: 'DELETE',
        url: `/user/watch/content/${contentId}`,
        params: {
          ...(usernameOrKey ? (isKey ? { key: usernameOrKey } : { username: usernameOrKey }) : {})
        }
      });
    } catch (error) {
      console.error(`Error removing watcher from content "${contentId}":`, error);
      throw error;
    }
  }
}