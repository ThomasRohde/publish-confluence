# Post-Processor Implementation Plan

## Overview

This document outlines the plan for extending the `publish-confluence` tool with post-processing capabilities to transform Confluence storage format content into various formats like Markdown or enhanced Handlebars templates.

## Core Requirements

1. Add an option `--process <processor>` to perform post-processing of fetched Confluence storage format files
2. Implement a post-processor framework in `./src/post-processor/`
3. Support plugin-like architecture to add different processor types
4. All processors must convert Confluence structures and macros to supported Handlebars helpers

## Implementation Details

### 1. Directory Structure

```
src/
└── post-processor/
    ├── index.ts                  // Main exports for the post-processor module
    ├── types.ts                  // Interfaces and types for processors
    ├── base-processor.ts         // Abstract base processor class
    ├── processor-factory.ts      // Factory for creating processors
    ├── handlebars-processor.ts   // Default processor for Handlebars
    └── markdown-processor.ts     // Example processor for Markdown conversion
```

### 2. Type Definitions (`types.ts`)

Key interfaces to define:

```typescript
export interface PostProcessorOptions {
  // Common options for all processors
  spaceKey: string;
  pageId: string;
  pageTitle: string;
  macroPrefix?: string;
  // Additional processor-specific options
  [key: string]: unknown;
}

export interface ProcessorResult {
  content: string;
  outputExtension: string;
  metadata?: Record<string, unknown>;
}

export interface PostProcessor {
  readonly name: string;
  readonly outputExtension: string;
  process(content: string, options: PostProcessorOptions): Promise<ProcessorResult>;
}

// Update existing FetchOptions interface
export interface ExtendedFetchOptions extends FetchOptions {
  processor?: string;
  processorOptions?: Record<string, unknown>;
}
```

### 3. Base Processor (`base-processor.ts`)

Create an abstract base class with common functionality:

```typescript
export abstract class BasePostProcessor implements PostProcessor {
  abstract readonly name: string;
  abstract readonly outputExtension: string;

  // Common methods for all processors
  protected convertConfluenceMacros(content: string): string {
    // Common macro conversion logic
    // e.g., convert ac:structured-macro to {{> macroName}}
  }

  // Abstract method to be implemented by specific processors
  abstract process(content: string, options: PostProcessorOptions): Promise<ProcessorResult>;
}
```

### 4. Concrete Processors

#### Default Handlebars Processor (`handlebars-processor.ts`)

```typescript
export class HandlebarsProcessor extends BasePostProcessor {
  readonly name = 'handlebars';
  readonly outputExtension = 'hbs';

  async process(content: string, options: PostProcessorOptions): Promise<ProcessorResult> {
    // Transform Confluence storage format to Handlebars template
    // 1. Parse XML with xmldom
    // 2. Convert Confluence macros to Handlebars helpers
    // 3. Return processed content
  }
}
```

#### Markdown Processor Example (`markdown-processor.ts`)

```typescript
export class MarkdownProcessor extends BasePostProcessor {
  readonly name = 'markdown';
  readonly outputExtension = 'md';

  async process(content: string, options: PostProcessorOptions): Promise<ProcessorResult> {
    // Transform Confluence storage format to Markdown
    // 1. Parse XML with xmldom
    // 2. Convert HTML elements to Markdown using remark/unified
    // 3. Convert Confluence macros to appropriate Markdown or Handlebars helpers
    // 4. Return processed content
  }
}
```

### 5. Processor Factory (`processor-factory.ts`)

```typescript
export class ProcessorFactory {
  private static processors: Map<string, new () => PostProcessor> = new Map();

  static register(name: string, processorClass: new () => PostProcessor): void {
    ProcessorFactory.processors.set(name.toLowerCase(), processorClass);
  }

  static createProcessor(name: string): PostProcessor {
    const ProcessorClass = ProcessorFactory.processors.get(name.toLowerCase());
    if (!ProcessorClass) {
      throw new Error(`Post-processor "${name}" not found. Available processors: ${Array.from(ProcessorFactory.processors.keys()).join(', ')}`);
    }
    return new ProcessorClass();
  }

  static getAvailableProcessors(): string[] {
    return Array.from(ProcessorFactory.processors.keys());
  }
}

// Register default processors
ProcessorFactory.register('handlebars', HandlebarsProcessor);
ProcessorFactory.register('markdown', MarkdownProcessor);
```

### 6. Integration with Fetch Command

#### 6.1. Update Interface for Fetch Options

Extend the fetch options in `types.ts`:

```typescript
export interface FetchOptions {
  // ...existing options
  processor?: string;
  processorOptions?: Record<string, unknown>;
}
```

#### 6.2. Modify `fetchPageAndChildren` Function

Add post-processing step in the `fetchPageAndChildren` function:

```typescript
// After getting pageContent but before writing to file
let contentToSave = pageContent;
let fileExtension = 'html';
let relativeFileExtension = 'html';

if (options.processor) {
  log.verbose(`Post-processing content with "${options.processor}" processor...`);
  
  try {
    const processor = ProcessorFactory.createProcessor(options.processor);
    const result = await processor.process(contentToSave, {
      spaceKey,
      pageId: page.id,
      pageTitle,
      ...options.processorOptions
    });
    
    contentToSave = result.content;
    
    // Update file extension if needed
    if (processor.outputExtension !== 'html') {
      fileExtension = processor.outputExtension;
      relativeFileExtension = processor.outputExtension;
      
      pagePath = pagePath.replace(/\.html$/, `.${fileExtension}`);
      relativeTemplatePath = relativeTemplatePath.replace(/\.html$/, `.${relativeFileExtension}`);
    }
    
    log.verbose(`Post-processing complete. Output format: ${fileExtension}`);
  } catch (error) {
    log.error(`Post-processing failed: ${(error as Error).message}`);
    log.debug((error as Error).stack || 'No stack trace available');
    // Continue with original content if processing fails
  }
}
```

#### 6.3. Update CLI Options

Add the processor option to the CLI interface in the main command file.

### 7. Dependencies

The following existing dependencies in esbuild.config.js will be utilized:

- xmldom - For XML parsing of Confluence storage format
- handlebars - For template processing
- rehype-raw - For HTML processing
- remark, remark-gfm, remark-parse, remark-rehype - For Markdown processing
- unified - For processing pipelines
- unist-util-visit - For AST traversal

## Implementation Phases

> **Note:** Update these task lists whenever progress is made to track completion status.

### Phase 1: Core Framework
- [x] Create directory structure
- [x] Implement types and interfaces
- [x] Create base processor class
- [x] Implement processor factory
- [x] Update CLI command options

### Phase 2: Default Processors
- [x] Implement Handlebars processor (default)
- [x] Implement Markdown processor example

### Phase 3: Integration
- [x] Integrate with fetch command
- [x] Update file handling to support different extensions
- [x] Add processor options handling
- [x] Update documentation in README.md and Page-5.hbs

### Phase 4: Testing and Refinement
- [x] Test with real Confluence content. Do not create test cases yet but collaborate with the team to gather real-world examples.
- [x] Refine macro conversion
- [ ] Optimize performance

## Future Enhancements

- [ ] Support for processor-specific configuration files
- [ ] Pipeline processors (chain multiple processors)
- [ ] Custom output templates for specific processors
- [ ] Plugin system for third-party processors

## Commands for Testing

```powershell
# Test with default handlebars processor
node dist/cli.js fetch --space-key MYSPACE --page-title "My Page" --process handlebars

# Test with markdown processor
node dist/cli.js fetch --space-key MYSPACE --page-title "My Page" --process markdown

# Using with child pages
node dist/cli.js fetch --space-key MYSPACE --page-title "My Page" --children --process markdown
```
