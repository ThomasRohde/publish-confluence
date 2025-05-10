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

## Best Practices

- Favor composition over inheritance.
- Avoid side effects in utility functions; keep them pure where possible.
- Use dependency injection for testability.
- Write unit tests for all core logic (where applicable).
- Document all configuration options and environment variables in the README.

## Templates and Assets

- Use Handlebars for all page and macro templates.
- Support custom templates and assets per project.
- Attach JavaScript build assets to Confluence pages as required.

## Security

- Never log or expose authentication credentials.
- Validate all user input and configuration.
- Handle API errors gracefully and provide actionable feedback.

## Documentation

- Keep the README up to date with usage, configuration, and troubleshooting sections.
- Document all public APIs and exported types with JSDoc.

---

> These instructions are automatically included in every Copilot chat for this workspace. For more details, see `.github/instructions.md`.
