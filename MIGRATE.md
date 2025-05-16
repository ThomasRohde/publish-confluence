# Migration Plan: Vite/Rollup to esbuild

## Overview

This document outlines the plan to migrate `publish-confluence` from using Vite/Rollup to a simpler approach with TypeScript and esbuild. As a pure Node.js CLI tool, we don't need the full bundling capabilities of Vite or Rollup, and can take advantage of Node.js's native ESM support.

## Current State Analysis

### Project Type
- Pure Node.js CLI application written in TypeScript
- Publishes JavaScript applications to Confluence pages using embedded HTML macros
- Uses ESM modules format

### Current Build Setup
- Uses Vite for bundling the main CLI and library
- Uses TypeScript for type checking and compilation
- Already uses esbuild directly for template scripts (browser-compatible JavaScript)
- Has custom scripts for copying templates and handling assets
- Preserves shebang line in the CLI entrypoint

### Key Dependencies
- TypeScript for type checking and transpilation
- esbuild (already used for template scripts)
- Handlebars for templates
- Commander for CLI parsing
- Various Node.js built-in modules

## Benefits of Migration

1. **Simplified Build Process**: Reduce complexity by using fewer tools
2. **Faster Builds**: esbuild is significantly faster than Vite/Rollup
3. **Better Match for Project Type**: Pure Node.js tools for a Node.js CLI project
4. **Reduced Dependencies**: Fewer dependencies means less maintenance burden
5. **Consistent Tooling**: Use esbuild for all bundling needs (already using it for template scripts)

## Migration Plan

### 1. Create an esbuild Configuration

Create an `esbuild.config.js` file to handle:
- Building the main CLI entry point with preserved shebang line
- Building the library exports
- Generating type definitions
- Preserving source maps

### 2. Update package.json

Update the package.json to:
- Remove Vite/Rollup dependencies
- Add missing esbuild dependencies if needed
- Update build scripts to use esbuild directly
- Update output paths

### 3. Update TypeScript Configuration

Modify tsconfig.json to:
- Focus on type checking rather than transpilation
- Remove Vite-specific configuration
- Ensure proper module resolution for Node.js

### 4. Create a Build Script

Create a unified build script that:
1. Runs TypeScript type checking
2. Bundles the CLI and library with esbuild
3. Runs existing template script bundling (already using esbuild)
4. Copies templates and assets to the output directory

### 5. Create an Executable Helper

Ensure the CLI file is executable on Unix systems by:
- Preserving the shebang line
- Adding proper file permissions

### 6. Update Asset Handling

Simplify the asset copying process by:
- Consolidating all asset copying logic
- Ensuring proper structure in output directory

### 7. Testing Plan

Test the build process to ensure:
- All builds complete successfully
- CLI runs correctly and preserves all functionality
- Types are correctly generated and exported
- Templates and assets are properly copied
- Source maps are generated correctly

## Implementation Steps

1. Create esbuild configuration (esbuild.config.js)
2. Update package.json scripts
3. Update tsconfig.json
4. Test build process
5. Verify CLI functionality
6. Clean up unused files and configurations
7. Document the new build process

## Benefits After Migration

- Simpler, more maintainable build process
- Faster build times
- Cleaner project structure
- Better alignment with Node.js ecosystem
- Reduced dependency footprint
