# Markdown Sample for Confluence

This is a sample document showing how markdown can be used with publish-confluence.

## Text Formatting

**Bold text** and *italic text* are supported.

***Bold and italic*** can be combined.

~~Strikethrough~~ is also available.

## Lists

### Unordered List
- Item 1
- Item 2
  - Nested item 2.1
  - Nested item 2.2
- Item 3

### Ordered List
1. First item
2. Second item
   1. Nested item 2.1
   2. Nested item 2.2
3. Third item

## Links and Images

[Link to Confluence documentation](https://confluence.atlassian.com/doc/confluence-documentation-135922.html)

![Sample Image](../sample-image.png)

## Code Blocks

Inline `code` can be added.

```typescript
// TypeScript code block
function greet(name: string): string {
  return `Hello, ${name}!`;
}

const message: string = greet("Confluence User");
console.log(message);
```

## Tables

| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Row 1, Col 1 | Row 1, Col 2 | Row 1, Col 3 |
| Row 2, Col 1 | Row 2, Col 2 | Row 2, Col 3 |
| Row 3, Col 1 | Row 3, Col 2 | Row 3, Col 3 |

## Blockquotes

> This is a blockquote.
> It can span multiple lines.
>
> And contain multiple paragraphs.

## Horizontal Rule

---

## Confluence Macros with Handlebars

{{#confluence-info title="Markdown support"}}
  Hello World! This is an info panel in Confluence.
{{/confluence-info}}

{{#confluence-note title="Important Note"}}
  This is a note panel that will be rendered in Confluence.
{{/confluence-note}}

{{#confluence-warning title="Warning"}}
  This is a warning panel that will be rendered in Confluence.
{{/confluence-warning}}

## Task Lists

- [x] Completed task
- [ ] Incomplete task
- [ ] Another task to do

## Emphasis and Highlighting

This text has ==highlighted content== that stands out.

This is a ^superscript^ example and this is a ~subscript~ example.

