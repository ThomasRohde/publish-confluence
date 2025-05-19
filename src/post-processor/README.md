# Post-Processor Module

This module provides a framework for transforming Confluence storage format content into various formats like Markdown or enhanced Handlebars templates.

## Architecture

The post-processor module follows a plugin-based architecture:

- `BasePostProcessor`: Abstract base class with common functionality for all processors
- `ProcessorFactory`: Central registry for processor classes and instantiation
- Type definitions for processor options, results, and interfaces

## Usage

Use the post-processor with the fetch command:

```powershell
# Basic usage with handlebars processor
node dist/cli.js fetch --space-key MYSPACE --page-title "My Page" --process handlebars

# With additional processor options
node dist/cli.js fetch --space-key MYSPACE --page-title "My Page" --process markdown --processor-options '{"includeAttachments":true}'
```

## Implementation Status

### Phase 1: Core Framework ✅
- [x] Directory structure
- [x] Type definitions
- [x] Base processor class
- [x] Processor factory
- [x] CLI command options

### Phase 2: Default Processors (Coming Soon)
- [ ] Handlebars processor (default)
- [ ] Markdown processor example

### Phase 3 & 4: Integration and Testing (Future)
- [ ] Full integration with fetch command
- [ ] Unit tests and validation 
- [ ] Performance optimization

## Extension

To create a custom processor:

1. Create a new class that extends `BasePostProcessor`
2. Implement the required abstract properties and methods
3. Register the processor with `ProcessorFactory.register()`

```typescript
import { BasePostProcessor, ProcessorFactory } from '../post-processor';

class MyCustomProcessor extends BasePostProcessor {
  readonly name = 'mycustom';
  readonly outputExtension = 'custom';
  
  async process(content, options) {
    // Custom processing logic
    return {
      content: processedContent,
      outputExtension: this.outputExtension
    };
  }
}

// Register the processor
ProcessorFactory.register('mycustom', MyCustomProcessor);
```
