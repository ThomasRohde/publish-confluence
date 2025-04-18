// src/utils.ts

/**
 * Generate a UUID v4 string
 * @returns A random UUID v4 string
 */
export function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0,
        v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Retry a function with exponential backoff
 * Used for operations that might need multiple attempts to succeed, such as
 * finding a page that was just created or handling race conditions in the Confluence API.
 * 
 * @param fn The function to retry, which returns a Promise
 * @param options Configuration options
 * @param options.maxAttempts Maximum number of retry attempts (default: 3)
 * @param options.initialBackoffMs Initial backoff time in milliseconds (default: 1000)
 * @param options.debug Enable debug logging (default: false)
 * @returns The result of the function call when successful
 * @throws The last error encountered when all attempts fail
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialBackoffMs?: number;
    debug?: boolean;
    retryCondition?: (result: T) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialBackoffMs = 1000,
    debug = false,
    retryCondition
  } = options;
  
  let attempts = 0;
  let lastError: Error | null = null;
  
  while (attempts < maxAttempts) {
    try {
      // If not the first attempt, wait with exponential backoff
      if (attempts > 0) {
        const backoffTime = initialBackoffMs * Math.pow(2, attempts - 1);
        if (debug) {
          console.log(`Waiting ${backoffTime}ms before retry attempt ${attempts + 1}...`);
        }
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
      
      // Attempt the operation
      const result = await fn();
      
      // If a retry condition is specified and returns true, we should retry
      if (retryCondition && retryCondition(result)) {
        if (debug) {
          console.log(`Retry condition returned true on attempt ${attempts + 1}. Will retry.`);
        }
        attempts++;
        continue;
      }
      
      // Otherwise, operation was successful
      return result;
    } catch (error) {
      lastError = error as Error;
      if (debug) {
        console.log(`Attempt ${attempts + 1} failed with error: ${lastError.message}`);
      }
      attempts++;
    }
  }
  
  // If we exhausted all attempts, throw the last error
  throw lastError || new Error('All retry attempts failed');
}