Below is the shortest (and safest) way I’ve found to let **all `{{…}}` Handlebars macros sail straight through the *publish-confluence* Remark pipeline without being split up or turned into XHTML** while the rest of your Markdown continues to be parsed and converted as usual.

---

### 1  Install a “no-touch” Handlebars plugin for Remark

The ready-made plugin **`remark-hbs`** already tells micromark/remark to treat every `{{ … }}` pair as an indivisible, raw chunk, so nothing inside is parsed for emphasis, links, HTML, etc.  Add it to your workspace:

```bash
npm i --save-dev remark-hbs   # or:  yarn add -D remark-hbs
```

The README shows a minimal example with just `.use(remarkHbs)` after the parser ([GitHub][1]).

---

### 2  Wire the plugin into your pipeline *before* anything that could rewrite the AST

```js
// build/publish.js (or wherever you construct the processor)
import { unified }          from 'unified'
import remarkParse          from 'remark-parse'
import remarkGfm            from 'remark-gfm'            // keep the MD features you need
import remarkHbs            from 'remark-hbs'            // <-- NEW
import remarkConfluenceAdf  from 'remark-confluence-adf' // whatever you already use
import remarkStringify      from 'remark-stringify'

export const md = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkHbs)                 // ‼️ must come BEFORE any other transformers
  .use(remarkConfluenceAdf)       // normal publish-confluence steps
  .use(remarkStringify, {         // only needed if you re-emit MD anywhere
    allowDangerousHtml: true      // lets raw nodes (our macros) stay verbatim
  })
```

**Why the order matters**

* `remarkHbs` runs immediately after parsing, converting every macro it finds into a **`raw`** (HTML) node.
* Down-stream plugins now see a single opaque node and **leave it intact**.
* When you later serialise to Atlassian Document Format or HTML, `raw` nodes are copied over verbatim, so the Confluence macro engine receives exactly the `{{ macro … }}` you wrote.

---

### 3  Tell *publish-confluence* to allow raw nodes (one-liner)

If you invoke the CLI, pass the flag once:

```bash
publish-confluence --allow-dangerous-html
```

In an API call:

```js
md.process(markdown, { allowDangerousHtml: true })
```

That is enough; you do **not** need to monkey-patch micromark or maintain a custom RegExp yourself.

---

### 5  Clean up the rest of the pipeline

1. **Remove** any earlier work-arounds (e.g. regex pre-filters that surrounded macros with back-ticks).
2. Make sure no other Remark plug-in that runs *before* `remark-hbs` tries to escape HTML or strip out “unsafe” text.
3. Keep your Markdown editors exactly as they are – the pipeline change is invisible to writers.


