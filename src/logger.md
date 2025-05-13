// filepath: c:\Users\thoma\Projects\publish-confluence\src\logger.md
# Logger Module Documentation

## Overview

The Logger module provides standardized logging functionality for the publish-confluence tool. It includes:

- Configurable verbosity levels (QUIET, NORMAL, VERBOSE, DEBUG)
- Console output with color-coding
- Buffered file logging with automatic flushing
- Context-aware formatting
- Log groups for related operations
- Batch logging capabilities
- Memoized log level checks for performance

## Features

- **Buffered File Logging**: Log messages are buffered and written to disk periodically to improve performance
- **Color-Coded Output**: Console output uses colors for better readability
- **Context Support**: Logs can include structured context data
- **Component Prefixing**: Loggers can be created with component name prefixes
- **Type Safety**: TypeScript interfaces ensure consistent usage
- **Performance Optimized**: Uses caching and buffering to minimize overhead
- **Log Groups**: Group related log messages together for better organization
- **Batch Logging**: Log multiple messages with a single call
- **Proper Cleanup**: Resources are properly cleaned up when the application exits

## Usage

### Basic Usage

```typescript
import { createLogger } from './logger';

const log = createLogger();

log.info('Application starting');
log.success('Operation completed');
log.error('An error occurred', { code: 500, message: 'Server error' });
```

### Component-Specific Logger

```typescript
import { createLogger } from './logger';

const log = createLogger(true, 'ConfigLoader');

log.info('Loading configuration'); // Outputs: [ConfigLoader] Loading configuration
```

### Using Log Groups

```typescript
import { createLogger } from './logger';

const log = createLogger();

// Create a group for related operations
const group = log.group('Asset Processing');

group.log('Starting asset processing');
// ... do work ...
group.log('Processed 5 assets', 'SUCCESS');
group.log('Failed to process 1 asset', 'WARN', { assetId: 123, reason: 'Invalid format' });
group.end(); // Ends the group with a closing marker
```

### Batch Logging

```typescript
import { createLogger } from './logger';

const log = createLogger();

// Log multiple messages with the same level
log.batch('INFO', [
  'Starting application',
  'Loading configuration',
  'Initializing services'
]);
```

### Checking Log Level Before Expensive Operations

```typescript
import { createLogger } from './logger';

const log = createLogger();

// Only perform expensive operations if the level is enabled
if (log.isEnabled('DEBUG')) {
  const debugData = generateExpensiveDebugData();
  log.debug('Debug data', debugData);
}
```

### Configuring File Logging

```typescript
import { configureFileLogging, flushLogBuffer } from './logger';

// Enable logging to the default file (publish-confluence.log)
configureFileLogging(true);

// Enable logging to a custom file
configureFileLogging(true, './logs/custom.log');

// Force immediate flush of log buffer to disk
flushLogBuffer();
```

### Setting Verbosity Level

```typescript
import { setVerbosityLevel, VERBOSITY } from './logger';

// Only show errors
setVerbosityLevel(VERBOSITY.QUIET);

// Show everything including debug information
setVerbosityLevel(VERBOSITY.DEBUG);
```

## Optimization Details

The logger implements several optimizations:

1. **File I/O Buffering**: Instead of writing each log message to disk immediately, messages are collected in a buffer and written in batches.

2. **Log Level Caching**: Log level checks are cached to avoid repeated calculations.

3. **Conditional Evaluation**: Log messages are only formatted and processed if the current verbosity level allows that type of message.

4. **Code Reuse**: The implementation uses factory functions to avoid duplicate code across different log levels.

5. **Proper Resource Cleanup**: The module ensures that all buffered logs are flushed when the application exits.

6. **Directory Creation**: The log directory is automatically created if it doesn't exist.

7. **Exit Handling**: Proper handling of process exit events ensures logs are saved.
