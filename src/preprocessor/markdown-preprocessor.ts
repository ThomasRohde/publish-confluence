/**
 * Markdown preprocessor for publish-confluence
 * Converts Markdown to HTML/XHTML with Confluence-specific macros
 */
import { registerPreprocessor, Preprocessor } from './index';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import { h } from 'hastscript';
import { toHtml } from 'hast-util-to-html';
import type { Plugin } from 'unified';
import type { VFile } from 'vfile';
import type { Node } from 'unist';
import type { Root } from 'remark-parse/lib';

/**
 * Remark plugin to convert Markdown to Confluence-compatible XHTML/Handlebars
 */
const remarkToPublishConfluence: Plugin<[], Root> = function() {
  return (tree: Root) => {
    const toHast = (node: any): any => {
      switch (node.type) {
        case 'heading':   return h(`h${node.depth}`, node.children.map(toHast));
        case 'paragraph': return h('p', node.children.map(toHast));
        case 'text':      return node.value;
        case 'strong':    return h('strong', node.children.map(toHast));
        case 'emphasis':  return h('em', node.children.map(toHast));
        case 'link':      return h('a', { href: node.url }, node.children.map(toHast));
        case 'list':      return h(node.ordered ? 'ol' : 'ul', node.children.map(toHast));
        case 'listItem':  return h('li', node.children.map(toHast));

        // Confluence macro mappings
        case 'blockquote':
          return h('ac:structured-macro', { 'ac:name': 'info' }, [
            h('ac:rich-text-body', node.children.map(toHast))
          ]);
        case 'code':
          return h('ac:structured-macro', { 'ac:name': 'code' }, [
            h('ac:parameter', { 'ac:name': 'language' }, node.lang || ''),
            h('ac:plain-text-body', h('![CDATA[', node.value))
          ]);
        case 'inlineCode':
          return h('code', node.value);
        case 'image':
          return h('ac:image', { 'ac:alt': node.alt || '' }, [
            h('ri:attachment', { 'ri:filename': node.url })
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
};

/**
 * Convert Markdown to Confluence-compatible XHTML
 * @param src The Markdown source
 * @returns Promise resolving to the processed XHTML content
 */
async function md2xhtml(src: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkToPublishConfluence)
    .process(src);

  // Return generated XHTML
  const xhtml = (file.data as any)?.xhtml;
  return String(xhtml || file.value);
}

/**
 * Markdown preprocessor implementation
 */
const markdownPreprocessor: Preprocessor = {
  format: 'markdown',
  async process(raw: string) {
    return md2xhtml(raw);
  }
};

// Register the markdown preprocessor
registerPreprocessor(markdownPreprocessor);

export default markdownPreprocessor;
