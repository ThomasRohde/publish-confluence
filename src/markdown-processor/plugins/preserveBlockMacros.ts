// **New plugin**: preserveBlockMacros.ts
import { Parent } from 'unist';  // for type annotations if needed

export default function preserveBlockMacros() {
  return (tree: Parent) => {
    function processNodes(nodes: any[]): any[] {
      const output: any[] = [];
      for (let i = 0; i < nodes.length; ) {
        const node = nodes[i];
        // Check for an isolated paragraph containing a Handlebars macro
        if (node.type === 'element' && node.tagName === 'p' &&
            node.children && node.children.length === 1 &&
            node.children[0].type === 'text') {
          const textVal: string = node.children[0].value;
          const openMatch = textVal.match(/^{{#([^{}]+)}}$/);
          if (openMatch) {
            // Found an opening macro like {{#macroName ...}}
            const macroContent = openMatch[1];                   // e.g. "confluence-info title=\"...\""
            const macroName = macroContent.split(/\s+/, 1)[0];   // e.g. "confluence-info"
            // Collect all nodes until the matching closing tag
            const innerNodes: any[] = [];
            let closingIndex = -1;
            for (let j = i + 1; j < nodes.length; j++) {
              const maybeClose = nodes[j];
              if (maybeClose.type === 'element' && maybeClose.tagName === 'p' &&
                  maybeClose.children && maybeClose.children.length === 1 &&
                  maybeClose.children[0].type === 'text') {
                const closeMatch = maybeClose.children[0].value.match(/^{{\/([^{}]+)}}$/);
                if (closeMatch && closeMatch[1] === macroName) {
                  closingIndex = j;
                  break;
                }
              }
              innerNodes.push(nodes[j]);
            }
            if (closingIndex !== -1) {
              // Recursively process inner content for nested macros
              const processedInner = processNodes(innerNodes);
              // Serialize inner nodes to HTML
              const innerHtml = processedInner.map(child => serializeNode(child)).join('');
              const openTag = `{{#${macroContent}}}`;
              const closeTag = nodes[closingIndex].children[0].value;  // e.g. {{/confluence-info}}
              // Replace the whole block with a single raw node containing the macro
              output.push({ type: 'raw', value: openTag + innerHtml + closeTag });
              i = closingIndex + 1;
              continue;  // skip ahead past the closing macro
            }
            // If no closing found, fall through to treat as normal text
          }
          const closeMatch = textVal.match(/^{{\/([^{}]+)}}$/);
          if (closeMatch) {
            // Unmatched closing macro (should not normally happen) – treat as normal text node
            output.push(node);
            i++;
            continue;
          }
        }
        // Default: process children and keep the node
        if (node.children) {
          node.children = processNodes(node.children);
        }
        output.push(node);
        i++;
      }
      return output;
    }

    // Helper: serialize a node (element, text, or raw) to HTML string
    function serializeNode(node: any): string {
      if (!node) return '';
      if (node.type === 'text') return node.value;
      if (node.type === 'raw') return node.value;
      if (node.type === 'element') {
        const tag = node.tagName;
        let html = `<${tag}`;
        const props = node.properties || {};
        for (const [key, val] of Object.entries(props)) {
          if (val === true) {
            html += ` ${key}`;
          } else if (val !== false && val != null) {
            const attrVal = Array.isArray(val) ? val.join(' ') : String(val);
            html += ` ${key}="${attrVal}"`;
          }
        }
        html += '>';
        if (node.children && node.children.length) {
          html += node.children.map((child: any) => serializeNode(child)).join('');
        }
        html += `</${tag}>`;
        return html;
      }
      return '';
    }

    if (tree.children) {
      tree.children = processNodes(tree.children);
    }
  };
}
