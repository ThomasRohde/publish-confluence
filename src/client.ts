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
            this.logger.error('Authentication failed: Invalid credentials or token');
            
            this.logger.info('Possible causes:');
            this.logger.info('1. Invalid API token (expired or malformed)');
            this.logger.info('2. URL domain issues (e.g., using cloud URL for server instance)');
            this.logger.info('3. User lacks permissions for this operation');
            this.logger.info('4. Token scopes may not include the required permissions');
            
            // Only log detailed context in debug mode
            this.logger.debug('Authentication error context:', {
              url: `${this.restApiBase}${resourcePath}`,
              status,
              statusText: error.response.statusText
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
          }          // Handle different status codes according to OpenAPI spec
          switch (status) {
            case 400:
              // Check for XHTML validation errors
              const errorData: any = errorContext.responseData;
              let errorMessage = 'Invalid request parameters';
                // Look for common XHTML error patterns in the response
              if (errorData && typeof errorData === 'object') {
                if (typeof errorData.message === 'string') {
                  // Check for specific XHTML error patterns
                  const isXhtmlError = errorData.message.includes('invalid xhtml') || 
                     errorData.message.includes('Invalid XHTML') ||
                     errorData.message.includes('Error parsing xhtml') ||
                     errorData.message.includes('Error on line') ||
                     errorData.message.includes('must be terminated') ||
                     errorData.message.includes('entity reference') ||
                     errorData.message.includes('Unexpected close tag') ||
                     errorData.message.match(/at \[row,col [^:]*\]:/i);
                     
                  if (isXhtmlError) {
                    // Extract specific error details for better logging
                    const tagMismatchMatch = errorData.message.match(/Unexpected close tag <\/([^>]+)>; expected <\/([^>]+)>/i);
                    const lineColMatch = errorData.message.match(/at \[row,col [^:]*\]: \[(\d+),(\d+)\]/i);
                    
                    const solutions = ['Check for unclosed HTML tags'];
                    let specificError = 'Malformed XHTML content';
                    
                    if (tagMismatchMatch) {
                      const [_, foundTag, expectedTag] = tagMismatchMatch;
                      specificError = `HTML tag mismatch: Found </${foundTag}> when </${expectedTag}> was expected`;
                      
                      solutions.push(`Fix tag nesting issue between <${expectedTag}> and <${foundTag}> tags`);
                      solutions.push('Make sure all HTML tags are properly nested (inner tags must be closed before outer tags)');
                      
                      // Special handling for Confluence macros
                      if (foundTag.startsWith('ac:') || expectedTag.startsWith('ac:')) {
                        solutions.push('Check Confluence macro structure - ensure all macro tags are properly closed');
                      }
                    }
                    
                    const location = lineColMatch ? 
                      `at line ${lineColMatch[1]}, column ${lineColMatch[2]}` : '';
                        // Log a simplified error message without the full error object data
                    // This prevents raw JSON data from appearing in the console
                    const locationStr = lineColMatch ? 
                      `at line ${lineColMatch[1]}, column ${lineColMatch[2]}` : '';
                      
                    this.logger.error(`Malformed XHTML content detected ${locationStr}`);
                    this.logger.error(`Issue: ${specificError}`);
                    
                    // Only log solutions at info level to keep error output clean
                    this.logger.info('Suggestions:');
                    solutions.forEach((solution, index) => {
                      this.logger.info(`  ${index + 1}. ${solution}`);
                    });
                    
                    // Additional common suggestions
                    this.logger.info('  ' + (solutions.length + 1) + '. Ensure special characters are properly escaped');
                    this.logger.info('  ' + (solutions.length + 2) + '. Validate your HTML/XHTML using a checker tool');
                    this.logger.info('  ' + (solutions.length + 3) + '. Make sure HTML entities use the correct format (e.g., &amp; for &)');
                    
                    // Only log the detailed context when in debug mode
                    this.logger.debug('Detailed error context:', {
                      ...errorContext,
                      errorMessage: errorData.message,
                      specificError: specificError,
                      location: lineColMatch ? { line: parseInt(lineColMatch[1]), col: parseInt(lineColMatch[2]) } : undefined
                    });
                    
                    errorMessage = specificError;
                  }
                }
              }
              
              return Promise.reject(new BadRequestError(errorMessage, error));
            case 401:
              // Authentication errors are already logged above
              return Promise.reject(new AuthenticationError('Authentication credentials are invalid', error));
            case 403:
              this.logger.error('Permission denied: You do not have permission to perform this action');
              this.logger.info('Possible solutions:');
              this.logger.info('1. Ensure the user has appropriate permissions in Confluence');
              this.logger.info('2. Check space restrictions and page restrictions');
              this.logger.info('3. Verify token has sufficient scopes');
              
              // Only log detailed context in debug mode
              this.logger.debug('Permission denied error context:', {
                url: errorContext.url,
                method: errorContext.method
              });
              return Promise.reject(new PermissionDeniedError('You do not have permission to perform this action', error));            case 404:
              this.logger.error(`Resource not found: ${resourcePath}`);
              
              // Only log detailed context in debug mode
              this.logger.debug('Not found error context:', {
                url: errorContext.url,
                method: errorContext.method
              });
              
              return Promise.reject(new ResourceNotFoundError('Resource', resourcePath, error));            default:
              this.logger.error(`API request failed with status ${status}: ${error.response?.statusText || 'Unknown error'}`);
              
              // Only log detailed context in debug mode
              this.logger.debug('API error context:', {
                url: errorContext.url,
                method: errorContext.method,
                status: status
              });
              
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
    let error;    switch (status) {
      case 400:
        // Check for XHTML validation errors in the response
        const errorData: any = originalError.response?.data;
        let errorMessage = 'Invalid request parameters';
        
        // Check for XHTML-specific error patterns
        if (errorData && typeof errorData === 'object') {
          if (typeof errorData.message === 'string') {
            if (errorData.message.includes('invalid xhtml') || 
               errorData.message.includes('Invalid XHTML') ||
               errorData.message.includes('Error on line') ||
               errorData.message.includes('must be terminated') ||
               errorData.message.includes('entity reference')) {
              errorMessage = 'Malformed XHTML content';
            }
          }
        }
        
        error = new BadRequestError(errorMessage, originalError);
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

  /**
   * Validates XHTML content before submitting to Confluence
   * 
   * This method performs basic checks on content to identify common XHTML issues
   * before sending to the Confluence API, which can help avoid 400 errors.
   * 
   * @param content XHTML content to validate
   * @returns Object with validation results and any detected issues
   */
  validateXhtml(content: string): { 
    valid: boolean; 
    errors: Array<{ message: string; line?: number; column?: number; suggestion?: string }> 
  } {
    const errors = [];
    
    try {
      // Check for unclosed tags using a simple regex-based approach
      // This is not a complete parser but catches common issues
      const tagStack: string[] = [];
      const tagPattern = /<(\/?)([\w:-]+)[^>]*>/g;
      let selfClosingTags = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
      
      let match;
      let line = 1;
      let lastNewlinePos = 0;
      
      // Track line numbers
      for (let i = 0; i < content.length; i++) {
        if (content[i] === '\n') {
          line++;
          lastNewlinePos = i;
        }
        
        // Reset regex search position
        if (i === 0) {
          tagPattern.lastIndex = 0;
        }
        
        // Find next tag
        if ((match = tagPattern.exec(content)) !== null) {
          i = match.index; // Move main counter to match position
          
          const isClosingTag = match[1] === '/';
          const tagName = match[2].toLowerCase();
          const column = match.index - lastNewlinePos;
          
          if (!isClosingTag) {
            // Opening tag
            if (!selfClosingTags.includes(tagName)) {
              tagStack.push(tagName);
            }
          } else {
            // Closing tag
            if (tagStack.length > 0) {
              const expectedTag = tagStack.pop();
              if (expectedTag !== tagName) {
                errors.push({
                  message: `Mismatched tag: found </${tagName}> but expected </${expectedTag}>`,
                  line,
                  column,
                  suggestion: `Make sure all opening tags have matching closing tags in the right order`
                });
              }
            } else {
              errors.push({
                message: `Unexpected closing tag </${tagName}>`,
                line,
                column,
                suggestion: `Remove this closing tag or add a matching opening tag`
              });
            }
          }
        } else {
          // No more tags
          break;
        }
      }
      
      // Check for unclosed tags
      if (tagStack.length > 0) {
        tagStack.forEach(tag => {
          errors.push({
            message: `Unclosed tag: <${tag}>`,
            suggestion: `Add a closing </${tag}> tag`
          });
        });
      }
      
      // Check for unescaped special characters in content
      const unescapedAmpersand = /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[a-f0-9]+);)/i;
      const ampMatch = unescapedAmpersand.exec(content);
      if (ampMatch) {
        // Count lines up to this point
        let ampLine = 1;
        let lastNewline = 0;
        for (let i = 0; ampMatch.index && i < ampMatch.index; i++) {
          if (content[i] === '\n') {
            ampLine++;
            lastNewline = i;
          }
        }
        
        errors.push({
          message: `Unescaped ampersand (&) found`,
          line: ampLine,
          column: ampMatch.index - lastNewline,
          suggestion: `Replace & with &amp;`
        });
      }
      
      // Check for potential macro issues
      if (content.includes('<ac:') && !content.includes('</ac:')) {
        errors.push({
          message: `Potential unclosed Confluence macro tag`,
          suggestion: `Ensure all Confluence macros have proper opening and closing tags`
        });
      }
    } catch (e) {
      // If our validation code throws an error, report it
      errors.push({
        message: `Validation error: ${e instanceof Error ? e.message : String(e)}`,
        suggestion: `Try validating your content with an external XHTML validator`
      });
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates content for XHTML compliance before sending to Confluence
   * 
   * This utility method can be used to check content for common XHTML errors
   * that would cause Confluence to reject the content with a 400 Bad Request error.
   * It's useful for preprocessing content before submitting it via createPage or updatePage.
   * 
   * @param content The content to validate as Confluence Storage Format (XHTML)
   * @param throwOnError Whether to throw an error if validation fails
   * @returns Validation result with errors and suggestions
   */
  async validateContentForConfluence(
    content: string, 
    throwOnError: boolean = false
  ): Promise<{
    valid: boolean;
    errors: Array<{
      message: string;
      line?: number;
      column?: number;
      suggestion?: string;
    }>;
  }> {
    // Use the internal validation method
    const result = this.validateXhtml(content);
    
    // Log validation results
    if (!result.valid) {
      this.logger.warn(`XHTML validation found ${result.errors.length} issues:`, {
        errorCount: result.errors.length
      });
      
      result.errors.forEach(err => {
        const location = err.line ? ` (Line: ${err.line}${err.column ? `, Column: ${err.column}` : ''})` : '';
        this.logger.warn(`⚠️ XHTML warning: ${err.message}${location}`);
        if (err.suggestion) {
          this.logger.warn(`   Suggestion: ${err.suggestion}`);
        }
      });
      
      // If requested, throw an error with the collected validation issues
      if (throwOnError) {
        const errorMessage = result.errors.map(err => {
          const location = err.line ? ` (Line: ${err.line}${err.column ? `, Column: ${err.column}` : ''})` : '';
          return `- ${err.message}${location}${err.suggestion ? `. Suggestion: ${err.suggestion}` : ''}`;
        }).join('\n');
        
        throw new BadRequestError(`XHTML validation failed:\n${errorMessage}`);
      }
    } else {
      this.logger.debug('XHTML validation successful: No issues found');
    }
    
    return result;
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
      this.logger.error(`Unexpected error during API request: ${errorMessage}`);
      
      // Only log detailed context in debug mode
      this.logger.debug('Request error details:', {
        method: config.method?.toUpperCase() || 'GET',
        url: config.url,
        errorType: error instanceof Error ? error.constructor.name : typeof error
      });
      
      throw new ConfluenceApiError(errorMessage);
    }
  }

  /** Find a page by its title within a specific space */
  async findPageByTitle(spaceKey: string, title: string): Promise<ConfluencePage | null> {
    // Log the search operation with contextual information
    this.logger.debug(`Finding page by title`, {
      spaceKey,
      title,
      operation: 'findPageByTitle'
    });
    
    try {
      // Try direct API approach first - this is more reliable than CQL search
      this.logger.debug(`Using direct API approach to find page`, {
        method: 'GET',
        endpoint: '/content',
        params: { spaceKey, title }
      });
      
      const directResults = await this.request<ConfluenceContentArray<ConfluencePage>>({
        method: 'GET',
        url: '/content',
        params: {
          spaceKey,
          title,
          expand: 'version',
          status: 'current'
        }
      });      if (directResults.results && directResults.results.length > 0) {
        // Page found with direct API method
        if (this.debug) {
          this.logger.debug(`Page found via direct API: "${title}" (ID: ${directResults.results[0].id})`);
        }
        return directResults.results[0];
      }
      
      /*
      // If direct API approach didn't find the page, try CQL search as fallback
      this.logger.debug(`Direct API approach found no results, trying CQL search as fallback`);
      const searchParams = {
        cql: `type=page AND space.key="${spaceKey}" AND title="${title.replace(/"/g, '\\"')}"`,
      };
      
      const cqlResults = await this.request<ConfluenceContentArray<ConfluencePage>>({
        method: 'GET',
        url: '/content/search',
        params: searchParams
      });

      if (cqlResults.results && cqlResults.results.length > 0) {
        // Page found with CQL search
        if (this.debug) {
          this.logger.debug(`Page found via CQL search: "${title}" (ID: ${cqlResults.results[0].id})`);
        }
        return cqlResults.results[0];
      }
      */
      
      // If no results with direct approach, return null
      this.logger.debug(`Page not found: "${title}" in space "${spaceKey}"`);
      if (this.debug) {
        this.logger.debug(`Page not found: "${title}" in space "${spaceKey}"`);
      }
      return null;
    } catch (error) {
      // Log just the essential error information without the full error object
      if (error instanceof Error) {
        this.logger.error(`Error finding page "${title}" in space "${spaceKey}": ${error.message}`);
        // Only log detailed error in debug mode
        this.logger.debug('Find page error details:', { spaceKey, title, errorName: error.name });
      } else {
        this.logger.error(`Error finding page "${title}" in space "${spaceKey}": Unknown error`);
      }
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
      return space.homepage.id;    } catch (error) {
      // Log just the essential error information without the full error object
      if (error instanceof Error) {
        this.logger.error(`Error getting homepage for space "${spaceKey}": ${error.message}`);
        // Only log detailed error in debug mode
        this.logger.debug('Get homepage error details:', { spaceKey, errorName: error.name });
      } else {
        this.logger.error(`Error getting homepage for space "${spaceKey}": Unknown error`);
      }
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
          this.logger.debug(`Page "${title}" not found on attempt ${attempts + 1}. Waiting before retry...`);
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
                this.logger.debug(`Parent page "${parentPageTitle}" not found on attempt ${parentAttempts + 1}. Waiting ${retryDelay}ms before retry...`);
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
            this.logger.debug(`Parent page "${parentPageTitle}" found after ${parentAttempts + 1} attempts.`);
          }
          break;
        } catch (error) {
          // Only retry ResourceNotFoundError, let other errors bubble up immediately
          if (!(error instanceof ResourceNotFoundError) || parentAttempts >= retryCount) {
            throw error;
          }
          
          parentAttempts++;
          
          if (this.debug) {
            this.logger.debug(`Error finding parent page "${parentPageTitle}" (attempt ${parentAttempts}): ${error.message}`);
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
   * 
   * @param pageId - The ID of the page to update
   * @param title - The title of the page
   * @param bodyContent - The content of the page in Confluence Storage Format
   * @param version - The current version number of the page
   * @param updateMessage - Optional message for the page history
   * @returns The updated page
   */  async updatePage(
    pageId: string,
    title: string,
    bodyContent: string,
    version: number,
    updateMessage?: string
  ): Promise<ConfluencePage> {
    try {
      // Validate the XHTML content before submitting to prevent common errors
      const validationResult = this.validateXhtml(bodyContent);
      
      if (!validationResult.valid && this.debug) {
        this.logger.warn(`XHTML validation detected potential issues before update:`, {
          pageId,
          title,
          issues: validationResult.errors.map(err => ({
            message: err.message,
            line: err.line,
            column: err.column,
            suggestion: err.suggestion
          }))
        });
        
        // Only log warnings here, don't block the request
        // This approach allows the user to see validation warnings but still proceed
        validationResult.errors.forEach(err => {
          const location = err.line ? ` (Line: ${err.line}${err.column ? `, Column: ${err.column}` : ''})` : '';
          this.logger.warn(`⚠️ XHTML warning: ${err.message}${location}`);
          if (err.suggestion) {
            this.logger.warn(`   Suggestion: ${err.suggestion}`);
          }
        });
      }
      
      // First, get the latest version of the page to ensure we're using the correct version number
      const latestPage = await this.getContentById(pageId, ['version']);
      const currentVersion = latestPage.version?.number || version;
      
      if (this.debug) {
        this.logger.debug(`Updating page ${pageId}, provided version: ${version}, current version from server: ${currentVersion}`);
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
      return response;    } catch (error) {
      // Log just the essential error information without the full error object
      if (error instanceof Error) {
        this.logger.error(`Error updating page with ID ${pageId}: ${error.message}`);
        // Only log detailed error in debug mode
        this.logger.debug('Update page error details:', { pageId, title, version, errorName: error.name });
      } else {
        this.logger.error(`Error updating page with ID ${pageId}: Unknown error`);
      }
      throw error;
    }
  }

  /**
   * Creates a new page
   */  private async createPage(
    spaceKey: string,
    title: string,
    bodyContent: string,
    parentPageId?: string
  ): Promise<ConfluencePage> {
    try {
      // Validate the XHTML content before submitting to prevent common errors
      const validationResult = this.validateXhtml(bodyContent);
      
      if (!validationResult.valid && this.debug) {
        this.logger.warn(`XHTML validation detected potential issues before page creation:`, {
          title,
          spaceKey,
          issues: validationResult.errors.map(err => ({
            message: err.message,
            line: err.line,
            column: err.column,
            suggestion: err.suggestion
          }))
        });
        
        // Only log warnings, don't block the request
        validationResult.errors.forEach(err => {
          const location = err.line ? ` (Line: ${err.line}${err.column ? `, Column: ${err.column}` : ''})` : '';
          this.logger.warn(`⚠️ XHTML warning: ${err.message}${location}`);
          if (err.suggestion) {
            this.logger.warn(`   Suggestion: ${err.suggestion}`);
          }
        });
      }
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
          this.logger.debug(`Page "${title}" already exists but wasn't found earlier. Retrying with findPageByTitle.`);
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
            this.logger.debug(`Waiting ${backoffTime}ms before retry attempt ${attempts + 1}...`);
          }
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          
          // Try to find the page again
          existingPage = await this.findPageByTitle(spaceKey, title);
          attempts++;
          
          if (existingPage) {
            if (this.debug) {
              this.logger.debug(`Page found on attempt ${attempts}. Updating instead of creating.`);
            }
            // Page now found, update it instead
            return this.updatePage(
              existingPage.id,
              title,
              bodyContent,
              existingPage.version?.number ?? 1
            );
          } else if (this.debug && attempts < maxAttempts) {
            this.logger.debug(`Page still not found after attempt ${attempts}. Retrying...`);
          }
        }
        
        if (!existingPage) {
          this.logger.error(`Unable to find existing page "${title}" after ${maxAttempts} attempts despite Confluence reporting it exists.`);
        }      }

      // Log just the essential error information without the full error object
      if (error instanceof Error) {
        this.logger.error(`Error creating page "${title}" in space ${spaceKey}: ${error.message}`);
        // Only log detailed error in debug mode
        this.logger.debug('Create page error details:', { spaceKey, title, parentPageId, errorName: error.name });
      } else {
        this.logger.error(`Error creating page "${title}" in space ${spaceKey}: Unknown error`);
      }
      
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
      
      return response.results;    } catch (error) {
      // Log just the essential error information without the full error object
      if (error instanceof Error) {
        this.logger.error(`Error listing attachments for page ${pageId}: ${error.message}`);
        // Only log detailed error in debug mode
        this.logger.debug('List attachments error details:', { pageId, errorName: error.name });
      } else {
        this.logger.error(`Error listing attachments for page ${pageId}: Unknown error`);
      }
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
          this.logger.debug(`Attachment ${fileName} already exists (ID: ${existingAttachment.id}). Deleting it before creating a new version.`);
        }
        
        // Delete the existing attachment
        await this.deleteContent(existingAttachment.id);

        if (this.debug) {
          this.logger.debug(`Existing attachment deleted. Creating new version.`);
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
        // Log just essential error information
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to upload attachment ${path.basename(filePath)} to page ${pageId}: ${errorMsg}`);
      
      // Only log detailed context in debug mode
      this.logger.debug('Attachment upload error context:', {
        fileName: path.basename(filePath),
        fileSize,
        pageId,
        errorType: error instanceof Error ? error.name : 'unknown'
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
      });    } catch (error) {
      // Log just the essential error information without the full error object
      if (error instanceof Error) {
        this.logger.error(`Error executing search query "${cqlQuery}": ${error.message}`);
        // Only log detailed error in debug mode
        this.logger.debug('Search error details:', { query: cqlQuery, errorName: error.name });
      } else {
        this.logger.error(`Error executing search query "${cqlQuery}": Unknown error`);
      }
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
      });    } catch (error) {
      // Log just the essential error information without the full error object
      if (error instanceof Error) {
        this.logger.error(`Error fetching server information: ${error.message}`);
        // Only log detailed error in debug mode
        this.logger.debug('Server info error details:', { errorName: error.name });
      } else {
        this.logger.error('Error fetching server information: Unknown error');
      }
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
      });    } catch (error) {
      // Log just the essential error information without the full error object
      if (error instanceof Error) {
        this.logger.error(`Error fetching spaces: ${error.message}`);
        // Only log detailed error in debug mode
        this.logger.debug('Get spaces error details:', { 
          params: Object.keys(params).length ? params : 'none',
          expand: expand.length ? expand : 'none',
          errorName: error.name
        });
      } else {
        this.logger.error('Error fetching spaces: Unknown error');
      }
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
      });    } catch (error) {
      // Log just the essential error information without the full error object
      if (error instanceof Error) {
        this.logger.error(`Error fetching space with key "${spaceKey}": ${error.message}`);
        // Only log detailed error in debug mode
        this.logger.debug('Get space error details:', { spaceKey, errorName: error.name });
      } else {
        this.logger.error(`Error fetching space with key "${spaceKey}": Unknown error`);
      }
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
      this.logger.error(`Error creating space with key "${key}":`, error);
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
      this.logger.error(`Error updating space with key "${spaceKey}":`, error);
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
      this.logger.error(`Error archiving space with key "${spaceKey}":`, error);
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
      this.logger.error(`Error restoring space with key "${spaceKey}":`, error);
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
      this.logger.error(`Error deleting space with key "${spaceKey}":`, error);
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
      this.logger.error('Error fetching current user information:', error);
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
      this.logger.error(`Error fetching user "${usernameOrKey}":`, error);
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
      this.logger.error('Error fetching users:', error);
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
      this.logger.error(`Error fetching groups for user "${usernameOrKey}":`, error);
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
      this.logger.error(`Error fetching content with ID "${contentId}":`, error);
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
      this.logger.error(`Error deleting content with ID "${contentId}":`, error);
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
      this.logger.error(`Error fetching ${type} children of content "${contentId}":`, error);
      throw error;
    }
  }

  /**
   * Get child pages of a specific page
   * 
   * @param pageId The ID of the parent page
   * @param expand Optional fields to expand in the response
   * @returns Array of child pages
   */
  async getChildPages(pageId: string, expand: string[] = []): Promise<ConfluencePage[]> {
    try {
      const result = await this.getChildContent(pageId, 'page', expand);
      return result.results || [];
    } catch (error) {
      this.logger.error(`Error fetching child pages of page "${pageId}":`, error);
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
      this.logger.error(`Error fetching version ${versionNumber} of content "${contentId}":`, error);
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
      this.logger.error(`Error fetching watchers of content "${contentId}":`, error);
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
      this.logger.error(`Error checking watch status for content "${contentId}":`, error);
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
      this.logger.error(`Error adding watcher to content "${contentId}":`, error);
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
      this.logger.error(`Error removing watcher from content "${contentId}":`, error);
      throw error;
    }
  }
}