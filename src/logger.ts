// src/logger.ts
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Verbosity levels
export const VERBOSITY = {
  QUIET: 0,
  NORMAL: 1,
  VERBOSE: 2,
  DEBUG: 3
};

// Log level definitions
export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'SUCCESS' | 'VERBOSE' | 'DEBUG';

// Interface for a group of related log messages
export interface LogGroup {
  log: (message: string, level?: LogLevel, context?: any) => void;
  end: () => void;
}

// Default verbosity level
let verbosity = VERBOSITY.NORMAL;

// Log file configuration
let logToFile = false;
let logFilePath = path.join(process.cwd(), 'publish-confluence.log');

// Log buffer for file writes, to reduce disk I/O
const logBuffer: string[] = [];
const MAX_BUFFER_SIZE = 50;
let bufferTimer: NodeJS.Timeout | null = null;

// Cache for isLogLevelEnabled results to avoid repeated calculations
const logLevelEnabledCache: Record<LogLevel, boolean> = {
  'ERROR': true,
  'WARN': true,
  'INFO': true,
  'SUCCESS': true,
  'VERBOSE': false,
  'DEBUG': false
};

/**
 * Update the log level enabled cache when verbosity changes
 */
function updateLogLevelCache(): void {
  logLevelEnabledCache.ERROR = true; // Always enabled
  logLevelEnabledCache.WARN = verbosity >= VERBOSITY.NORMAL;
  logLevelEnabledCache.INFO = verbosity >= VERBOSITY.NORMAL;
  logLevelEnabledCache.SUCCESS = verbosity >= VERBOSITY.NORMAL;
  logLevelEnabledCache.VERBOSE = verbosity >= VERBOSITY.VERBOSE;
  logLevelEnabledCache.DEBUG = verbosity >= VERBOSITY.DEBUG;
}

// Initialize the cache at module load time
updateLogLevelCache();

/**
 * Configure file logging
 * @param enabled - Whether to enable file logging
 * @param filePath - Custom log file path (optional)
 */
export function configureFileLogging(enabled: boolean, filePath?: string): void {
  logToFile = enabled;
  if (filePath) {
    logFilePath = path.resolve(filePath);
  }
  
  // Create log directory if it doesn't exist
  if (enabled) {
    const logDir = path.dirname(logFilePath);
    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (err) {
      console.error(`Failed to create log directory: ${(err as Error).message}`);
    }
  }
  
  // Clear any existing buffer timer when reconfiguring
  if (bufferTimer) {
    clearInterval(bufferTimer);
    bufferTimer = null;
  }
  
  // Flush any remaining logs when disabling
  if (!enabled && logBuffer.length > 0) {
    flushLogBuffer();
  }
  
  // Set up timer for buffer flushing if enabled
  if (enabled && !bufferTimer) {
    bufferTimer = setInterval(flushLogBuffer, 5000); // Flush every 5 seconds
  }
}

/**
 * Flush the log buffer to disk
 */
export function flushLogBuffer(): void {
  if (logBuffer.length === 0) return;
  
  try {
    fs.appendFileSync(logFilePath, logBuffer.join(''));
    logBuffer.length = 0; // Clear the buffer
  } catch (err) {
    console.error(`Failed to flush log buffer to file: ${(err as Error).message}`);
  }
}

/**
 * Set the verbosity level for logging
 * @param level - The verbosity level to set
 */
export function setVerbosityLevel(level: number): void {
  verbosity = level;
  updateLogLevelCache();
}

/**
 * Get the current verbosity level
 * @returns The current verbosity level
 */
export function getVerbosityLevel(): number {
  return verbosity;
}

/**
 * Check if a specific log level is enabled at the current verbosity
 * @param level - The log level to check
 * @returns True if the level is enabled, false otherwise
 */
export function isLogLevelEnabled(level: LogLevel): boolean {
  return logLevelEnabledCache[level];
}

/**
 * Format a log message with contextual information
 * @param message - The log message
 * @param context - Optional contextual information (object, string, etc.)
 * @returns Formatted message with context
 */
function formatMessage(message: string, context?: any): string {
  if (!context) {
    return message;
  }
  
  if (typeof context === 'string') {
    return `${message} | ${context}`;
  }
  
  try {
    const contextStr = JSON.stringify(context, null, 2);
    return `${message}\nContext: ${contextStr}`;
  } catch (e) {
    return `${message}\nContext: [Unable to stringify context]`;
  }
}

/**
 * Get timestamp for log message
 * @returns Formatted timestamp
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Write a message to the log file
 * @param level - Log level (ERROR, WARN, INFO, etc.)
 * @param message - Message to write
 */
function writeToLogFile(level: LogLevel, message: string): void {
  if (!logToFile) return;
  
  try {
    const logEntry = `${getTimestamp()} [${level}] ${message}${os.EOL}`;
    
    // Add to buffer
    logBuffer.push(logEntry);
    
    // Flush the buffer if it exceeds the maximum size
    if (logBuffer.length >= MAX_BUFFER_SIZE) {
      flushLogBuffer();
    }
  } catch (err) {
    console.error(`Failed to write to log buffer: ${(err as Error).message}`);
  }
}

/**
 * Cleanup logging resources when the application exits
 * This ensures all buffered logs are flushed to disk
 */
export function cleanupLogging(): void {
  if (bufferTimer) {
    clearInterval(bufferTimer);
    bufferTimer = null;
  }
  
  if (logToFile && logBuffer.length > 0) {
    flushLogBuffer();
  }
}

/**
 * Shutdown the logger, flushing any pending logs and cleaning up resources.
 * Call this at the end of the application if you want the process to exit cleanly.
 */
export function shutdownLogger(): void {
  cleanupLogging();
  
  // Remove the process event listeners we added
  process.removeListener('exit', cleanupLogging);
  process.removeListener('SIGINT', () => {});
  process.removeListener('SIGTERM', () => {});
}

// Register process exit handlers to ensure logs are flushed
process.on('exit', cleanupLogging);
process.on('SIGINT', () => {
  cleanupLogging();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanupLogging();
  process.exit(0);
});

// Interface representing a logger instance
export interface Logger {
  error: (message: string, context?: any) => void;
  warn: (message: string, context?: any) => void;
  info: (message: string, context?: any) => void;
  success: (message: string, context?: any) => void;
  verbose: (message: string, context?: any) => void;
  debug: (message: string, context?: any) => void;
  
  // Allows logging multiple messages with a single call
  batch: (level: LogLevel, messages: string[]) => void;
  
  // Check if a specific log level is enabled
  isEnabled: (level: LogLevel) => boolean;
  
  // Group related log messages
  group: (name: string, level?: LogLevel) => LogGroup;
}

/**
 * Creates a logger instance with standard logging methods
 * @param useColors - Whether to use colored output (default: true)
 * @param componentName - Optional component name to include in logs (default: '')
 * @returns An object with logging methods
 */
export function createLogger(useColors: boolean = true, componentName: string = ''): Logger {
  const prefix = componentName ? `[${componentName}] ` : '';
  
  // Helper function to create log methods with consistent formatting
  const createLogMethod = (
    level: LogLevel, 
    color: (str: string) => string,
    consoleMethod: 'log' | 'error' | 'warn' = 'log',
    minVerbosity: number = VERBOSITY.NORMAL,
    includeTimestamp: boolean = false
  ) => {
    return (message: string, context?: any): void => {
      // Fast check using cache
      if (!logLevelEnabledCache[level]) return;
      
      // Format the message with prefix and context
      const formattedMessage = formatMessage(`${prefix}${message}`, context);
      
      // Add timestamp if requested
      const timestampPrefix = includeTimestamp ? `[${getTimestamp()}]: ` : '';
      const levelPrefix = level !== 'INFO' && level !== 'SUCCESS' && level !== 'VERBOSE' ? `${level} ${timestampPrefix}` : timestampPrefix;
      
      // Format console message with colors if enabled
      const consoleMessage = useColors 
        ? color(`${levelPrefix}${formattedMessage}`) 
        : `${levelPrefix}${formattedMessage}`;
      
      // Output to console
      console[consoleMethod](consoleMessage);
      
      // Log to file
      writeToLogFile(level, formattedMessage);
    };
  };
  
  return {
    error: createLogMethod('ERROR', chalk.red, 'error', VERBOSITY.QUIET, true),
    warn: createLogMethod('WARN', chalk.yellow, 'warn', VERBOSITY.NORMAL, true),
    info: createLogMethod('INFO', chalk.blue, 'log', VERBOSITY.NORMAL),
    success: createLogMethod('SUCCESS', chalk.green, 'log', VERBOSITY.NORMAL),
    verbose: createLogMethod('VERBOSE', chalk.gray, 'log', VERBOSITY.VERBOSE),
    debug: createLogMethod('DEBUG', chalk.cyan, 'log', VERBOSITY.DEBUG, true),
    
    // Log multiple messages in a batch with the same level
    batch: (level: LogLevel, messages: string[]): void => {
      if (!isLogLevelEnabled(level)) return;
      
      // Instead of creating a new logger each time, use the existing methods directly
      const logMethod = (() => {
        switch(level) {
          case 'ERROR': return createLogMethod('ERROR', chalk.red, 'error', VERBOSITY.QUIET, true);
          case 'WARN': return createLogMethod('WARN', chalk.yellow, 'warn', VERBOSITY.NORMAL, true);
          case 'INFO': return createLogMethod('INFO', chalk.blue, 'log', VERBOSITY.NORMAL);
          case 'SUCCESS': return createLogMethod('SUCCESS', chalk.green, 'log', VERBOSITY.NORMAL);
          case 'VERBOSE': return createLogMethod('VERBOSE', chalk.gray, 'log', VERBOSITY.VERBOSE);
          case 'DEBUG': return createLogMethod('DEBUG', chalk.cyan, 'log', VERBOSITY.DEBUG, true);
          default: return createLogMethod('INFO', chalk.blue, 'log', VERBOSITY.NORMAL);
        }
      })();
      
      // Log each message using the selected method
      messages.forEach(message => logMethod(message));
    },
    
    // Check if a specific log level is enabled
    isEnabled: (level: LogLevel): boolean => {
      return isLogLevelEnabled(level);
    },
    
    // Create a group of related log messages
    group: (name: string, level: LogLevel = 'INFO'): LogGroup => {
      if (!isLogLevelEnabled(level)) {
        // Return a no-op log group if the level is not enabled
        return {
          log: () => {},
          end: () => {}
        };
      }
      
      // Log the group start
      let groupMethod;
      switch(level) {
        case 'ERROR': groupMethod = createLogMethod('ERROR', chalk.red, 'error', VERBOSITY.QUIET, true); break;
        case 'WARN': groupMethod = createLogMethod('WARN', chalk.yellow, 'warn', VERBOSITY.NORMAL, true); break;
        case 'SUCCESS': groupMethod = createLogMethod('SUCCESS', chalk.green, 'log', VERBOSITY.NORMAL); break;
        case 'VERBOSE': groupMethod = createLogMethod('VERBOSE', chalk.gray, 'log', VERBOSITY.VERBOSE); break;
        case 'DEBUG': groupMethod = createLogMethod('DEBUG', chalk.cyan, 'log', VERBOSITY.DEBUG, true); break;
        default: groupMethod = createLogMethod('INFO', chalk.blue, 'log', VERBOSITY.NORMAL);
      }
      
      groupMethod(`=== BEGIN GROUP: ${name} ===`);
      
      return {
        log: (message: string, msgLevel: LogLevel = level, context?: any) => {
          // Use the appropriate log level method
          switch(msgLevel) {
            case 'ERROR': createLogMethod('ERROR', chalk.red, 'error', VERBOSITY.QUIET, true)(`  ${message}`, context); break;
            case 'WARN': createLogMethod('WARN', chalk.yellow, 'warn', VERBOSITY.NORMAL, true)(`  ${message}`, context); break;
            case 'INFO': createLogMethod('INFO', chalk.blue, 'log', VERBOSITY.NORMAL)(`  ${message}`, context); break;
            case 'SUCCESS': createLogMethod('SUCCESS', chalk.green, 'log', VERBOSITY.NORMAL)(`  ${message}`, context); break;
            case 'VERBOSE': createLogMethod('VERBOSE', chalk.gray, 'log', VERBOSITY.VERBOSE)(`  ${message}`, context); break;
            case 'DEBUG': createLogMethod('DEBUG', chalk.cyan, 'log', VERBOSITY.DEBUG, true)(`  ${message}`, context); break;
          }
        },
        end: () => {
          groupMethod(`=== END GROUP: ${name} ===`);
        }
      };
    }
  };
}