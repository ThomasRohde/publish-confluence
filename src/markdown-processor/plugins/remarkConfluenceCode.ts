import { visit } from 'unist-util-visit'
import { Node, Parent } from 'unist'

// Define interfaces for our AST nodes
interface TextNode extends Node {
  type: 'text'
  value: string
}

interface ParagraphNode extends Parent {
  type: 'paragraph'
  children: (TextNode | Node)[]
}

interface HtmlNode extends Node {
  type: 'html'
  value: string
}
import { toString } from 'mdast-util-to-string'

/**
 * Collapse an entire {{#confluence-code}} … {{/confluence-code}} region
 * into ONE raw HTML node so nothing inside is parsed as Markdown.
 */
export default function remarkConfluenceCode () {
  const OPEN  = /^\s*\{\{\s*#confluence-code\b/i
  const CLOSE = /^\s*\{\{\s*\/confluence-code\s*}}/i

  return (tree: Parent) => {
    const out: Node[] = []
    const children = tree.children

    for (let i = 0; i < children.length; i++) {
      const node = children[i] as Node

      //   ── 1. look for the opening macro line ───────────────────────────
      if (node.type === 'html' && OPEN.test((node as HtmlNode).value)) {
        let raw = (node as HtmlNode).value + '\n'
        i++

        //   ── 2. copy every following node untouched until we see CLOSE ──
        while (i < children.length) {
          const next = children[i] as Node
          raw +=
            next.type === 'html'
              ? (next as HtmlNode).value + '\n'        // lines that were already raw
              : toString(next) + '\n'    // paragraphs, lists, etc.
          if (next.type === 'html' && CLOSE.test((next as HtmlNode).value)) break
          i++
        }

        //   ── 3. replace whole fragment with ONE raw node ─────────────────
        out.push({ type: 'html', value: raw } as HtmlNode)
        continue
      }

      // ordinary nodes that aren't part of a code macro
      out.push(node)
    }

    tree.children = out
  }
}
