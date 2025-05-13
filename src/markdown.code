import remark from 'remark';
import { create } from 'xmlbuilder2';
import { Node } from 'unist';

/**
 * Converts Markdown with Handlebars macros to Confluence Data Center storage format.
 * @param markdown The Markdown string to convert.
 * @returns A string representing the Confluence storage format XML.
 */
function markdownToConfluenceStorage(markdown: string): string {
  // Parse Markdown into an AST
  const ast = remark().parse(markdown);

  // Start building XML with a <body> root
  const xml = create({ version: '1.0', encoding: 'UTF-8' }).ele('body');

  // Function to process each part of the Markdown
  function visit(node: Node, parentXml: any) {
    switch (node.type) {
      case 'heading':
        const level = `h${(node as any).depth}`; // e.g., h1, h2
        const headingXml = parentXml.ele(level);
        if ((node as any).children) {
          (node as any).children.forEach((child: Node) => visit(child, headingXml));
        }
        break;

      case 'paragraph':
        const paraXml = parentXml.ele('p');
        if ((node as any).children) {
          (node as any).children.forEach((child: Node) => visit(child, paraXml));
        }
        break;

      case 'text':
        // Handle text, including Handlebars macros, and escape special characters
        const text = (node as any).value
          .replace(/&/g, '&amp;')  // Escape &
          .replace(/</g, '&lt;')   // Escape <
          .replace(/>/g, '&gt;');  // Escape >
        parentXml.txt(text);       // No extra escaping for {{ or }}, they stay as-is
        break;

      case 'strong':
        const strongXml = parentXml.ele('strong');
        if ((node as any).children) {
          (node as any).children.forEach((child: Node) => visit(child, strongXml));
        }
        break;

      case 'emphasis':
        const emXml = parentXml.ele('em');
        if ((node as any).children) {
          (node as any).children.forEach((child: Node) => visit(child, emXml));
        }
        break;

      case 'link':
        const linkXml = parentXml.ele('a', { href: (node as any).url });
        if ((node as any).children) {
          (node as any).children.forEach((child: Node) => visit(child, linkXml));
        }
        break;

      case 'code':
        const codeMacro = parentXml.ele('ac:structured-macro', { 'ac:name': 'code' });
        if ((node as any).lang) {
          codeMacro.ele('ac:parameter', { 'ac:name': 'language' }).txt((node as any).lang);
        }
        const codeText = (node as any).value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        codeMacro.ele('ac:plain-text-body').dat(codeText);
        break;
    }
  }

  // Process all top-level nodes
  (ast as any).children.forEach((child: Node) => visit(child, xml));

  // Return the final XML string
  return xml.end({ prettyPrint: true });
}

// Example usage
const markdown = `
# Hello World

This is a **bold** paragraph with a Handlebars macro: {{macro}}.

\`\`\`java
System.out.println("Hello, {{name}}!");
\`\`\`

[Visit Atlassian](https://www.atlassian.com)
`;

const storageFormat = markdownToConfluenceStorage(markdown);
console.log(storageFormat);