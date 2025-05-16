/**
 * A rehype plugin to convert HTML to Confluence XHTML storage format
 */
import { visit } from 'unist-util-visit';
import remarkTableFormat from './remarkTableFormat.js';

/**
 * Creates a confluence-image helper string from image properties
 * 
 * @param src The image source URL or path
 * @param alt The image alt text
 * @returns A string with the confluence-image helper
 */
function createImageHelper(src: string, alt: string): string {
  // Clean up any URL-encoded quotes in the src value
  const cleanSrc = src.replace(/%22/g, '');
  return `{{confluence-image src="${cleanSrc}" alt="${alt}"}}`;
}

/**
 * Creates a confluence-expand helper string from details/summary content
 * 
 * @param title The title from the summary tag
 * @param content The content inside the details tag
 * @returns A string with the confluence-expand helper
 */
function createExpandHelper(title: string, content: string): string {
  return `{{#confluence-expand title="${title}"}}
${content}
{{/confluence-expand}}`;
}

/**
 * Creates a confluence-link helper string for a footnote reference
 * 
 * @param id The footnote id (usually numeric)
 * @param label The link text (usually the footnote number)
 * @returns A string with the confluence-link helper
 */
function createFootnoteReferenceHelper(id: string, label: string): string {
  return `{{confluence-link type="anchor" text="${label}" anchor="footnote-${id}"}}`;
}

/**
 * Creates a confluence-anchor helper string for a footnote definition
 * 
 * @param id The footnote id
 * @returns A string with the confluence-anchor helper
 */
function createFootnoteAnchorHelper(id: string): string {
  return `{{confluence-anchor name="footnote-${id}"}}`;
}

/**
 * Creates a confluence-link helper string for a back reference
 * 
 * @param id The footnote id to reference back to
 * @returns A string with the confluence-link helper
 */
function createFootnoteBackReferenceHelper(id: string): string {
  return `{{confluence-link type="anchor" text="↩" anchor="footnote-ref-${id}" tooltip="Back to reference"}}`;
}

/**
 * Creates a confluence-anchor helper string for a footnote reference
 * 
 * @param id The footnote id
 * @returns A string with the confluence-anchor helper
 */
function createFootnoteReferenceAnchorHelper(id: string): string {
  return `{{confluence-anchor name="footnote-ref-${id}"}}`;
}

/**
 * Extracts text content from a node and its children
 * 
 * @param node The node to extract text from
 * @returns The combined text content
 */
function extractTextContent(node: any): string {
  if (!node) return '';
  
  if (node.type === 'text') {
    return node.value || '';
  }
  
  if (node.children && node.children.length > 0) {
    return node.children.map(extractTextContent).join('');
  }
  
  return '';
}

/**
 * Serializes HTML content preserving structure and formatting
 * 
 * @param node The node to serialize
 * @returns The serialized HTML content
 */
function serializeContent(node: any): string {
  if (!node) return '';
  
  if (node.type === 'text') {
    return node.value || '';
  }
  
  if (node.type === 'raw') {
    return node.value || '';
  }
  
  // For element nodes, serialize based on tag type
  if (node.type === 'element') {
    // If this is a nested details tag, it should have already been processed
    // to a raw confluence-expand node
    if (node.tagName === 'details') {
      // This is a processed details node, so just return the serialized version
      return processDetailsNode(node);
    }
    
    // For other element nodes, serialize the start tag, content, and end tag
    let result = '';
    
    // Special handling for certain tags
    switch (node.tagName) {
      case 'br':
        return '<br />';
      case 'hr':
        return '<hr />';
      case 'img':
        // Images should be handled with the image helper
        if (node.properties && node.properties.src) {
          const src = typeof node.properties.src === 'string' ? node.properties.src : '';
          const alt = typeof node.properties.alt === 'string' ? node.properties.alt : '';
          return createImageHelper(src.replace(/%22/g, ''), alt);
        }
        return '';
      case 'a':
        // Special handling for footnote links
        if (node.properties && node.properties.href) {
          const href = node.properties.href;
          
          // Handle footnote reference links
          if (typeof href === 'string') {
            if (href.startsWith('#user-content-fn-')) {
              // Extract the footnote ID (number)
              const footnoteId = href.substring('#user-content-fn-'.length);
              
              // Get the link text (usually the footnote number)
              const label = extractTextContent(node).trim();
              
              // Create a footnote reference anchor for the back link
              const referenceAnchor = createFootnoteReferenceAnchorHelper(footnoteId);
              
              // Create a link to the footnote
              const footnoteLink = createFootnoteReferenceHelper(footnoteId, label);
              
              // Return the combined markup
              return `${referenceAnchor}${footnoteLink}`;
            }
            // Handle footnote back reference links
            else if (href.startsWith('#user-content-fnref-')) {
              // Extract the footnote ID (number)
              const footnoteId = href.substring('#user-content-fnref-'.length);
              
              // Create a back link to the reference
              return createFootnoteBackReferenceHelper(footnoteId);
            }
          }
        }
          // For regular links, pass through to default processing
        // Process as a regular element
        result += `<${node.tagName}`;
        if (node.properties) {
          Object.entries(node.properties).forEach(([key, value]) => {
            if (value === true) {
              result += ` ${key}`;
            } else if (value !== false && value !== null && value !== undefined) {
              // Handle array values (like classes)
              if (Array.isArray(value)) {
                result += ` ${key}="${(value as string[]).join(' ')}"`;
              } else {
                result += ` ${key}="${value}"`;
              }
            }
          });
        }
        result += '>';
        
        // Recursively serialize children
        if (node.children && node.children.length > 0) {
          result += node.children.map(serializeContent).join('');
        }
        
        result += `</a>`;
        return result;
      default:
        // For regular elements, render opening tag with attributes
        result += `<${node.tagName}`;
        if (node.properties) {
          Object.entries(node.properties).forEach(([key, value]) => {
            if (value === true) {
              result += ` ${key}`;
            } else if (value !== false && value !== null && value !== undefined) {
              // Handle array values (like classes)
              if (Array.isArray(value)) {
                result += ` ${key}="${(value as string[]).join(' ')}"`;
              } else {
                result += ` ${key}="${value}"`;
              }
            }
          });
        }
        result += '>';
        
        // Recursively serialize children
        if (node.children && node.children.length > 0) {
          result += node.children.map(serializeContent).join('');
        }
        
        // Add closing tag for non-void elements
        if (!['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 
             'link', 'meta', 'param', 'source', 'track', 'wbr'].includes(node.tagName)) {
          result += `</${node.tagName}>`;
        }
        
        return result;
    }
  }
  
  // For any other node types with children, just serialize the children
  if (node.children && node.children.length > 0) {
    return node.children.map(serializeContent).join('');
  }
  
  return '';
}

/**
 * Process a details node and converts it to a confluence-expand helper
 * 
 * @param node The details node to process
 * @returns The serialized content as a confluence-expand helper
 */
function processDetailsNode(node: any): string {
  let title = 'Details';
  
  // Extract summary text for the title if present
  const summaryNode = node.children.find((child: any) => 
    child.type === 'element' && child.tagName === 'summary');
  
  if (summaryNode) {
    title = extractTextContent(summaryNode).trim();
  }
  
  // Extract remaining content (excluding summary)
  const contentNodes = node.children.filter((child: any) => 
    !(child.type === 'element' && child.tagName === 'summary'));
  
  // Serialize the content preserving the HTML structure
  let detailsContent = '';
  contentNodes.forEach((contentNode: any) => {
    detailsContent += serializeContent(contentNode);
  });
  
  // Return the confluence-expand helper
  return createExpandHelper(title, detailsContent.trim());
}

/**
 * Plugin that transforms HTML to match Confluence XHTML storage format requirements
 */
export default function confluenceXhtml() {
  // Get table formatting logic
  const tableFormatter = remarkTableFormat();
  return (tree: any) => {
    // First apply the table formatting from remarkTableFormat
    tableFormatter(tree);

    // Then continue with the standard XHTML processing
    // Remove body tags without adding XML namespaces
    if (tree.children && tree.children.length > 0) {
      // Look for body elements at any level and remove them, preserving their children
      const processNode = (node: any): any | any[] => {
        if (node.type === 'element') {
          if (node.tagName === 'body') {
            // If we find a body tag, return its children directly
            if (node.children && node.children.length > 0) {
              // Return children instead of the body node
              return node.children;
            }
            return [];
          } else if (node.children && node.children.length > 0) {
            // Process children of non-body elements
            const newChildren: any[] = [];
            node.children.forEach((child: any) => {
              const processed = processNode(child);
              if (Array.isArray(processed)) {
                newChildren.push(...processed);
              } else if (processed) {
                newChildren.push(processed);
              }
            });
            node.children = newChildren;
          }

          // Remove any xmlns attributes
          if (node.properties) {
            const propertiesToRemove = [
              'xmlns:ac',
              'xmlns:ri',
              'xmlns'
            ];

            propertiesToRemove.forEach(prop => {
              if (node.properties[prop]) {
                delete node.properties[prop];
              }
            });
          }
        }
        return node;
      };

      // Process all top-level nodes
      const newChildren: any[] = [];
      tree.children.forEach((child: any) => {
        const processed = processNode(child);
        if (Array.isArray(processed)) {
          newChildren.push(...processed);
        } else if (processed) {
          newChildren.push(processed);
        }
      });
      tree.children = newChildren;
    }

    // Process details elements bottom up (process nested details first)
    // This allows us to handle nested details properly
    const detailsNodes: any[] = [];
    visit(tree, { tagName: 'details' }, (node: any) => {
      detailsNodes.push(node);
    });

    // Sort details nodes by nesting level (deepest first)
    detailsNodes.sort((a, b) => {
      const aDepth = getNodeDepth(a);
      const bDepth = getNodeDepth(b);
      return bDepth - aDepth; // Sort deepest first
    });

    // Process each details node
    detailsNodes.forEach(node => {
      const rawContent = processDetailsNode(node);
      
      // Create a raw node with the confluence-expand helper
      const newNode = {
        type: 'raw',
        value: rawContent
      };
      
      // Replace the current node with our raw node
      Object.keys(node).forEach(key => {
        delete node[key];
      });
      Object.assign(node, newNode);
    });

    // Transform other specific elements to match Confluence XHTML format
    visit(tree, 'element', (node: any) => {      
      // Handle code blocks
      if (node.tagName === 'pre' && node.children.length === 1 &&
        node.children[0].type === 'element' && node.children[0].tagName === 'code') {

        // Extract language from class if present
        const codeNode = node.children[0]
        let language = ''

        if (codeNode.properties && codeNode.properties.className) {
          const classes = Array.isArray(codeNode.properties.className)
            ? codeNode.properties.className
            : [codeNode.properties.className]

          for (const cls of classes) {
            if (typeof cls === 'string' && cls.startsWith('language-')) {
              language = cls.substring(9)
              break
            }
          }
        }

        // Get the code content
        const codeContent = codeNode.children[0]?.type === 'text'
          ? codeNode.children[0].value
          : '';        // Create a handlebars helper for the code block instead of a Confluence macro
        // Using the publish-confluence handlebars helper format
        const handlebarsHelper = `{{#confluence-code language="${language}"${language ? '' : ' language="text"'} linenumbers=true}}
${codeContent.trimEnd()}
{{/confluence-code}}`;

        // Create a raw node with the handlebars helper
        const newNode = {
          type: 'raw',
          value: handlebarsHelper
        };

        // Replace the current node with our raw node
        Object.keys(node).forEach(key => {
          delete node[key];
        });
        Object.assign(node, newNode);
      }
      // Transform links
      else if (node.tagName === 'a' && node.properties && node.properties.href) {
        const href = node.properties.href;
        
        // Check if this is a footnote reference
        if (href && typeof href === 'string' && href.startsWith('#user-content-fn-')) {
          // Extract the footnote ID (number)
          const footnoteId = href.substring('#user-content-fn-'.length);
          
          // Get the link text (usually the footnote number)
          const label = extractTextContent(node).trim();
          
          // Create a footnote reference anchor for the back link
          const referenceAnchor = createFootnoteReferenceAnchorHelper(footnoteId);
          
          // Create a link to the footnote
          const footnoteLink = createFootnoteReferenceHelper(footnoteId, label);
          
          // Create the combined markup
          const rawContent = `${referenceAnchor}${footnoteLink}`;
          
          // Create a raw node with the combined markup
          const newNode = {
            type: 'raw',
            value: rawContent
          };
          
          // Replace the current node with our raw node
          Object.keys(node).forEach(key => {
            delete node[key];
          });
          Object.assign(node, newNode);
        }
        // Check if this is a footnote back reference
        else if (href && typeof href === 'string' && href.startsWith('#user-content-fnref-')) {
          // Extract the footnote ID (number)
          const footnoteId = href.substring('#user-content-fnref-'.length);
          
          // Create a back link to the reference
          const backLink = createFootnoteBackReferenceHelper(footnoteId);
          
          // Create a raw node with the back link
          const newNode = {
            type: 'raw',
            value: backLink
          };
          
          // Replace the current node with our raw node
          Object.keys(node).forEach(key => {
            delete node[key];
          });
          Object.assign(node, newNode);
        }
        // Keep other links as is
      }      
      // Transform images - this is now handled in the serializeContent function for nested cases
      else if (node.tagName === 'img' && node.properties && node.properties.src) {
        let src = typeof node.properties.src === 'string' ? node.properties.src : '';
        const alt = typeof node.properties.alt === 'string' ? node.properties.alt : '';
        
        // Clean up any URL-encoded quotes in the src value
        src = src.replace(/%22/g, '');

        // Create a raw node with the confluence-image helper
        const newNode = {
          type: 'raw',
          value: createImageHelper(src, alt)
        };
        // Replace the current node with our raw node
        Object.keys(node).forEach(key => {
          delete node[key];
        });
        Object.assign(node, newNode);
      }      
      // Convert markdown tables to proper Confluence XHTML format
      else if (node.tagName === 'table') {        
        // Add Confluence table attributes
        if (!node.properties) {
          node.properties = {}
        }

        // No styling classes needed
        // node.properties.class = 'confluenceTable'

        // Process rows to add appropriate Confluence attributes
        visit(node, { tagName: 'tr' }, (trNode: any) => {
          if (!trNode.properties) {
            trNode.properties = {}
          }
        })        
        // Process table headers with Confluence-specific attributes
        visit(node, { tagName: 'th' }, (thNode: any) => {
          if (!thNode.properties) {
            thNode.properties = {}
          }
          // No styling classes needed
          // thNode.properties.class = 'confluenceTh'
          // Add any additional Confluence header attributes
          thNode.properties.scope = 'col'
          
          // Convert alignment attributes to style-based alignment
          if (thNode.properties.align) {
            // If there's no style property, create it
            if (!thNode.properties.style) {
              thNode.properties.style = ''
            }
            
            // Add text-align style based on the align attribute
            thNode.properties.style = `text-align: ${thNode.properties.align};${thNode.properties.style ? ' ' + thNode.properties.style : ''}`
            
            // Remove the align attribute
            delete thNode.properties.align
          }
        })

        // Process table cells with Confluence-specific attributes
        visit(node, { tagName: 'td' }, (tdNode: any) => {
          if (!tdNode.properties) {
            tdNode.properties = {}
          }
          // No styling classes needed
          // tdNode.properties.class = 'confluenceTd'
          
          // Convert alignment attributes to style-based alignment
          if (tdNode.properties.align) {
            // If there's no style property, create it
            if (!tdNode.properties.style) {
              tdNode.properties.style = ''
            }
            
            // Add text-align style based on the align attribute
            tdNode.properties.style = `text-align: ${tdNode.properties.align};${tdNode.properties.style ? ' ' + tdNode.properties.style : ''}`
            
            // Remove the align attribute
            delete tdNode.properties.align
          }
        })
      }
      // Process footnote sections
      else if (node.tagName === 'section' && node.properties && node.properties.dataFootnotes !== undefined) {
        // Create a heading for the footnotes if needed
        let footnoteSection = '<h2>Footnotes</h2>\n';
        
        // Process each footnote list item
        if (node.children) {
          // Skip the heading (first child) if present
          const listNode = node.children.find((child: any) => 
            child.type === 'element' && child.tagName === 'ol');
            
          if (listNode && listNode.children) {
            // Process each footnote list item
            listNode.children.forEach((item: any) => {
              if (item.type === 'element' && item.tagName === 'li' && item.properties && item.properties.id) {
                // Extract the footnote ID from the li id
                const idAttr = item.properties.id;
                if (typeof idAttr === 'string' && idAttr.startsWith('user-content-fn-')) {
                  const footnoteId = idAttr.substring('user-content-fn-'.length);
                  
                  // Create anchor for this footnote
                  footnoteSection += createFootnoteAnchorHelper(footnoteId);
                    // Process the content of the footnote
                  if (item.children && item.children.length > 0) {
                    // First, handle any back references in the footnote content
                    for (const child of item.children) {
                      if (child.type === 'element' && child.tagName === 'p') {
                        // Look for the back reference link inside the paragraph
                        for (let i = 0; i < child.children.length; i++) {
                          const linkNode = child.children[i];
                          if (linkNode.type === 'element' && linkNode.tagName === 'a' && 
                              linkNode.properties && linkNode.properties.href && 
                              typeof linkNode.properties.href === 'string' && 
                              linkNode.properties.href.startsWith('#user-content-fnref-')) {
                            
                            // Extract the footnote ID (number) from the back reference
                            const backRefId = linkNode.properties.href.substring('#user-content-fnref-'.length);
                            
                            // Create the back reference helper
                            const backRefHelper = createFootnoteBackReferenceHelper(backRefId);
                              // Replace the link node with a raw node containing the helper
                            child.children[i] = {
                              type: 'raw',
                              value: backRefHelper
                            };
                          }
                        }
                      }
                    }
                    
                    // Now serialize the content with our modifications
                    item.children.forEach((child: any) => {
                      footnoteSection += serializeContent(child);
                    });
                  }
                  
                  footnoteSection += '\n\n';
                }
              }
            });
          }
        }
        
        // Create a raw node with the footnote section
        const newNode = {
          type: 'raw',
          value: footnoteSection
        };
        
        // Replace the current node with our raw node
        Object.keys(node).forEach(key => {
          delete node[key];
        });
        Object.assign(node, newNode);
      }
      // Process individual footnote list items
      else if (node.tagName === 'li' && node.properties && node.properties.id && 
               typeof node.properties.id === 'string' && node.properties.id.startsWith('user-content-fn-')) {
        // Skip processing individual footnote items directly
        // They'll be handled by the parent section processor
      }
    });

    // Process footnote sections
    visit(tree, { type: 'element', tagName: 'section' }, (node: any) => {
      if (node.properties && 
          node.properties.dataFootnotes !== undefined || 
          (node.properties.className && node.properties.className.includes('footnotes'))) {
        
        // Process footnote list items
        visit(node, { type: 'element', tagName: 'li' }, (liNode: any) => {
          if (liNode.properties && liNode.properties.id && 
              typeof liNode.properties.id === 'string' && 
              liNode.properties.id.startsWith('user-content-fn-')) {
            
            // Extract the footnote ID
            const footnoteId = liNode.properties.id.substring('user-content-fn-'.length);
            
            // Create anchor at the beginning of the footnote
            const anchorHelper = createFootnoteAnchorHelper(footnoteId);
            
            // If first child is a paragraph, insert the anchor before the content
            if (liNode.children && liNode.children.length > 0) {
              const firstChild = liNode.children[0];
              
              if (firstChild.type === 'element' && firstChild.tagName === 'p') {
                // Add anchor before paragraph content
                const anchorNode = {
                  type: 'raw',
                  value: anchorHelper
                };
                
                // Insert the anchor node at the beginning of the paragraph's children
                if (!firstChild.children) {
                  firstChild.children = [];
                }
                
                firstChild.children.unshift(anchorNode);
              }
            }
          }
        });
      }
    });

    return tree;
  };
}

/**
 * Helper function to get the nesting depth of a node
 * Used for ordering nested details elements
 */
function getNodeDepth(node: any): number {
  let depth = 0;
  let current = node;
  
  // Find details tags in children
  const hasDetailsChild = (n: any): boolean => {
    if (!n.children) return false;
    return n.children.some((child: any) => 
      child.type === 'element' && child.tagName === 'details' || hasDetailsChild(child)
    );
  };
  
  if (hasDetailsChild(current)) {
    depth += 1;
  }
  
  return depth;
}