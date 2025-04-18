// src/logger.ts
import chalk from 'chalk';

// Verbosity levels
export const VERBOSITY = {
  QUIET: 0,
  NORMAL: 1,
  VERBOSE: 2,
  DEBUG: 3
};

// Default verbosity level
let verbosity = VERBOSITY.NORMAL;

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
 * Creates a logger instance with standard logging methods
 * @param useColors - Whether to use colored output (default: true)
 * @returns An object with logging methods
 */
export function createLogger(useColors: boolean = true) {
  return {
    error: (message: string) => console.error(useColors ? chalk.red(`ERROR: ${message}`) : `ERROR: ${message}`),
    info: (message: string) => {
      if (verbosity >= VERBOSITY.NORMAL) {
        console.log(useColors ? chalk.blue(message) : message);
      }
    },
    success: (message: string) => {
      if (verbosity >= VERBOSITY.NORMAL) {
        console.log(useColors ? chalk.green(message) : message);
      }
    },
    verbose: (message: string) => {
      if (verbosity >= VERBOSITY.VERBOSE) {
        console.log(useColors ? chalk.gray(message) : message);
      }
    },
    debug: (message: string) => {
      if (verbosity >= VERBOSITY.DEBUG) {
        console.log(useColors ? chalk.yellow(`DEBUG: ${message}`) : `DEBUG: ${message}`);
      }
    }
  };
}