// src/errors.ts
import { AxiosError } from 'axios';
import { ConfluenceApiErrorData, ConfluenceXhtmlValidationError, RestError } from './types';

/**
 * Base error class for Confluence API errors
 */
export class ConfluenceApiError extends Error {
  public readonly statusCode?: number;
  public readonly statusText?: string;
  public readonly apiErrorData?: RestError | ConfluenceApiErrorData | Record<string, unknown>; // Support RestError schema
  public requestPath?: string;
  public responseData?: any;
  public url?: string;
  public method?: string;

  constructor(message: string, error?: AxiosError) {
    super(message);
    this.name = 'ConfluenceApiError';
    if (error?.response) {
      this.statusCode = error.response.status;
      this.statusText = error.response.statusText;
      
      // Attempt to parse Confluence's specific error structure
      if (typeof error.response.data === 'object' && error.response.data !== null) {
         const data = error.response.data as Record<string, unknown>;
         
         // Type guard function to check if the data matches RestError structure
         function isRestError(obj: any): obj is RestError {
             return obj &&
                    typeof obj.message === 'string' &&
                    typeof obj.statusCode === 'number';
         }
         
         if (isRestError(data)) {
             this.apiErrorData = data;
             this.message = `Confluence API Error (${this.statusCode}): ${data.message}`;
         } else {
             this.apiErrorData = data; // Keep original if structure differs
             this.message = `Confluence API Error (${this.statusCode}): ${this.statusText || 'Unknown error'}`;
         }
      } else {
         this.message = `Confluence API Error (${this.statusCode}): ${this.statusText || error.message}`;
      }
    } else if (error?.request) {
      // Request was made but no response received
      this.message = `Confluence API Error: No response received from server. ${error.message}`;
    } else {
      // Something happened in setting up the request
      this.message = `Confluence API Error: Request setup failed. ${error?.message || message}`;
    }

    // Maintain stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfluenceApiError);
    }
  }
}

/**
 * Error thrown when a resource is not found (HTTP 404)
 */
export class ResourceNotFoundError extends ConfluenceApiError {
  constructor(resourceType: string, identifier: string, error?: AxiosError) {
    super(`${resourceType} not found: ${identifier}`, error);
    this.name = 'ResourceNotFoundError';
  }
}

/**
 * Error thrown when permission is denied (HTTP 403)
 */
export class PermissionDeniedError extends ConfluenceApiError {
  constructor(message: string, error?: AxiosError) {
    super(`Permission denied: ${message}`, error);
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Error thrown when authentication fails (HTTP 401)
 */
export class AuthenticationError extends ConfluenceApiError {
  constructor(message: string = 'Authentication failed', error?: AxiosError) {
    super(message, error);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown for bad requests (HTTP 400)
 */
export class BadRequestError extends ConfluenceApiError {
  public xhtmlErrors?: ConfluenceXhtmlValidationError[];

  constructor(message: string, error?: AxiosError) {
    super(`Bad Request: ${message}`, error);
    this.name = 'BadRequestError';

    // Process XHTML validation errors if they exist
    this.processXhtmlValidationErrors(error);
  }

  /**
   * Process and extract XHTML validation errors from Confluence API response
   * 
   * @param error - The original Axios error with response data
   */
  private  processXhtmlValidationErrors(error?: AxiosError): void {
    if (!error?.response?.data) return;
    
    try {
      const responseData = error.response.data as Record<string, any>;
      
      // Handle common Confluence XHTML error patterns
      if (typeof responseData === 'object' && responseData !== null) {
        // Extract structured error messages from response
        const extractedErrors: ConfluenceXhtmlValidationError[] = [];
          // Check for validation message patterns in message field
        if (typeof responseData.message === 'string') {
          // Handle specific error patterns
          const lineErrorRegex = /Error on line (\d+)(?:, column (\d+))?(.*?)(?::|$)/i;
          const tagErrorRegex = /The element type ["']?([^\s"']+)["']? must be terminated/i;
          const entityErrorRegex = /The entity name must immediately follow the '&' in the entity reference/i;
          
          // New patterns for Confluence-specific error messages
          const unexpectedTagRegex = /Unexpected close tag <\/([^>]+)>; expected <\/([^>]+)>/i;
          const rowColRegex = /at \[row,col [^:]*\]: \[(\d+),(\d+)\]/i;
          
          const lineMatch = responseData.message.match(lineErrorRegex);
          const tagMatch = responseData.message.match(tagErrorRegex);
          const unexpectedTagMatch = responseData.message.match(unexpectedTagRegex);
          const rowColMatch = responseData.message.match(rowColRegex);
          
          // Confluence XHTML parsing error with unexpected/expected tags
          if (unexpectedTagMatch) {
            const unexpectedTag = unexpectedTagMatch[1];
            const expectedTag = unexpectedTagMatch[2];
            let line, column;
            
            // Extract line and column if available
            if (rowColMatch) {
              line = parseInt(rowColMatch[1], 10);
              column = parseInt(rowColMatch[2], 10);
            }
            
            extractedErrors.push({
              line,
              column,
              tagName: unexpectedTag,
              message: `Tag mismatch: Found closing tag </${unexpectedTag}> when </${expectedTag}> was expected. This usually means your HTML tags are not properly nested.`,
              rawMessage: responseData.message
            });
          }
          // Standard line/column error format
          else if (lineMatch) {
            extractedErrors.push({
              line: parseInt(lineMatch[1], 10),
              column: lineMatch[2] ? parseInt(lineMatch[2], 10) : undefined,
              message: this.formatXhtmlErrorMessage(responseData.message),
              rawMessage: responseData.message
            });
          } 
          // Unclosed tag errors
          else if (tagMatch) {
            extractedErrors.push({
              tagName: tagMatch[1],
              message: `Unclosed HTML tag: <${tagMatch[1]}>. Make sure all tags are properly closed.`,
              rawMessage: responseData.message
            });
          } 
          // Entity reference errors
          else if (entityErrorRegex.test(responseData.message)) {
            extractedErrors.push({
              message: `Invalid HTML entity found. Ensure all '&' characters that are not part of entities are escaped as '&amp;'.`,
              rawMessage: responseData.message
            });
          }
          // Row/column information without other matches
          else if (rowColMatch) {
            extractedErrors.push({
              line: parseInt(rowColMatch[1], 10),
              column: parseInt(rowColMatch[2], 10),
              message: this.formatXhtmlErrorMessage(responseData.message),
              rawMessage: responseData.message
            });
          }
          // General XHTML errors
          else if (responseData.message.includes('invalid xhtml') || 
                   responseData.message.includes('Invalid XHTML') ||
                   responseData.message.includes('Error parsing xhtml')) {
            extractedErrors.push({
              message: this.formatXhtmlErrorMessage(responseData.message),
              rawMessage: responseData.message
            });
          }
        }
        
        // Check for errors array in standard API error response
        if (Array.isArray(responseData.errors)) {
          responseData.errors.forEach((err: any) => {
            if (err && typeof err === 'object' && typeof err.message === 'string') {
              extractedErrors.push({
                message: this.formatXhtmlErrorMessage(err.message),
                rawMessage: err.message
              });
            }
          });
        }

        // If errors were found, set them on the error object
        if (extractedErrors.length > 0) {
          this.xhtmlErrors = extractedErrors;
          
          // Enhance the error message with structured information
          let enhancedMessage = 'Malformed XHTML content detected:\n';
          this.xhtmlErrors.forEach((err, index) => {
            enhancedMessage += `\n${index + 1}. ${err.message}`;
            if (err.line) {
              enhancedMessage += ` (Line: ${err.line}${err.column ? `, Column: ${err.column}` : ''})`;
            }
            if (err.tagName) {
              enhancedMessage += ` - Tag: <${err.tagName}>`;
            }
          });
            enhancedMessage += '\n\nSuggested solutions:';
          
          // Add tag-specific solutions for tag mismatch errors
          const hasMismatchedTags = this.xhtmlErrors.some(err => 
            err.tagName && err.message && err.message.includes('Tag mismatch')
          );
          
          const hasEntityErrors = this.xhtmlErrors.some(err => 
            err.message && (err.message.includes('entity') || err.message.includes('ampersand'))
          );
          
          const hasConfluenceMacros = this.xhtmlErrors.some(err => 
            err.rawMessage && (err.rawMessage.includes('ac:') || err.rawMessage.includes('ri:'))
          );
          
          // Add common solutions
          enhancedMessage += '\n- Ensure all HTML tags are properly closed';
          
          // Add specific solutions based on error types
          if (hasMismatchedTags) {
            enhancedMessage += '\n- Fix tag nesting: HTML tags must be properly nested (e.g., <outer><inner></inner></outer>)';
            enhancedMessage += '\n- Consider using a tool like HTML Tidy to fix your HTML structure';
            
            // Look for specific tag combinations to provide targeted advice
            const confluenceMacroTags = this.xhtmlErrors
              .filter(err => err.tagName && (err.tagName.startsWith('ac:') || err.tagName.startsWith('ri:')))
              .map(err => err.tagName);
              
            if (confluenceMacroTags.length > 0) {
              enhancedMessage += '\n- Check your Confluence macro structure. Common patterns:';
              enhancedMessage += '\n  * <ac:structured-macro>...</ac:structured-macro>';
              enhancedMessage += '\n  * <ac:layout-section><ac:layout-cell>...</ac:layout-cell></ac:layout-section>';
              enhancedMessage += '\n  * <ac:parameter>...</ac:parameter> must be inside a macro';
            }
          }
          
          // Add entity-specific solutions
          if (hasEntityErrors) {
            enhancedMessage += '\n- Replace special characters with HTML entities:';
            enhancedMessage += '\n  * & must be written as &amp;';
            enhancedMessage += '\n  * < must be written as &lt;';
            enhancedMessage += '\n  * > must be written as &gt;';
            enhancedMessage += '\n  * " must be written as &quot; in attributes';
          }
          
          // Add general solutions
          enhancedMessage += '\n- Remove any invalid or unrecognized HTML attributes';
          
          // Add Confluence-specific solutions
          if (hasConfluenceMacros) {
            enhancedMessage += '\n- Ensure Confluence macros follow the required structure:';
            enhancedMessage += '\n  * Check the documentation for proper macro syntax';
            enhancedMessage += '\n  * Verify all macro tags are properly closed';
            enhancedMessage += '\n  * Avoid mixing HTML and macro tags incorrectly';
          }
          
          this.message = enhancedMessage;
        }
      }
    } catch (parseError) {
      // Fallback if there's an error processing the XHTML errors
      console.error('Error processing XHTML validation errors:', parseError);
    }
  }

  /**
   * Format XHTML error messages to be more human-readable
   * 
   * @param message - The original error message
   * @returns A more user-friendly error message
   */  private formatXhtmlErrorMessage(message: string): string {
    // Remove technical jargon and clarify common error messages
    let formattedMessage = message
      .replace(/^invalid xhtml:\s*/i, '')
      .replace(/^Invalid XHTML:\s*/i, '')
      .replace(/^Error parsing xhtml:\s*/i, '')
      .replace(/^Error on line \d+(, column \d+)?:\s*/i, '')
      .replace(/^[Oo]rg\.xml\.[^:]+:\s*/i, '')
      .replace(/\s*at \[row,col [^\]]+\]:\s*\[\d+,\d+\]/i, '') // Remove the row,col section
      .trim();
    
    // Translate common XML error messages to more understandable language
    if (formattedMessage.includes('must be terminated by the matching end-tag')) {
      return 'Unclosed HTML tag detected. Check that all tags have closing tags.';
    } else if (formattedMessage.includes('The entity name must immediately follow')) {
      return 'Invalid HTML entity or unescaped ampersand (&). Use &amp; for literal ampersands.';
    } else if (formattedMessage.includes('element type "html" must be terminated')) {
      return 'The document structure is invalid. Make sure the content is valid XHTML.';
    } else if (formattedMessage.includes('The reference to entity')) {
      return 'Invalid HTML entity reference. Use standard HTML entities like &amp;, &lt;, &gt;, etc.';
    } else if (formattedMessage.includes('not allowed in content')) {
      return 'Invalid character found. Some special characters must be escaped in HTML.';
    } else if (formattedMessage.includes('not well-formed')) {
      return 'The HTML is not properly formed. Check for mismatched or unclosed tags.';
    } else if (formattedMessage.match(/Unexpected close tag <\/[^>]+>; expected <\/[^>]+>/i)) {
      const unexpectedMatch = formattedMessage.match(/Unexpected close tag <\/([^>]+)>; expected <\/([^>]+)>/i);
      if (unexpectedMatch) {
        const [_, foundTag, expectedTag] = unexpectedMatch;
        return `HTML tag nesting error: Found closing tag </${foundTag}> when </${expectedTag}> was expected. Check your tag nesting order.`;
      }
      return 'Mismatched HTML tags. Make sure your opening and closing tags are properly nested.';
    } else if (formattedMessage.includes('Error parsing')) {
      return 'XHTML parsing error. Check for syntax issues in your HTML content.';
    }
    
    return formattedMessage || 'Invalid XHTML content';
  }
}