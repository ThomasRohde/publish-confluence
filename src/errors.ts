// src/errors.ts
import { AxiosError } from 'axios';
import { ConfluenceApiErrorData, RestError } from './types';

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
  constructor(message: string, error?: AxiosError) {
    super(`Bad Request: ${message}`, error);
    this.name = 'BadRequestError';
  }
}