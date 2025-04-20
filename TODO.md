## 1. Actionable Code Quality Improvements

Here is a list of instructions to improve the code quality of the `thomasrohde-publish-confluence` project. Apply these changes sequentially.

1.  **Instruction for LLM:** Install and configure ESLint and Prettier for the project. Use `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` for TypeScript support. Integrate `eslint-config-prettier` to avoid conflicts. Set up rules for consistent code style, error prevention (e.g., `no-unused-vars`, `no-explicit-any`), and best practices.
    *   **Files:** `package.json`, create `.eslintrc.json`, `.prettierrc.json` (or configure in `package.json`).

2.  **Instruction for LLM:** Install Husky and lint-staged. Configure a pre-commit hook using Husky that runs lint-staged. Configure lint-staged to run ESLint (`eslint --fix`) and Prettier (`prettier --write`) on staged `*.ts` files before each commit.
    *   **Files:** `package.json`, create `.husky/pre-commit`, create `.lintstagedrc.json` (or configure in `package.json`).

3.  **Instruction for LLM:** Review the Vite configuration (`vite.config.ts`) and ensure path aliases defined in `tsconfig.json` (`@/*`) are correctly mapped using `resolve.alias` in the Vite config. Update any existing relative imports (`../`, `../../`) in the `src/` directory to use the `@/` alias for better readability and maintainability.
    *   **Files:** `vite.config.ts`, all `*.ts` files in `src/`.

4.  **Instruction for LLM:** Enhance the development script in `package.json`. Modify the `dev` script to use `tsc --build --watch` alongside `vite build --watch`. This enables TypeScript's incremental compilation for faster rebuilds during development.
    *   **Files:** `package.json`.

5.  **Instruction for LLM:** Implement a basic testing structure using a framework like Vitest or Jest. Add initial unit tests for core utility functions (`src/utils.ts`) and configuration loading (`src/config.ts`). Ensure tests can be run via `npm test`.
    *   **Files:** `package.json`, create test configuration file (e.g., `vitest.config.ts`), create test files (e.g., `src/utils.test.ts`, `src/config.test.ts`).

6.  **Instruction for LLM:** Refactor the `src/client.ts` module. If it contains multiple responsibilities (e.g., authentication, page operations, attachment operations), break it down into smaller, more focused modules (e.g., `src/auth.ts`, `src/page-operations.ts`, `src/attachment-operations.ts`). Update imports accordingly.
    *   **Files:** `src/client.ts`, create new files as needed, update importing files.

7.  **Instruction for LLM:** Refactor the `src/publisher.ts` module. Identify distinct steps in the publishing process (e.g., finding files, reading templates, compiling templates, interacting with the Confluence client) and extract them into separate functions or smaller helper modules to improve readability and testability.
    *   **Files:** `src/publisher.ts`, create new files/functions as needed, update importing files.

8.  **Instruction for LLM:** Introduce barrel files (`index.ts`) in key subdirectories within `src/` (e.g., `src/project-templates/index.ts`, potentially `src/components/` if UI components were added later) to simplify imports and create clearer public APIs for those modules. Update imports across the project to use these barrel files where appropriate.
    *   **Files:** Create `index.ts` files in relevant subdirectories, update imports in `*.ts` files.

9.  **Instruction for LLM:** Review the logging implementation in `src/logger.ts` and its usage throughout the codebase. Ensure consistent use of logging levels (debug, verbose, info, warn, error). Add more contextual information to log messages, especially in error paths within `src/client.ts` and `src/publisher.ts`, to aid troubleshooting.
    *   **Files:** `src/logger.ts`, `src/client.ts`, `src/publisher.ts`, `src/cli.ts`, other `*.ts` files using the logger.

10. **Instruction for LLM:** Set up GitHub Dependabot or Snyk integration for the repository to automatically monitor dependencies for security vulnerabilities and suggest updates. Configure it to check npm dependencies based on `package.json`.
    *   **Files:** Create `.github/dependabot.yml` or configure via repository settings/Snyk UI.

---

## 2. Actionable New Feature Todos

Here is a list of actionable TODOs for new features, formatted as instructions for an LLM coding agent. You should be able to take any individual TODO and provide it to the agent.

1.  **Instruction for LLM:** Implement support for adding Confluence page labels when publishing.
    *   Add a `labels: string[]` option to the `publish-confluence.json` configuration schema (`src/config.ts`, `src/types.ts`).
    *   Update the `ConfluenceClient` (`src/client.ts`) to include the labels when creating or updating a page using the appropriate Confluence REST API endpoint (likely requires adding labels via a separate call or as part of the update payload).
    *   Update the `Publisher` (`src/publisher.ts`) to read the labels from the config and pass them to the client.
    *   Add documentation for the new `labels` configuration option in `README.md`.

2.  **Instruction for LLM:** Add validation for Handlebars templates (`templatePath` and `macroTemplatePath`) before attempting to publish.
    *   In `src/publisher.ts`, before rendering, use the Handlebars API (`Handlebars.parse()` or similar) to check the syntax of the template files specified in the configuration.
    *   If validation fails, report a user-friendly error message indicating the file and the syntax error, and prevent the publishing process from continuing.
    *   Log the validation step using the logger (`src/logger.ts`).

3.  **Instruction for LLM:** Implement support for passing custom parameters to the Confluence HTML macro.
    *   Define a way to specify macro parameters in `publish-confluence.json`, perhaps as an object `macroParameters: { [key: string]: string }`. Update the config schema (`src/config.ts`, `src/types.ts`).
    *   Modify the `Publisher` (`src/publisher.ts`) or `macro-helpers.ts` where the HTML macro storage format is generated. Add an `<ac:parameter ac:name="paramName">paramValue</ac:parameter>` element within the `<ac:structured-macro>` for each parameter defined in the config.
    *   Update the `README.md` to document how to define and use macro parameters. Explain that these parameters can be accessed within the macro's JavaScript via `AP.confluence.getMacroData()`.

4.  **Instruction for LLM:** Add a command-line flag (e.g., `--skip-attachments`) to allow publishing page content updates without re-uploading asset files.
    *   Modify `src/cli.ts` to add the new option using `commander`.
    *   Update the `Publisher` (`src/publisher.ts`) logic. If the flag is present, skip the steps related to finding, uploading, and linking attachments (JS/CSS files specified in the macro template). Only update the page content using the compiled page template.
    *   Ensure the `{{{macro}}}` variable in the page template still renders correctly, potentially rendering the existing macro content if attachments are skipped (this might require fetching the existing macro content first or making assumptions).
    *   Document the new flag in `README.md`.

5.  **Instruction for LLM:** Implement concurrent attachment uploads to potentially speed up publishing for projects with many assets.
    *   In `src/client.ts` or a dedicated attachment handler, modify the attachment upload logic. Instead of uploading files sequentially in a loop, use `Promise.all` or a similar concurrency pattern (perhaps with a limit using a library like `p-limit`) to upload multiple files simultaneously.
    *   Ensure error handling correctly aggregates results from concurrent uploads.
    *   Add logging (`src/logger.ts`) to indicate concurrent uploads are being used and report progress/completion.

6.  **Instruction for LLM:** Add a `--preview` command-line flag that compiles the page and macro templates with the provided data (config, file lists) and prints the resulting Confluence storage format to the console without actually publishing to Confluence.
    *   Modify `src/cli.ts` to add the `--preview` option.
    *   In the main execution flow (likely in `src/cli.ts` or `src/index.ts`), detect the `--preview` flag.
    *   If present, run the core logic from `src/publisher.ts` to gather data, find files, and compile the page template (including the macro content).
    *   Instead of calling the `ConfluenceClient` to publish, print the final compiled page content (storage format) to standard output.
    *   Ensure logging indicates that preview mode is active and no changes will be made to Confluence.
    *   Document the new flag in `README.md`.

7.  **Instruction for LLM:** Add more project templates to the `create` command.
    *   Define interfaces/classes for new templates (e.g., Svelte, Angular) in `src/project-templates/` following the pattern in `project-template-interface.ts`.
    *   Implement the `createFiles` method for each new template, providing basic starter files (e.g., `package.json`, build config, sample component, `publish-confluence.json`, basic HTML templates).
    *   Update `src/project-templates/project-type-choices.ts` and `src/project-creator.ts` to include the new template options in the interactive prompts.
    *   Add sample projects for the new templates under the `samples/` directory.
    *   Update `README.md` to list the newly supported project types.