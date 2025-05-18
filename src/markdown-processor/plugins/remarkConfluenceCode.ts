import { visit } from 'unist-util-visit';
import { Node, Parent } from 'unist';
import { VFile } from 'vfile';

// Define interfaces for our AST nodes
interface TextNode extends Node {
  type: 'text';
  value: string;
}

interface ParagraphNode extends Parent {
  type: 'paragraph';
  children: (TextNode | Node)[];
}

interface HtmlNode extends Node {
  type: 'html';
  value: string;
}

/**
 * Collapse an entire {{#confluence-code}} … {{/confluence-code}} region
 * into ONE raw HTML node so nothing inside is parsed as Markdown.
 * Preserves original whitespace and indentation.
 */
export default function remarkConfluenceCode() {
  const OPEN = /^\s*\{\{\s*#confluence-code\b/i;
  const CLOSE = /^\s*\{\{\s*\/confluence-code\s*}}/i;

  // We'll collect code block data to process after parsing
  return function transformer(tree: Parent, file: VFile) {
    // Exit early if we don't have the original source as string
    if (typeof file.value !== 'string') {
      return tree;
    }

    const originalSource = file.value;
    const out: Node[] = [];
    const children = tree.children;

    // Track code block boundaries and content
    let inCodeBlock = false;
    let codeBlockContent = '';
    let openTag = '';

    for (let i = 0; i < children.length; i++) {
      const node = children[i] as Node;

      // Check for opening tag of code block
      if (!inCodeBlock && node.type === 'html' && OPEN.test((node as HtmlNode).value)) {
        inCodeBlock = true;
        openTag = (node as HtmlNode).value;
        codeBlockContent = openTag + '\n';

        // Find all content until closing tag
        let j = i + 1;
        let foundClose = false;

        while (j < children.length) {
          const nextNode = children[j];

          // When we find the closing tag
          if (nextNode.type === 'html' && CLOSE.test((nextNode as HtmlNode).value)) {
            foundClose = true;
            codeBlockContent += (nextNode as HtmlNode).value;
            break;
          }

          // For all raw HTML nodes, add them as-is
          if (nextNode.type === 'html') {
            codeBlockContent += (nextNode as HtmlNode).value + '\n';
          }
          // For other node types, we need to extract their original source text
          else if (nextNode.position) {
            // Extract exact text from original source using position data
            const start = nextNode.position.start.offset;
            const end = nextNode.position.end.offset;

            if (start !== undefined && end !== undefined) {
              const originalText = originalSource.substring(start, end);
              codeBlockContent += originalText + '\n';
            }
          }

          j++;
        }

        if (foundClose) {
          // Add the entire code block as one raw HTML node
          out.push({ type: 'html', value: codeBlockContent } as HtmlNode);
          i = j; // Skip processed nodes
          inCodeBlock = false;
        } else {
          // If no closing tag was found, just add the opening tag
          out.push(node);
        }
      } else if (!inCodeBlock) {
        // For nodes outside code blocks, keep them as-is
        out.push(node);
      }
      // Nodes inside code blocks are handled in the inner loop
    }

    tree.children = out;
    return tree;
  };
}
