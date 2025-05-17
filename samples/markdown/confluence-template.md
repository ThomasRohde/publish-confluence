{{#confluence-info title="Markdown processing in publishing-confluence" comment=false}}
  ### This is a heading inside a info box
  > Note this!
{{/confluence-info}}

# Sample Markdown File

This is a sample Markdown file to test the integration with publish-confluence. It demonstrates various GitHub Flavored Markdown features that are supported by the publish-confluence tool.

## Text Formatting

- **Bold text** and *italic text*
- ***Bold and italic text***
- ~~Strikethrough text~~
- <sub>Subscript</sub> and <sup>Superscript</sup>
- `Inline code` with backticks
- > Blockquote text
- Horizontal rule below:

---

## Lists

### Unordered Lists
- First level item
  - Second level item
    - Third level item
      - Fourth level item
- Another first level item
  * Mixed bullet styles
  + Work as well

### Ordered Lists
1. First item
2. Second item
   1. Nested item 1
   2. Nested item 2
3. Third item

### Task Lists
- [x] Completed task
- [ ] Uncompleted task
- [x] @mentions, #refs, [links](https://github.com), **formatting**, and ~~tags~~ supported
- [ ] List syntax required (any unordered or ordered list supported)

## Links and References

- [Basic link to GitHub](https://github.com)
- [Link with title](https://github.com "GitHub's Homepage")
- [Reference-style link][reference text]
- [Relative link to a repository file](../README.md)
- Auto-converted link: https://www.example.com
- Email link: <example@example.com>

## Code Samples

Inline code: `const greeting = "Hello World";`

```javascript
// JavaScript code block with syntax highlighting
function hello(name) {
  const greeting = `Hello, ${name}!`;
  console.log(greeting);
  return greeting;
}

// Call the function
hello("Confluence User");
```

```typescript
// TypeScript code example
interface User {
  name: string;
  age: number;
  isAdmin: boolean;
}

class UserManager {
  private readonly users: User[] = [];
  
  public addUser(user: User): void {
    this.users.push(user);
    console.log(`Added user: ${user.name}`);
  }
  
  public getAdmins(): User[] {
    return this.users.filter(user => user.isAdmin);
  }
}
```

```html
<!-- HTML code example -->
<div class="container">
  <h1 class="title">Hello Confluence</h1>
  <p>This is an HTML example that will be rendered in Confluence.</p>
  <button onclick="alert('Clicked!')">Click me</button>
</div>
```

## Tables

| Feature | Basic Support | Advanced Support | Notes |
|---------|:-------------:|:----------------:|-------|
| Text formatting | ✅ | ✅ | Supports **bold**, *italic*, and ~~strikethrough~~ |
| Code blocks | ✅ | ✅ | With syntax highlighting |
| Tables | ✅ | ⚠️ | Some advanced features may not work |
| Handlebars | ✅ | ✅ | Template expressions preserved |
| Images | ✅ | ✅ | Supports alt text and titles |

### Table Alignment

| Left-aligned | Center-aligned | Right-aligned |
|:-------------|:--------------:|--------------:|
| Left         | Center         | Right         |
| Text         | Text           | Text          |

## Escaping Characters

You can escape Markdown formatting characters with a backslash: \*not italic\*, \`not code\`

## Inline HTML

<details>
<summary>Click to expand details section</summary>

This is hidden content that can be expanded.

- You can include lists
- And other markdown formatting
- Inside HTML blocks

</details>

<div align="center">

### Centered Content

This text and heading will be centered when rendered.

</div>

## Quotes and Footnotes

> This is a single line quote

> This is a multi-line blockquote.
>
> It can span multiple paragraphs.
>
> > And can be nested.

Here's a simple footnote reference[^1].

[^1]: This is the footnote content.

## Emojis

🔗😂🪵🔊🔨📐🪟

## Handlebars Templates

This should preserve Handlebars expressions: {{pageTitle}} and {{currentDate}}

## Keyboard and Other Special Formatting

Press <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>Del</kbd> to restart your computer.

<abbr title="HyperText Markup Language">HTML</abbr> is the standard markup language for web pages.

<mark>Highlighted text</mark> can be created using the mark tag.

<hr/>
<p><em>Last updated: {{currentDate}}</em></p>