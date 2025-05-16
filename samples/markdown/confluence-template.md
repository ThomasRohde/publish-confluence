{{#confluence-info title="Markdown processing in publishing-confluence" comment=true}}
  ### This is a heading inside a info box
{{/confluence-info}}

# Sample Markdown File

This is a sample Markdown file to test the integration with publish-confluence.

## Features

- **Bold text** and *italic text*
- Lists (like this one)
- [Links](https://www.example.com)

## Code Samples

```javascript
// This is a JavaScript code block
function hello() {
  console.log("Hello, world!");
}
```

## Tables

| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |

## Handlebars Templates

This should preserve Handlebars expressions: {{pageTitle}} and {{currentDate}}

<hr/>
<p><em>Last updated: {{currentDate}}</em></p>