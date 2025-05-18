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

/**
 * Treat any line that is *only* a Handlebars block token
 * ({{#something}} or {{/something}}) as a raw HTML node.
 * That forces a block-level break in CommonMark,
 * so lists/paragraphs close *before* the macro token.
 */
export default function remarkHbsBlocks () {
  const RE = /^\s*\{\{\s*[#/][^}]+}}/

  return (tree: Parent) => {
    visit(tree, 'paragraph', (node: ParagraphNode, index: number | undefined, parent: Parent | undefined) => {
      if (
        parent && 
        typeof index === 'number' &&
        node.children.length === 1 &&
        node.children[0].type === 'text' &&
        RE.test((node.children[0] as TextNode).value)
      ) {
        parent.children[index] = {
          type: 'html',          // raw node - will be emitted verbatim
          value: (node.children[0] as TextNode).value.trim() + '\n'
        } as HtmlNode
      }
    })
  }
}
