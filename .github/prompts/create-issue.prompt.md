---
mode: "ask"
description: "Generate a well-structured GitHub issue for publish-confluence with title, description, and optional metadata"
inputSchema:
  issueType:
    description: "Type of issue to create (bug, feature, documentation, refactoring)"
    default: "bug"
  component:
    description: "Component affected (cli, client, templates, etc.)"
    default: "cli"
  priority:
    description: "Issue priority (high, medium, low)"
    default: "medium"
---

# Create GitHub Issue

## Context
I need to create a well-structured GitHub issue for the publish-confluence project. The issue should follow the project's standards and include all relevant information to help maintainers understand and address it.

## Rules / Requirements
- Create a GitHub issue with a clear, concise title that summarizes the problem or request
- For bug reports, include: reproduction steps, expected vs. actual behavior, error messages, and environment details
- For feature requests, include: problem statement, proposed solution, and acceptance criteria
- For documentation issues, include: what's missing/incorrect and suggested improvements
- For refactoring, include: what needs refactoring, why, and suggested approach
- Use markdown formatting to improve readability (headings, lists, code blocks)
- Tag the issue appropriately with labels that match the project's labeling system
- Reference any related issues or PRs if applicable
- Include any relevant screenshots or logs if available
- Follow the TypeScript project standards described in the workspace instructions

## Structure
```md
## Description
[Detailed description of the issue]

## Current Behavior
[What's happening now / the problem]

## Expected Behavior 
[What should happen instead]

## Steps to Reproduce
1. [First Step]
2. [Second Step]
3. [Third Step]

## Environment
- publish-confluence version: [version]
- Node.js version: [version]
- OS: [Windows/macOS/Linux]
- TypeScript version: [version]

## Additional Context
[Any other relevant information, screenshots, logs, etc.]
```

## Validation Checklist
- [ ] Title is clear, concise and descriptive
- [ ] Description explains the issue or request thoroughly
- [ ] Appropriate template sections are filled out based on issue type
- [ ] Markdown formatting is used for readability
- [ ] Environmental details are included where relevant
- [ ] Any code examples are properly formatted in code blocks
- [ ] Issue follows project coding standards and conventions
