Below is a **coding‑agent‑ready implementation plan** that adds a *per‑page* **Markdown → publish‑confluence** preprocessing step, triggered by a new `format` attribute in `publish‑confluence.json`.
The plan keeps existing files untouched and introduces well‑scoped new modules so that the feature can be developed, unit‑tested and merged incrementally.

---

## 0 . Overview of the solution

```
              ┌─────────────────────┐
publish‑confluence.json ──► loadConfiguration()
              │ (already validates config)
              ▼
        PublishConfig      + new optional field `format`
              │
              ▼
         publisher.ts
              │  (when it loads a template file)
              │
              ▼
   preprocessContent(format, rawTemplate)  ←─┐
              │                             │ registerMarkdownPreprocessor.ts
              │                             │   (unified + remark‑parse etc.)
              ▼                             │
  HTML/Handlebars string ready for          │
  existing template‑to‑storage pipeline ────┘
```

---

## 1 .  Domain‑model changes

| File                               | Action                | Details                                                                                                                                                                                                         |                                                                                                         |
| ---------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **`src/types.ts`**                 | add                   | \`\`\`ts\nexport type FileFormat = 'html'                                                                                                                                                                       | 'markdown';\n``<br>and extend `PublishConfig`:<br>``ts\nformat?: FileFormat; // default 'html'\n\`\`\`  |
| **`src/config.ts`**                | extend the Zod schema | *a)* add `.format` with `.optional().default('html').refine(v=>['html','markdown'].includes(v))`.<br>*b)* add inheritance logic so a child page inherits the parent’s `format` if it does not specify its own.  |                                                                                                         |
| **`publish‑confluence.json` docs** | update                | Explain `format` (allowed values: `"html"` \| `"markdown"`). If omitted, falls back to `"html"` to preserve current behaviour.                                                                                  |                                                                                                         |

---

## 2 .  New preprocessing framework

### 2.1  Generic interface

Create **`src/preprocessor/index.ts`**

```ts
export interface Preprocessor {
  readonly format: 'html' | 'markdown';
  process(raw: string): Promise<string>;
}

const registry = new Map<string, Preprocessor>();

export function registerPreprocessor(p: Preprocessor) {
  registry.set(p.format, p);
}

export async function preprocessContent(format: string, raw: string) {
  const p = registry.get(format) ?? registry.get('html'); // html = identity
  return p!.process(raw);
}

// Register the default identity preprocessor
registerPreprocessor({
  format: 'html',
  process: async s => s
});
```

### 2.2  Markdown implementation

Create **`src/preprocessor/markdown-preprocessor.ts`**

```ts
import { registerPreprocessor, Preprocessor } from './index';
import unified from 'unified';
import remarkParse from 'remark-parse';
import visit from 'unist-util-visit';
import h from 'hastscript';
import toHtml from 'hast-util-to-html';

/** converts Markdown + minimal Confluence‑aware extensions to XHTML/Handlebars */
function remarkToPublishConfluence(): unified.Pluggable {
  return () => (tree: any) => {
    const toHast = (node: any): any => {
      switch (node.type) {
        case 'heading':   return h(`h${node.depth}`, node.children.map(toHast));
        case 'paragraph': return h('p', node.children.map(toHast));
        case 'text':      return node.value;
        case 'strong':    return h('strong', node.children.map(toHast));

        // 1️⃣ example macro mappings
        case 'blockquote':
          return h('ac:structured-macro', { 'ac:name': 'info' }, [
            h('ac:rich-text-body', node.children.map(toHast))
          ]);
        case 'code':
          return h('ac:structured-macro', { 'ac:name': 'code' }, [
            h('ac:parameter', { 'ac:name': 'language' }, node.lang || ''),
            h('ac:plain-text-body', h('![CDATA[', node.value))
          ]);
        default:
          return null;
      }
    };

    /** attach generated HTML to the root; caller reads file.data.xhtml */
    visit(tree, 'root', (root: any) => {
      const hast = root.children.map(toHast).filter(Boolean);
      root.data = {
        ...root.data,
        xhtml: toHtml(hast, { allowDangerousHtml: true, upperDoctype: true })
      };
    });
  };
}

async function md2xhtml(src: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkToPublishConfluence)
    .process(src);

  // Replace certain XHTML fragments with Handlebars helpers if desired
  return String((file.data as any).xhtml ?? file.contents);
}

/** concrete preprocessor instance */
const markdownPre: Preprocessor = {
  format: 'markdown',
  async process(raw) {
    return md2xhtml(raw);
  }
};

registerPreprocessor(markdownPre);
```

This uses the exact library stack shown in the user’s example and demonstrates one‑for‑one macro mappings (blockquote → `info` macro, fenced code → `code` macro, etc.).

---

## 3 .  Wiring it into the publish flow

### 3.1  publisher.ts

Locate the helper that loads the *page* or *macro* template (function `loadTemplate` plus callers) .

Modify just after the file is read:

```ts
// (inside the main loop that renders each page template)
const rawTemplate = await loadTemplate(config.templatePath, DEFAULT_PAGE_TEMPLATE);

const templateSource = await preprocessContent(
  config.format ?? 'html',
  rawTemplate
);
const compiled = Handlebars.compile(templateSource);
```

Do the same for `macroTemplatePath` if it exists and you expect Markdown macros inside a macro template.

### 3.2  CLI / runtime

No CLI flags are necessary. Users enable preprocessing by adding:

```jsonc
{
  "pageTitle": "My Doc",
  "templatePath": "./README.md",
  "format": "markdown"
}
```

to the relevant page block in `publish-confluence.json`.

---

## 4 .  Dependency & build updates

* Add to **package.json**:

```json
"dependencies": {
  "unified": "^11.0.0",
  "remark-parse": "^11.0.0",
  "unist-util-visit": "^4.1.2",
  "hastscript": "^7.0.2",
  "hast-util-to-html": "^9.0.0"
}
```

* `tsconfig.json` needs `"esModuleInterop": true` (already set) and possibly `"types": ["node"]`.

---

## 5 .  Documentation

* **README**: Add section *“Writing pages in Markdown”*.
* **publish‑confluence.json schema docs**: describe `format`.

---

## 6 .  Migration & backwards compatibility

* Default `format` is `"html"` so current projects remain unaffected.
* The preprocessor registry means future formats (AsciiDoc, MDX, etc.) can be added via new modules without touching the core.

---

## 7 .  Roll‑out checklist for the coding agent

1. Implement §2 files.
2. Extend types and config validation (§1).
3. Update `publisher.ts` (§3.1).
4. Add dependencies & tests (§4, §5).
5. Run `npm test`, lint, and ensure `npm run build` passes.
6. Update docs (§6).

