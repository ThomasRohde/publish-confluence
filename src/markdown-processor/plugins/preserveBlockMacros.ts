// preserveBlockMacros.ts
// Rehype plugin – collapse an opening Handlebars block macro, all
// intervening nodes, and the matching closing macro into *one* `raw` node.
// Keeps existing deps only: unist types + hast-util-to-html.

import { Parent } from 'unist';
import { toHtml } from 'hast-util-to-html';

export default function preserveBlockMacros() {
  return (tree: Parent) => {
    /**
     * Walks the tree, replacing every
     *   <p>{{#macro …}}</p> … <p>…{{/macro}}</p>
     * (or “…{{/macro}}” hiding *anywhere* in a descendant) with
     *   {type:'raw', value:'{{#macro …}}\n…\n{{/macro}}'}
     */
    function transform(parent: Parent) {
      for (let i = 0; i < parent.children.length; i++) {
        const node = parent.children[i];

        // ── 1. Is this a paragraph that *only* contains an opening macro? ──
        const openText = soleText(node);
        if (openText && openText.startsWith('{{#')) {
          const macroAttr = openText.slice(2, -2).trim();          // "#confluence-info title=…"
          const macroName = macroAttr.split(/\s+/, 1)[0].slice(1); // "confluence-info"

          // ── 2. Collect following siblings until we *see & strip* the close tag ──
          const collected: any[] = [];
          let found = false;
          let j = i + 1;

          while (j < parent.children.length) {
            const cand = parent.children[j];
            collected.push(cand);
            if (stripClose(cand, macroName)) {
              found = true;
              break;
            }
            j++;
          }
          if (!found) continue;         // unmatched – leave as-is

          // ── 3. Serialise the slice (minus the stripped close marker) ──
          const innerHtml = toHtml({ type: 'root', children: collected });

          // ── 4. Replace [open, …, last] with one `raw` node ──
          const rawNode = {
            type: 'raw',
            value: `${openText}\n${innerHtml}\n{{/${macroName}}}`,
          };
          parent.children.splice(i, collected.length + 1, rawNode);

          // Re-start scan at same index (raw node just inserted there)
          i--;
        }

        // ── 5. Recurse ──
        if ((node as Parent).children) transform(node as Parent);
      }
    }

    /** Return text if node is `<p>[text]</p>` and *nothing* else */
    function soleText(node: any): string | null {
      return node?.type === 'element' &&
        node.tagName === 'p' &&
        node.children?.length === 1 &&
        node.children[0].type === 'text'
        ? String(node.children[0].value).trim()
        : null;
    }

    /**
     * DFS through `node`, deleting the first occurrence of `{{/macro}}`.
     * Returns `true` once it has been removed.
     */
    function stripClose(node: any, macroName: string): boolean {
      if (!node) return false;

      if (node.type === 'text') {
        const pattern = new RegExp(`{{\\/${macroName}}}`, 'm');
        if (pattern.test(node.value)) {
          node.value = node.value.replace(pattern, '').trimEnd();
          return true;
        }
      }
      if (node.children) {
        for (const c of node.children)
          if (stripClose(c, macroName)) return true;
      }
      return false;
    }

    // kick things off
    transform(tree);
  };
}
