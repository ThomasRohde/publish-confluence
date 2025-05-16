/**
 * A rehype plugin to preserve Handlebars macros during HTML transformation
 */
import { visit } from 'unist-util-visit'

// Regular expression for Handlebars expressions
const handlebarsRegex = /{{([^{}]*)}}/g

/**
 * Plugin that preserves Handlebars expressions by temporarily replacing
 * them with placeholders during HTML transformations and then restoring them.
 */
export default function preserveHandlebars() {
  const replacements = new Map<string, string>()
  let counter = 0

  return (tree: any) => {
    // First pass: replace handlebars expressions with placeholders
    visit(tree, 'text', (node: any) => {
      if (typeof node.value === 'string' && handlebarsRegex.test(node.value)) {
        node.value = node.value.replace(handlebarsRegex, (match: string) => {
          const placeholder = `__HANDLEBARS_PLACEHOLDER_${counter++}__`
          replacements.set(placeholder, match)
          return placeholder
        })
      }
    })    // After all transformations are done, restore the placeholders
    visit(tree, 'text', (node: any) => {
      if (typeof node.value === 'string') {
        for (const [placeholder, original] of replacements.entries()) {
          node.value = node.value.replace(placeholder, original)
        }
      }
    })
  }
}