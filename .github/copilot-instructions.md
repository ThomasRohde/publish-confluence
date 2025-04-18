# GitHub Copilot Instructions for publish-confluence

This document provides guidance for GitHub Copilot when assisting with the publish-confluence project, a tool for publishing JavaScript applications to Confluence pages with embedded HTML macros.

## Project Overview

publish-confluence is a TypeScript Node.js project that:
- Creates Confluence pages with embedded HTML macros
- Attaches JavaScript build assets to the page
- Uses templates for customizing page and macro content
- Manages Confluence API communication

## Key Components

### 1. ConfluenceClient (`client.ts`)
- Handles all API communication with Confluence
- Methods for page operations, attachment handling, and content management
- Authentication and error handling

### 2. CLI Tool (`cli.ts`)
- Command-line interface using Commander
- Configuration loading and validation
- Template processing with Handlebars
- File scanning using globby
- Main publish workflow

### 3. Type Definitions (`types.ts`)
- Interface definitions for Confluence API objects
- Configuration and options types

### 4. Error Handling (`errors.ts`)
- Custom error classes for different API error scenarios

## Code Style Guidelines

When modifying or extending this codebase:

1. Use TypeScript features appropriately
   - Strong typing for all functions and variables
   - Interface-based design for data structures
   - Type guards where appropriate

2. Follow existing patterns
   - Method and property naming conventions
   - Error handling approach
   - Logging methodology

## Additional Context

- The project uses environment variables for authentication
- Templates use Handlebars syntax
- File matching uses globby patterns
- The tool is designed to "upsert" pages (create or update)
- We are running on Windows 11 using PowerShell. Do NOT use '&&' (double ampersand) syntax for chaining commands in the CLI tool, use ';' (semi-colon) for chaining commands.
