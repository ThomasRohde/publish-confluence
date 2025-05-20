---
mode: "edit"                   
description: "Author or update Copilot instruction/prompt files with best-practice structure"
tools: ["codebase"]             
inputSchema:
  targetFile:
    description: |
      Relative path (from workspace root) of the file to create or update.
      Use `.github/prompts/*.prompt.md` for prompt templates or
      `.github/instructions/*.instructions.md` for scoped instructions.
    default: ".github/prompts/new-template.prompt.md"
  purpose:
    description: |
      High-level goal, e.g. “generate React form prompt” or
      “TypeScript security instructions”.
    default: ""
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
     * Optional `inputSchema` for `${input:*}` variables.
   * **For instruction files** (`*.instructions.md`) include:
     * `applyTo`: glob(s) that auto-attach the file (use `"**"` to always apply).

4. **Body template** (after a blank line):
   * `## Context` – link to docs/specs the model should read.
   * `## Rules / Requirements` – bullet points, each a single imperative rule.
   * `## Validation checklist` – Markdown - [ ] list for humans.

5. **Variables & interpolation**:
   * Use `${workspaceFolder}`, `${selection}`, `${input:var}`, etc.
   * Support transforms like `${input:routeName^Pascal}` (PascalCase).

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