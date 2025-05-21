---
mode: "agent"                   
description: "Author or update Copilot instruction/prompt files with best-practice structure"
tools: ["codebase"]             
---

# Goal
Create **or** update the file at `${input:targetFile}` so it conforms to GitHub Copilot’s documented formats.

## Workflow

1. **If the file exists**:
   * Read its YAML front-matter & body (`#codebase`).
   * Preserve unchanged sections unless the user explicitly requests edits.

2. **If the file is new**:
   * Choose extension:
     * `*.prompt.md` for standalone chat prompts.
     * `*.instructions.md` for reusable instruction snippets.
     * `copilot-instructions.md` (root) for repo-wide defaults.

3. **Construct front-matter** (always top of file):
  * **For prompt files** (`*.prompt.md`) include:     
    * `mode`: `ask` (default), `edit`, or `agent`.
    * `description`: one short line (≤ 120 chars).
    * Optional `tools` (array) – ignored in *ask* / *edit* modes.

  * **For instruction files** (`*.instructions.md`) include:
    * `applyTo`: glob(s) that auto-attach the file (use `"**"` to always apply).

4. **Body template** (after a blank line):
   * The main content of the prompt in Markdown format.
   * Supports all Markdown formatting including headings, lists, code blocks.
   * Can reference other prompt/instruction files using Markdown links.
   * `## Context` – link to docs/specs the model should read.
   * `## Rules / Requirements` – bullet points, each a single imperative rule.
   * `## Validation checklist` – Markdown - [ ] list for humans.

5. **Variables & interpolation**:
   * Reference variables using `${variableName}` syntax in prompt content.
   * **Workspace variables**:
     * `${workspaceFolder}` - Full path to workspace root
     * `${workspaceFolderBasename}` - Name of workspace folder
   * **Selection variables**:
     * `${selection}`, `${selectedText}` - Currently selected text
   * **File context variables**:
     * `${file}` - Full path to current file
     * `${fileBasename}` - Current file name with extension
     * `${fileDirname}` - Directory containing current file
     * `${fileBasenameNoExtension}` - Current file name without extension 
   * **Input variables**:
     * `${input:variableName}` - Prompt for value when running prompt
     * `${input:variableName:placeholder}` - Value with placeholder text
   * **Transformations**:
     * Support transforms like `${input:routeName^Pascal}` (PascalCase)

6. **Placement & settings**:
   * Prompt files live in `.github/prompts` (or any folder listed in
     `chat.promptFilesLocations`). Enable with `"chat.promptFiles": true`.
   * Instruction files live in `.github/instructions` (or
     `chat.instructionsFilesLocations`). Enable with
     `"github.copilot.chat.codeGeneration.useInstructionFiles": true`.
   * Repo-wide `copilot-instructions.md` is always injected when the above
     setting is on.

7. **Validation** – before returning, confirm:
   * YAML parses.
   * All variables in the body are declared in `inputSchema`.
   * No trailing whitespace; line-wrap at 120 chars.

8. **Output** – respond with the complete, ready-to-save file surrounded by
   triple-backticks and the relative path on the first line, e.g.:

   ```markdown
   <!-- .github/instructions/secure.handlers.instructions.md -->
   ---
   applyTo: "**/*.ts"
   ---
   ## Rules
   - Never log plaintext access tokens …
   
9. **Ask follow-ups** only when information is missing (language, scope, etc.).