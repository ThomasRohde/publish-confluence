The primary issue identified in the `log.txt` is that when attempting to update an existing page (after an initial creation attempt fails due to the page already existing), the `pageId` becomes `undefined`. This subsequently causes all attachment uploads to fail with a 404 error because the API endpoint for attachments is constructed as `/content/undefined/child/attachment`.

This problem originates from how "page already exists" errors (HTTP 400) are handled between `publisher.ts` and `client.ts`.

**Root Cause Analysis:**

1.  When `publishToConfluence` in `publisher.ts` initializes `ConfluenceClient`, it provides a `customErrorHandler`.
2.  If `client.ts` attempts to create a page (`POST /content`) and receives a 400 error indicating the page already exists:
    *   The Axios error interceptor in `client.ts` catches this.
    *   It calls the `customErrorHandler` from `publisher.ts`.
    *   The current `customErrorHandler` in `publisher.ts`, upon identifying this specific "page already exists" error (using `isPageAlreadyExistsError`), logs a verbose message and then **returns `true`**.
    *   Returning `true` from `customErrorHandler` signals to the Axios interceptor in `client.ts` that the error was "handled." The interceptor then resolves the promise with a dummy object: `Promise.resolve({ data: { _handledError: true, ... } })`.
3.  This dummy object is then returned by the `client.request` call within `client.ts`'s `createPage` method.
4.  The `createPage` method (and subsequently `upsertPage` and `handlePageUpsert`) then treats this dummy object as a valid `ConfluencePage` object.
5.  Since this dummy object lacks an `id` property, `page.id` becomes `undefined` in `publisher.ts` when `handlePageUpsert` returns.
6.  This `undefined` page ID is then used for attachment uploads, leading to the 404 errors.

The internal logic within `client.ts`'s `createPage` method *already* has a `catch` block designed to handle the "page already exists" `BadRequestError`. This catch block attempts to find the page again (with retries) and then update it. This internal mechanism is the correct place to manage this scenario. The `customErrorHandler` in `publisher.ts` inadvertently bypasses this by resolving the promise prematurely.

**The Fix:**

The `customErrorHandler` in `publisher.ts` should be modified. When it detects the "page already exists" error, it should still log the verbose message but must **return `false`**. This will allow the `BadRequestError` to be re-thrown by the Axios interceptor in `client.ts`. The `catch` block within `client.ts`'s `createPage` method will then correctly intercept this error and execute its logic to find and update the existing page, returning a proper `ConfluencePage` object with a valid `id`.

Additionally, the top-level `catch` block in `publisher.ts`'s `publishToConfluence` function, which has a special `if (isPageAlreadyExistsError(error))` condition, should be reviewed. If a "page already exists" error propagates all the way to this top-level catch, it means the internal attempts in `client.ts` to convert the "create" operation into an "update" have failed (e.g., `findPageByTitle` still couldn't find the page after retries). In such a case, the operation was *not* successful, and the current success message logged by this block would be misleading. This block should be removed or treat the error as a genuine failure.

**Step-by-Step Fix:**

1.  **Modify `src/publisher.ts` -> `isPageAlreadyExistsError` function:**
    *   Ensure robust type checking for the error object and its properties.
2.  **Modify `src/publisher.ts` -> `customErrorHandler` (within `publishToConfluence` function):**
    *   When `isPageAlreadyExistsError(error)` is true:
        *   Log the verbose message as it currently does.
        *   **Change `return true;` to `return false;`**. This is the critical change.
    *   Adjust how `error.apiErrorData.message` is accessed for logging to be safer (e.g., using optional chaining or type casting).
3.  **Modify `src/publisher.ts` -> `publishToConfluence` function's main `catch (error: any)` block:**
    *   Remove the `if (isPageAlreadyExistsError(error)) { ... }` block. If an error (including "page already exists") reaches this top-level catch, it signifies a failure in the publishing process that wasn't resolved by internal retries/fallbacks in `client.ts`. It should be handled by the general error logging that follows.

```markdown
# Fix for Attachment Uploads on Existing Pages

This document outlines the steps to fix the issue where updating existing Confluence pages with attachments fails due to an `undefined` page ID.

## 1. Modify `isPageAlreadyExistsError` function in `src/publisher.ts`

Update the `isPageAlreadyExistsError` function for better type safety and correct property access.

**File:** `src/publisher.ts`

```typescript
// src/publisher.ts
import fs from 'fs/promises';
import Handlebars from 'handlebars';
import path from 'path';
import { ConfluenceClient } from './client';
import { loadConfiguration } from './config';
// Add this import:
import { ConfluenceApiError } from './errors';
import { createLogger } from './logger';
import { ConfluenceApiCredentials, PublishConfig, PublishOptions } from './types';
import { generateUuid } from './utils';

// ... (other code) ...

/**
 * Check if an error is a "page already exists" error that should be suppressed
 * because the page was ultimately published successfully
 * 
 * @param error - The error object to check
 * @returns True if this is a "page already exists" error that can be suppressed
 */
function isPageAlreadyExistsError(error: any): boolean {
  // Ensure error is an instance of ConfluenceApiError or its subclasses
  if (!(error instanceof ConfluenceApiError)) {
    return false;
  }
  // Now we know error is ConfluenceApiError, so statusCode and apiErrorData are available
  const apiError = error as ConfluenceApiError;

  // Check if apiErrorData and its message property exist and match
  // Safely access the message property, as apiErrorData can be a generic object
  const message = (apiError.apiErrorData as any)?.message;

  return (
    apiError.statusCode === 400 &&
    typeof message === 'string' &&
    message.includes('A page with this title already exists')
  );
}

// ... (rest of the file) ...
```

## 2. Modify `customErrorHandler` in `src/publisher.ts`

In the `publishToConfluence` function, locate the `ConfluenceClient` initialization. Modify the `customErrorHandler` to return `false` when a "page already exists" error is detected. This allows `client.ts` to handle the error appropriately.

**File:** `src/publisher.ts` (inside the `publishToConfluence` function)

```typescript
// ... (inside publishToConfluence function) ...
    // Create client with customized error handling for page already exists errors
    const { auth, baseUrl } = getAuthCredentials();
    const client = new ConfluenceClient({
      baseUrl,
      auth,
      verbose: options.verbose || options.debug,
      rejectUnauthorized: !options.allowSelfSigned,
      // Custom error handler to suppress "page already exists" errors in the output
      customErrorHandler: (error) => {
        // If this is a "page already exists" error, log it as verbose instead of error
        if (isPageAlreadyExistsError(error)) {
          // Cast error to ConfluenceApiError to safely access properties
          const apiError = error as ConfluenceApiError;
          const errorMessage = (apiError.apiErrorData as any)?.message || 'Page already exists';
          
          log.verbose('Page already exists but was not found by initial search. The client will attempt to find and update it.', {
            originalMessage: errorMessage,
            status: apiError.statusCode
          });
          // CRITICAL CHANGE: Return false to allow the error to propagate.
          // This enables client.ts's internal logic in createPage() to handle it.
          return false; 
        }
        // For any other error, let the default handler in client.ts manage it.
        return false; 
      }
    });
// ... (rest of the function) ...
```

## 3. Modify the Main `catch` Block in `publishToConfluence` in `src/publisher.ts`

Remove the special handling for `isPageAlreadyExistsError` from the top-level `catch` block. If this error propagates to the top, it means the internal attempts to convert "create" to "update" (in `client.ts`) failed, and thus the operation was not successful.

**File:** `src/publisher.ts` (at the end of the `publishToConfluence` function)

```typescript
// ... (inside publishToConfluence function) ...
  } catch (error: any) {
    // REMOVE OR COMMENT OUT THE FOLLOWING BLOCK:
    /*
    // Check if this is a "page already exists" error that we can handle gracefully
    if (isPageAlreadyExistsError(error)) {
      // This is a special case where the page already exists but wasn't initially found
      // The page was ultimately published, so we'll just show a success message
      const apiError = error as ConfluenceApiError; // Cast for type safety
      const errorMessage = (apiError.apiErrorData as any)?.message || 'Page already exists error occurred';
      log.verbose('Detected a "page already exists" error, but the page was successfully published through internal fallbacks.', {
        message: errorMessage,
        status: apiError.statusCode
      });
      
      log.success('All pages published successfully despite initial page existence conflict.');
      return;
    }
    */
    
    // For all other errors (including "page already exists" if client.ts retries failed), 
    // provide detailed error information
    const errorType = error.constructor ? error.constructor.name : 'Unknown Error';
    // Ensure apiErrorData and its message are accessed safely if error is ConfluenceApiError
    let detailedMessage = error.message;
    if (error instanceof ConfluenceApiError && error.apiErrorData && (error.apiErrorData as any).message) {
        detailedMessage = (error.apiErrorData as any).message;
    }

    const errorContext = {
      errorType,
      originalErrorMessage: error.message, // Keep the original JS error message
      confluenceApiMessage: (error instanceof ConfluenceApiError) ? detailedMessage : null,
      troubleshootingSteps: determineTroubleshootingSteps(error),
      stack: error.stack || 'No stack trace available',
      options, // These are the command line options
      timestamp: new Date().toISOString(),
      statusCode: error.statusCode || error.status || null,
      apiPath: (error instanceof ConfluenceApiError) ? error.requestPath : (error.path || null),
      requestInfo: (error instanceof ConfluenceApiError && error.method && error.url) ? {
        method: error.method,
        url: error.url
      } : null,
    };
    
    log.error(`Failed to publish to Confluence: ${error.message}`, errorContext);
    process.exit(1);
  }
}
```

**Explanation of Changes:**

*   **`isPageAlreadyExistsError`:** Made more robust by explicitly checking if the `error` is an instance of `ConfluenceApiError` and safely accessing the nested `message` property from `apiErrorData`.
*   **`customErrorHandler`:** The key change is `return false;` when a "page already exists" error occurs. This allows the `BadRequestError` to be thrown and caught by the `createPage` method in `client.ts`. The `createPage` method already contains logic to retry finding the page and then updating it.
*   **Main `catch` block in `publishToConfluence`:** By removing the special `if (isPageAlreadyExistsError(error))` condition, we ensure that if the "page already exists" error propagates all the way up, it's treated as a genuine failure. This is correct because if `client.ts`'s internal retries to find and update the page failed, the overall operation was indeed unsuccessful. The error logging has also been slightly enhanced for clarity.

These changes will ensure that the `pageId` is correctly obtained when a page creation attempt transitions to an update, allowing attachments to be uploaded successfully. If the internal retries in `client.ts` to find the page (after Confluence reports it exists) still fail, the process will now correctly report an error.