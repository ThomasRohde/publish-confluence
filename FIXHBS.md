# Preserving Handlebars Macros During Markdown Processing

## Problem Overview

When running **publish-confluence** in dry-run mode with the `--markdown` flag, Handlebars block helpers (e.g. Confluence layout macros) get mangled by the Remark Markdown-to-HTML conversion. The markdown content inside these macro blocks is correctly converted (e.g. `###` becomes `<h3>`), but the Handlebars block markers themselves (`{{# ... }}` and `{{/ ... }}`) are being wrapped in paragraph or list tags. This corrupts the template structure – for example, an opening `{{#layout-cell}}` ends up inside `<p>...</p>` or `<li>...</li>` tags, rather than standing alone. The result is broken Handlebars syntax in the output, as shown in the example:

```html
<p>{{#confluence-layout}} … {{#layout-cell}}</p>
<h3>Risk Assessment</h3>
<ul>
  <li>Monte Carlo simulations … {{/layout-cell}} {{#layout-cell}}</li>
</ul>
<h3>Trading & Investment</h3>
<ul>
  <li>Portfolio optimization … {{/layout-cell}} {{/layout-section}} {{/confluence-layout}}</li>
</ul>
```

In this output, the `{{#...}}` and `{{/...}}` markers have been wrapped in `<p>` and `<li>` tags, intermixing with the generated `<h3>` and `<ul>` elements. Confluence macros expect these Handlebars tags to appear exactly (and only) where they were in the template – any surrounding HTML tags will break the macro structure.

## Root Cause in the Remark Pipeline

The issue stems from how the unified Remark/Rehype pipeline is handling the Handlebars tags. By default, **Remark** doesn’t recognize `{{...}}` as special syntax, so it treats those lines as normal text:

* **Parsing (remark-parse):** An opening macro like `{{#layout-cell}}` on a line by itself is parsed as a plain paragraph node containing that text. If multiple Handlebars lines occur consecutively with no blank line between, Remark merges them into one paragraph. Similarly, a closing `{{/layout-cell}}` might be parsed as its own paragraph (if separated by a blank line) or appended to the previous content block. In our example, the three opening tags were parsed as one paragraph of text, and the closing tags got attached to list items due to the lack of blank lines.
* **Markdown to HTML (remark-rehype):** When converting the Markdown AST to an HTML AST (HAST), those Handlebars text nodes turn into text inside HTML elements. Remark wraps standalone text in a paragraph by default. In our case, it produced a `<p>` containing the first few `{{#...}}` tags, and later included `{{/layout-cell}}` inside a `<li>` because it thought that text was part of the list item content. This happened because the markdown list wasn’t explicitly closed before the macro tag in the source, so the parser didn’t insert a new block for the macro.
* **Rehype/Plugins:** The processing pipeline (from `remarkProcessor.ts`) shows that after parsing, the tool uses `remarkRehype` and `rehypeRaw` to handle raw HTML, then some custom plugins to handle Handlebars and Confluence macros. Notably, a `preserveHandlebars` plugin is applied *after* HTML conversion, and a `preserveBlockMacros` plugin runs last. The intent was to protect or restore Handlebars syntax, but at that point the damage (wrapping in tags) is already done. The `preserveHandlebars` plugin replaces `{{...}}` with placeholders and then immediately swaps them back, which does not prevent them from being wrapped by earlier steps. The `preserveBlockMacros` plugin tries to merge an opening `<p>{{#macro …}}</p>` with its corresponding closing tag into a single raw string. However, if the macro tags weren’t isolated in their own `<p>` (or got split across list items), this plugin can fail to catch them. In our case, because multiple `{{#...}}` were lumped into one paragraph and closing tags were inside list items, the plugin didn’t properly consolidate them, resulting in the corrupted output.

In short, **Remark is treating Handlebars block markers as normal text and injecting HTML tags around them**, since it doesn’t know they should be preserved as raw template syntax. The current preservation plugins aren’t kicking in early enough or comprehensively enough to stop this.

## Solution Approach

The fix is to adjust the markdown processing so that **Handrails block tags remain intact and are not wrapped in any HTML elements**, while still converting the markdown content inside the blocks. We need to effectively mark these `{{#...}}` and `{{/...}}` lines as “raw” content (or otherwise shield them) before the HTML conversion happens. This can be achieved by customizing the Remark plugin pipeline. There are two complementary strategies:

1. **Intercept and preserve macro tags during the Remark phase (before HTML conversion).** By using a custom Remark plugin or syntax extension, we can detect lines that are Handlebars block openings/closings and treat them as raw blocks. In practice, this means replacing those nodes in the Markdown AST with something that will survive the HTML conversion unchanged (for example, an `html` node or a custom node that we later serialize directly).
2. **Adjust the existing rehype plugins (or their ordering) to ensure any macro tags that do slip through are consolidated correctly.** The `preserveBlockMacros` plugin is on the right track – it merges `<p>{{#macro}}…{{/macro}}</p>` sequences into a raw string. We need to make sure it can handle our scenario (multiple nested macros and tags not in their own paragraphs). This might involve improving its pattern matching or, if we solve it in Remark, possibly moving it earlier or removing it.

The **preferred solution** is to handle it at the Remark stage so that the Handlebars markers are never wrapped in the first place. This way, the output from remark->rehype will already treat those tags as raw, and our final serializer will output them exactly as in the input.

## Step-by-Step Fix Implementation

Below are steps to modify the markdown processing pipeline to preserve Handlebars block helpers:

**1. Create a Remark plugin to preserve Handlebars block tags as raw HTML.** We will implement a custom transformer that scans the Markdown AST (MDAST) for any Handlebars block markers and converts them into raw nodes. In Remark, an `html` node type can be used to represent raw HTML to be passed through. We can leverage that for our Handlebars tags (even though they’re not HTML, we want them treated as raw). For example:

```ts
import { visit } from 'unist-util-visit';

function remarkPreserveMacros() {
  return (tree) => {
    const newChildren: any[] = [];
    for (const node of tree.children) {
      if (node.type === 'paragraph' && node.children.length === 1 && node.children[0].type === 'text') {
        // Get the paragraph text
        const text = node.children[0].value;
        // Check if it's a standalone Handlebars macro line (opening or closing)
        const trimmed = text.trim();
        if (trimmed.startsWith('{{#') || trimmed.startsWith('{{/')) {
          // If the paragraph is solely a macro tag, replace it with an html (raw) node
          newChildren.push({ type: 'html', value: trimmed + '\n' }); 
          continue; // skip adding the original paragraph
        }
      }
      newChildren.push(node); // keep node as-is if not solely a macro
    }
    tree.children = newChildren;
  };
}
```

This plugin looks at each top-level paragraph. If the paragraph consists of a single text node that is a Handlebars opening or closing tag, it replaces that paragraph with an `html` node whose value is the exact tag text (plus a newline for formatting). By doing this, we ensure an opening like `{{#layout-cell}}` is treated as a raw HTML fragment in the AST, not as normal text. We would do similarly if a paragraph contains multiple macro lines (we could split them into separate raw nodes for each line). You can extend the logic to handle multiple `{{#...}}` on one line or nested inside list items if needed (e.g., by drilling into list item children), but the key is that each `{{#...}}` or `{{/...}}` gets its own raw node in the AST.

**2. Integrate the plugin before HTML conversion.** Add this plugin into the unified processor *after* parsing and GFM, but *before* `remark-rehype`. For example, in `remarkProcessor.ts`, include it in the chain:

```ts
.unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkTableFormat as any)
  .use(remarkPreserveMacros)                // <- add our plugin here
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  … // other plugins
```

By inserting `remarkPreserveMacros` at this stage, the Handlebars markers are converted to raw HTML nodes in the Markdown AST **before** the AST is turned into HTML. Now, when `remarkRehype` runs, it will encounter those `html` node values and treat them as raw content. Because we enabled `allowDangerousHtml: true`, Remark/Rehype will carry those raw HTML strings into the HAST without escaping them. The `rehypeRaw` step will parse raw HTML, but in this case our strings like `{{#layout-cell}}` aren’t real HTML tags, so the HTML parser will likely just treat them as text nodes (or we could even skip `rehypeRaw` for these if necessary). The crucial part is that they will *not* be wrapped in `<p>` or `<li>` tags, because we removed the paragraph wrapper in the MDAST. Each macro tag is now a standalone node.

**3. Preserve the markdown content inside the macros.** With the above change, the content between `{{#...}}` and `{{/...}}` will still be parsed and converted normally. For example, in the AST around our macro, you would have a sequence like:

* html node: `{{#layout-cell}}\n`  (raw)
* element node: `<h3>Risk Assessment</h3>` (from the `###` heading)
* element node: `<ul><li>Monte Carlo simulations</li></ul>` (from the list)
* html node: `{{/layout-cell}}\n` (raw)

If macros are nested (like the outer `{{#confluence-layout}}` and sections), each of those tags would also become raw nodes in the sequence at the appropriate places. The inner content (headings, lists, paragraphs) remains as normal HAST nodes.

**4. Adjust or remove the post-processing plugins if needed.** With our Handlebars tags safely isolated as raw nodes from the start, the `preserveBlockMacros` rehype plugin may become unnecessary or could be simplified. That plugin was merging the macro tags and content into one `raw` node to output a contiguous block. Now that we prevent stray wrapping tags, you might not need to merge them – outputting the raw nodes in sequence yields the same result. The custom serializer already outputs raw nodes verbatim, so a sequence of raw-open, HTML content, raw-close will serialize correctly (ensuring the Handlebars syntax appears exactly in order). You should verify if any edge cases remain that `preserveBlockMacros` was handling – for example, if it was intended to handle macros that weren’t on their own lines. If our remark plugin covers all cases (including macros in list items or nested contexts by making them raw), we can likely disable `preserveBlockMacros` or move it earlier to be safe. At minimum, update it to handle scenarios with multiple opens in one paragraph. In our case, because we split out each `{{#...}}` to its own node, `preserveBlockMacros` would find each raw node and might attempt to merge it with siblings. You could either remove that logic or adjust its `soleText` check to also account for raw `{{#...}}` nodes. The simplest route is to rely on the remark plugin and drop the complex merging logic, since the serializer will handle output formatting.

**5. Verify the output.** Re-run the dry-run with `--markdown` after applying the changes. The Handlebars block helpers should now remain intact in the generated `.hbs` files. For the given example, the output should look like this (without any `<p>` or `<li>` around the tags):

```handlebars
{{#confluence-layout}}
{{#layout-section type="two_equal"}}
{{#layout-cell}}
<h3>Risk Assessment</h3>
<ul><li>Monte Carlo simulations</li></ul>
{{/layout-cell}}
{{#layout-cell}}
<h3>Trading & Investment</h3>
<ul><li>Portfolio optimization</li></ul>
{{/layout-cell}}
{{/layout-section}}
{{/confluence-layout}}
```

Each Handlebars directive is on its own line as raw text, and the markdown inside has been converted to proper HTML. The custom serializer will output these raw sections exactly as-is (it returns the `node.value` for `raw` nodes), so the braces and content are preserved. No unwanted `<p>` or `<ul>` wrappers will interfere with the `{{#...}}` blocks, and thus the template structure remains correct.

## Additional Notes

* **Preserve inline Handlebars expressions:** The above solution focuses on block helpers (with `#`). If your templates also use inline Handlebars expressions (like `{{someVar}}` within text), you might still want to preserve those from being HTML-escaped or altered. The existing `preserveHandlebars` plugin attempted to do this via placeholder replacement. You can keep using it (but consider running it *earlier* as a Remark plugin as well). However, typically inline `{{var}}` will just remain as literal text in a text node and should not be changed by Remark anyway. Ensure that no other plugin or the HTML phase is escaping curly braces – with `allowDangerousHtml: true`, they should pass through fine. If needed, you could extend `remarkPreserveMacros` to also replace inline `{{...}}` with placeholders before HTML conversion and restore them after, similar to what the original plugin does.
* **Testing nested macros:** If macros are nested (as in a layout containing sections containing cells), the remark plugin approach will produce multiple raw nodes in sequence. Handlebars will interpret them correctly as nested blocks when the template is rendered. Just be careful to maintain the order. The output might have consecutive raw lines for the outer and inner opens; that’s acceptable. If you prefer them merged for readability, you could still use a merging step like `preserveBlockMacros`, but it’s optional.
* **Avoiding HTML parsing on macro tags:** Since `rehypeRaw` will attempt to parse raw HTML, and our macro tags aren’t real HTML, the parser will likely just create text nodes for the `{}` characters. That’s usually fine, but it’s an unnecessary pass. If everything else works without `rehypeRaw`, you could consider removing `rehypeRaw` to avoid any chance of it interfering. In the current pipeline it’s included to process real HTML snippets in the markdown (like `<br>` or others). If you remove it, ensure that any raw HTML in the source is still handled appropriately (the `remarkRehype` with `allowDangerousHtml` might output raw nodes that would then remain unparsed). It might be safest to keep it, as the macros should remain unaffected.

By implementing the above changes, you preserve the Handlebars block syntax as *raw template syntax* while still converting the inner markdown content to valid XHTML. This addresses the root issue and ensures that your Confluence template helpers (like `{{#confluence-layout}}` etc.) are intact and functional in the output.
