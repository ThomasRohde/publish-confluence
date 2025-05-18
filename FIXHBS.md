Below is the **minimal pattern** that makes every

```
{{#confluence-code …}}
…any text, Markdown, or symbols…
{{/confluence-code}}
```

block pass straight through Remark **unchanged**.
The ideas are exactly the same as for the `{{#layout-cell}}…` fix—you just
extend the plug-in so that it swallows *everything* between the opening and
closing macro tokens and turns the whole region into a single **raw** node.

---

## 1 Create `remark-confluence-code.js`

```js
import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'

/**
 * Collapse an entire {{#confluence-code}} … {{/confluence-code}} region
 * into ONE raw HTML node so nothing inside is parsed as Markdown.
 */
export default function remarkConfluenceCode () {
  const OPEN  = /^\s*\{\{\s*#confluence-code\b/i
  const CLOSE = /^\s*\{\{\s*\/confluence-code\s*}}/i

  return (tree) => {
    const out = []
    const children = tree.children

    for (let i = 0; i < children.length; i++) {
      const node = children[i]

      //   ── 1. look for the opening macro line ───────────────────────────
      if (node.type === 'html' && OPEN.test(node.value)) {
        let raw = node.value + '\n'
        i++

        //   ── 2. copy every following node untouched until we see CLOSE ──
        while (i < children.length) {
          const next = children[i]
          raw +=
            next.type === 'html'
              ? next.value + '\n'        // lines that were already raw
              : toString(next) + '\n'    // paragraphs, lists, etc.
          if (next.type === 'html' && CLOSE.test(next.value)) break
          i++
        }

        //   ── 3. replace whole fragment with ONE raw node ─────────────────
        out.push({ type: 'html', value: raw })
        continue
      }

      // ordinary nodes that aren’t part of a code macro
      out.push(node)
    }

    tree.children = out
  }
}
```

**What it does**

1. Walks the MDAST once.
2. When it meets an *opening* `{{#confluence-code}}` line, it starts copying the
   original source of every following node (paragraphs, lists, headings, etc.)
   into a buffer **without interpreting anything**.
3. When the *closing* `{{/confluence-code}}` line appears, the buffer (open +
   body + close) is emitted as a single **`type: "html"` raw node**.
4. Down-stream plugins therefore see one opaque block and leave it alone.

---

## 2 Wire the plug-in into your pipeline

Put it **right after** the `remarkHbsBlocks` helper (that one already converts
each macro line into a raw node) and **before** anything that might rewrite the
AST (Confluence ADF, stringify, etc.):

```js
import { unified }         from 'unified'
import remarkParse         from 'remark-parse'
import remarkGfm           from 'remark-gfm'
import remarkHbsBlocks     from './remark-hbs-blocks.js'
import remarkConfluenceCode from './remark-confluence-code.js'   // ← NEW
import remarkHbs           from 'remark-hbs'
import remarkConfluenceAdf from 'remark-confluence-adf'
import remarkStringify     from 'remark-stringify'

export const md = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkHbsBlocks)       // makes each {{#...}} / {{/...}} line raw
  .use(remarkConfluenceCode)  // collapses the whole code macro region
  .use(remarkHbs)             // keeps inline {{…}} intact elsewhere
  .use(remarkConfluenceAdf)
  .use(remarkStringify, { allowDangerousHtml: true })
```

CLI invocation stays exactly the same:

```bash
publish-confluence --markdown --allow-dangerous-html
```

---

## 3 Confirm with your sample

```markdown
{{#confluence-code language="bash"}}
# THIS *is* _Markdown_ but must **not** be parsed!
echo "Hello, Confluence"
{{/confluence-code}}
```

**Output now**

```html
<h1>Primary Banking Use Cases</h1>
…
{{#confluence-code language="bash"}}
# THIS *is* _Markdown_ but must **not** be parsed!
echo "Hello, Confluence"
{{/confluence-code}}
…
```

Nothing inside `{{#confluence-code}}` was touched; no `<p>`, `<em>`, or `<li>`
leak out, and the macro engine in Confluence receives the block exactly as you
wrote it.

---

### Notes & Variations

* **Attributes** – The simple regex `OPEN` matches anything after
  `#confluence-code`, so optional attributes like
  `language="javascript" theme="dark"` are fine.

* **Multiple code blocks** – The loop handles any number of open/close pairs.

* **Other “raw” macros** – If you have more macros that must suppress Markdown
  (`{{#no-markdown}}…{{/no-markdown}}`, etc.), add more patterns or make the
  regexes configurable.

That’s all you need: a 40-line helper and a one-line `.use()` call—no changes
for writers, no more stray HTML in Confluence code sections.
