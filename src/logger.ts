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

// Default verbosity level
let verbosity = VERBOSITY.NORMAL;

// Log file configuration
let logToFile = false;
let logFilePath = path.join(process.cwd(), 'publish-confluence.log');

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
}

/**
 * Set the verbosity level for logging
 * @param level - The verbosity level to set
 */
export function setVerbosityLevel(level: number): void {
  verbosity = level;
}

/**
 * Get the current verbosity level
 * @returns The current verbosity level
 */
export function getVerbosityLevel(): number {
  return verbosity;
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
function writeToLogFile(level: string, message: string): void {
  if (!logToFile) return;
  
  try {
    const logEntry = `${getTimestamp()} [${level}] ${message}${os.EOL}`;
    fs.appendFileSync(logFilePath, logEntry);
  } catch (err) {
    console.error(`Failed to write to log file: ${(err as Error).message}`);
  }
}

/**
 * Creates a logger instance with standard logging methods
 * @param useColors - Whether to use colored output (default: true)
 * @param componentName - Optional component name to include in logs (default: '')
 * @returns An object with logging methods
 */
export function createLogger(useColors: boolean = true, componentName: string = '') {
  const prefix = componentName ? `[${componentName}] ` : '';
    return {
    error: (message: string, context?: any) => {
      const formattedMessage = formatMessage(`${prefix}${message}`, context);
      const consoleMessage = useColors 
        ? chalk.red(`ERROR [${getTimestamp()}]: ${formattedMessage}`) 
        : `ERROR [${getTimestamp()}]: ${formattedMessage}`;
      console.error(consoleMessage);
      
      // Always log errors to file regardless of verbosity level
      writeToLogFile('ERROR', formattedMessage);
    },
    
    warn: (message: string, context?: any) => {
      if (verbosity >= VERBOSITY.NORMAL) {
        const formattedMessage = formatMessage(`${prefix}${message}`, context);
        const consoleMessage = useColors 
          ? chalk.yellow(`WARN [${getTimestamp()}]: ${formattedMessage}`) 
          : `WARN [${getTimestamp()}]: ${formattedMessage}`;
        console.warn(consoleMessage);
        
        // Log warnings to file
        writeToLogFile('WARN', formattedMessage);
      }
    },
    
    info: (message: string, context?: any) => {
      if (verbosity >= VERBOSITY.NORMAL) {
        const formattedMessage = formatMessage(`${prefix}${message}`, context);
        const consoleMessage = useColors 
          ? chalk.blue(`${formattedMessage}`) 
          : formattedMessage;
        console.log(consoleMessage);
        
        // Log info messages to file when verbosity is appropriate
        writeToLogFile('INFO', formattedMessage);
      }
    },
    
    success: (message: string, context?: any) => {
      if (verbosity >= VERBOSITY.NORMAL) {
        const formattedMessage = formatMessage(`${prefix}${message}`, context);
        const consoleMessage = useColors 
          ? chalk.green(`${formattedMessage}`) 
          : formattedMessage;
        console.log(consoleMessage);
        
        // Log success messages to file
        writeToLogFile('SUCCESS', formattedMessage);
      }
    },
    
    verbose: (message: string, context?: any) => {
      if (verbosity >= VERBOSITY.VERBOSE) {
        const formattedMessage = formatMessage(`${prefix}${message}`, context);
        const consoleMessage = useColors 
          ? chalk.gray(`${formattedMessage}`) 
          : formattedMessage;
        console.log(consoleMessage);
        
        // Only log verbose messages to file at verbosity levels that display them
        writeToLogFile('VERBOSE', formattedMessage);
      }
    },
      debug: (message: string, context?: any) => {
      if (verbosity >= VERBOSITY.DEBUG) {
        const formattedMessage = formatMessage(`${prefix}${message}`, context);
        const consoleMessage = useColors 
          ? chalk.cyan(`DEBUG [${getTimestamp()}]: ${formattedMessage}`) 
          : `DEBUG [${getTimestamp()}]: ${formattedMessage}`;
        console.log(consoleMessage);
        
        // Log debug messages to file when in debug mode
        writeToLogFile('DEBUG', formattedMessage);
      }
    }
  };
}