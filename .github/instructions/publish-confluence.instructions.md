---
applyTo: "**/*"
---

# GitHub Copilot Instructions for publish-confluence

## Project Overview

**publish-confluence** is a TypeScript Node.js CLI tool for publishing JavaScript applications to Confluence pages using embedded HTML macros. It supports upserting pages, attaching build assets, and customizing content via Handlebars templates.

## Coding Standards

- Use **TypeScript** for all source code.
- Prefer `const` and `readonly` for immutability.
- Use **strong typing** everywhere: always annotate function parameters, return types, and variables.
- Use **interface-based design** for data structures and API objects.
- Use **type guards** where appropriate for runtime type safety.
- Follow existing naming conventions:
  - PascalCase for types, interfaces, and classes
  - camelCase for variables, functions, and methods
  - ALL_CAPS for constants
- Keep functions and methods small and focused; single responsibility principle.
- Use async/await for asynchronous code; avoid callbacks and promise chains.
- Handle all errors explicitly; use custom error classes from `errors.ts` for API and workflow errors.
- Use the logging utilities in `logger.ts` for all output; do not use `console.log` directly.
- Use environment variables for authentication and sensitive configuration.
- Write clear, concise comments and JSDoc for all public APIs and complex logic.
- Remove unused code and dependencies regularly.

## Project Structure Guidelines

- **ConfluenceClient (`client.ts`)**: All Confluence API communication, including authentication, page/attachment operations, and error handling.
- **CLI Tool (`cli.ts`)**: Command-line interface using Commander, configuration loading, template processing (Handlebars), file scanning (globby), and main publish workflow.
- **Type Definitions (`types.ts`)**: All interfaces and types for Confluence API, configuration, and options.
- **Error Handling (`errors.ts`)**: Custom error classes for API and workflow errors.
- **Templates**: Use Handlebars syntax for all templates. Keep templates modular and reusable.
- **File Matching**: Use globby patterns for file discovery and asset selection.

## CLI and Platform

- The CLI must support Windows 11 and PowerShell. **Chain commands with `;` (semicolon), not `&&`**.
- All CLI options and arguments must be validated and provide helpful error messages.

## Error Handling Patterns

- Use the specific custom error classes from `errors.ts` based on error conditions:
  - `ConfluenceApiError`: Base class for all API-related errors
  - `AuthenticationError`: For credential/authorization issues (HTTP 401)
  - `PermissionDeniedError`: For permission issues (HTTP 403)
  - `ResourceNotFoundError`: For missing resources (HTTP 404)
  - `BadRequestError`: For invalid requests (HTTP 400), including XHTML validation errors
- Include detailed context in error messages.
- Log errors with appropriate levels (`logger.error`, `logger.warn`).
- Use try/catch blocks around async operations.
- Handle XHTML validation errors with specific suggestions for fixing content.
- Implement graceful degradation when possible.

## Logging Best Practices

- Use the logger from `logger.ts` with appropriate levels:
  - `error`: For critical failures requiring immediate attention
  - `warn`: For issues that should be noted but don't prevent operation
  - `info`: For general operational information
  - `success`: For successful operations
  - `verbose`: For detailed operational information
  - `debug`: For development debugging
- Include a component name when creating loggers: `createLogger(true, 'ComponentName')`
- Use structured context objects for additional data: `log.error('Failed to process', { reason, code })`

## Security Considerations

- Never log complete authentication tokens; use truncation: `token.substring(0, 5) + '...'`
- Validate all user inputs before use in API calls or file operations
- Use environment variables for sensitive configuration
- Follow principle of least privilege in API requests
- Handle certificate verification appropriately (default secure, option to bypass for dev)

## Documentation

- Keep the README up to date with usage, configuration, and troubleshooting sections.
- If the the options in `cli.ts` change, update the README and the CLI help text in `page-5.hbs`.
