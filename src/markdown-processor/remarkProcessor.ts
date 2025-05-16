import fs from 'node:fs/promises'
import path from 'node:path'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { confluenceXhtml, preserveHandlebars, remarkTableFormat } from './plugins'

/**
 * Processes Markdown content and converts it to Confluence XHTML
 * @param input Markdown content to process
 * @returns Processed Confluence XHTML content
 */
export async function processMarkdown(input: string): Promise<string> {
  // Create the processor
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkTableFormat as any)
    .use(remarkRehype, {
      allowDangerousHtml: true 
    })
    .use(rehypeRaw)
    .use(preserveHandlebars as any)
    .use(confluenceXhtml as any)

  // Parse the input to a syntax tree
  const tree = processor.parse(input);
  
  // Run all plugins (transformations)
  const transformed = await processor.run(tree);
  
  // Serialize the transformed tree
  const output = customSerializer(transformed);
  
  // Clean up the output by removing excessive blank lines
  return output.replace(/\n{3,}/g, '\n\n');
}

/**
 * Custom serializer: outputs 'raw' nodes as-is, otherwise uses a simple HTML serializer
 */
function customSerializer(tree: any) {
  function serialize(node: any): string {
    if (node.type === 'raw') {
      return node.value;
    }
    if (node.type === 'text') {
      // Trim excessive whitespace but preserve necessary spaces
      return node.value.replace(/\n\s*\n/g, '\n');
    }
    if (node.type === 'element') {
      const tag = node.tagName;
      const props = node.properties || {};
      const attrs = Object.entries(props)
        .map(([k, v]) => v === undefined ? '' : ` ${k}="${v}"`).join('');
      // Serialize all children, outputting 'raw' node values directly
      const children = (node.children || []).map((child: any) => {
        if (child.type === 'raw') return child.value;
        return serialize(child);
      }).join('');
      return `<${tag}${attrs}>${children}</${tag}>`;
    }
    if (Array.isArray(node.children)) {
      return node.children.map(serialize).join('');
    }
    return '';
  }
  return serialize(tree);
}

/**
 * Processes a Markdown file and optionally saves the result
 * @param inputPath Path to input Markdown file
 * @param outputPath Optional path to save output. If not provided, output is returned
 * @returns Processed content as string if outputPath is not provided
 */
export async function processMarkdownFile(
  inputPath: string, 
  outputPath?: string
): Promise<string | void> {
  // Read the input file
  const resolvedInputPath = path.resolve(process.cwd(), inputPath)
  const input = await fs.readFile(resolvedInputPath, 'utf8')
  
  // Process the content
  const cleanedOutput = await processMarkdown(input)
  
  // Write to output file or return the result
  if (outputPath) {
    const resolvedOutputPath = path.resolve(process.cwd(), outputPath)
    await fs.writeFile(resolvedOutputPath, cleanedOutput, 'utf8')
    return
  }
  
  return cleanedOutput
}
