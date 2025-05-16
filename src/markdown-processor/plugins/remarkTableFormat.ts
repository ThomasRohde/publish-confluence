/**
 * A remark plugin to improve table conversion for Confluence
 */
import { visit } from 'unist-util-visit'

/**
 * Plugin that improves table formatting for Confluence XHTML output
 */
export default function remarkTableFormat() {
  return (tree: any) => {
    // Find markdown tables and add attributes
    visit(tree, 'table', (node: any) => {      // Add data attribute to help with identification
      if (!node.data) {
        node.data = {}
      }
      
      if (!node.data.hProperties) {
        node.data.hProperties = {}
      }
      
      // No styling classes needed
      // node.data.hProperties.className = 'confluenceTable'
      
      // Process table cells
      if (node.children) {
        // Handle table headers
        if (node.children[0] && node.children[0].type === 'tableRow') {
          const headerRow = node.children[0]
          
          if (headerRow.children) {
            headerRow.children.forEach((cell: any) => {
              if (!cell.data) {
                cell.data = {}
              }
                if (!cell.data.hProperties) {
                cell.data.hProperties = {}
              }
              
              // No styling classes needed
              // cell.data.hProperties.className = 'confluenceTh'
            })
          }
        }
        
        // Handle table body rows
        for (let i = 1; i < node.children.length; i++) {
          const row = node.children[i]
          
          if (row.children) {
            row.children.forEach((cell: any) => {
              if (!cell.data) {
                cell.data = {}
              }
                if (!cell.data.hProperties) {
                cell.data.hProperties = {}
              }
              
              // No styling classes needed
              // cell.data.hProperties.className = 'confluenceTd'
            })
          }
        }
      }
    })
  }
}
