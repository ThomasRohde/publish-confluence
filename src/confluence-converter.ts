// src/confluence-converter.ts
import { DOMParser } from 'xmldom';
import { createLogger } from './logger';

const log = createLogger();

/**
 * Transforms Confluence storage format content to HTML for preview
 */
export class ConfluenceConverter {
  private static readonly DOM_PARSER = new DOMParser({
    errorHandler: {
      warning: () => {}, // Suppress warnings
      error: (msg) => log.debug(`XML Parse Error: ${msg}`),
      fatalError: (msg) => log.error(`Fatal XML Parse Error: ${msg}`)
    }
  });
  /**
   * Converts the Confluence storage format to proper HTML
   * @param content The Confluence storage format content
   * @param attachmentBaseUrl Base URL for attachment references
   * @returns The converted HTML content
   */
  static convertStorageToHtml(content: string, attachmentBaseUrl: string): string {
    try {
      // Handle special XML entities that might be in the content, but in a more targeted way
      // We don't want to convert all entity references as those in code blocks should remain escaped
      const sanitizedContent = content
        .replace(/&nbsp;/g, '\u00A0')  // Non-breaking space
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        // Only convert essential XML entities outside of code blocks
        // This improved approach preserves HTML entities in code contexts
        .replace(/&lt;(\/?)code(\s+[^>]*)?>/gi, '<$1code$2>') // Special handling for code tags
        .replace(/&amp;([a-z]+);/g, '&$1;'); // Fix double-escaped entities

      // Wrap in a root element if not already present to ensure valid XML
      const xmlContent = sanitizedContent.trim().startsWith('<')
        ? `<div>${sanitizedContent}</div>`
        : sanitizedContent;

      const doc = this.DOM_PARSER.parseFromString(xmlContent, 'text/xml');
      
      // Process Confluence-specific elements
      return this.processNode(doc.documentElement, attachmentBaseUrl);
    } catch (error) {
      log.error(`Error converting Confluence storage format: ${(error as Error).message}`);
      return `<div class="error">Error converting content: ${(error as Error).message}</div>` + 
        `<pre>${content}</pre>`;
    }
  }
  /**
   * Recursively processes XML nodes to convert to HTML
   * @param node The XML node to process
   * @param attachmentBaseUrl Base URL for attachment references
   * @returns The processed HTML string
   */
  private static processNode(node: Node, attachmentBaseUrl: string): string {
    if (node.nodeType === 3) { // Text node
      return node.nodeValue || '';
    }

    if (node.nodeType !== 1) { // Not an element, skip
      return '';
    }

    const element = node as Element;
    const nodeName = element.nodeName.toLowerCase();
    
    // Handle Confluence-specific elements
    if (nodeName.startsWith('ac:')) {
      return this.processConfluenceElement(element, attachmentBaseUrl);
    }

    // Handle resource identifiers
    if (nodeName.startsWith('ri:')) {
      const result = this.processResourceIdentifier(element, attachmentBaseUrl);
      // If it's a page link object (with href and title), convert it to an anchor tag
      if (typeof result === 'object' && 'href' in result) {
        return `<a href="${result.href}">${result.title}</a>`;
      }
      return result;
    }

    // Handle Confluence tables
    if (nodeName === 'table') {
      return this.processConfluenceTable(element, attachmentBaseUrl);
    }

    // Special handling for code elements - we need to escape HTML inside them
    if (nodeName === 'code') {
      // Create the opening tag
      let result = '<code';
      if (element.attributes) {
        for (let i = 0; i < element.attributes.length; i++) {
          const attr = element.attributes[i];
          result += ` ${attr.name}="${attr.value}"`;
        }
      }
      result += '>';
      
      // Escape the content inside code elements
      for (let i = 0; i < element.childNodes.length; i++) {
        if (element.childNodes[i].nodeType === 3) { // Text node
          result += this.escapeHtml(element.childNodes[i].nodeValue || '');
        } else {
          result += this.processNode(element.childNodes[i], attachmentBaseUrl);
        }
      }
      
      return `${result}</code>`;
    }

    // For standard HTML elements, recreate them with their attributes
    let result = `<${nodeName}`;
    
    // Copy attributes
    if (element.attributes) {
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        result += ` ${attr.name}="${attr.value}"`;
      }
    }

    if (element.childNodes.length === 0) {
      // Self-closing tag
      return `${result} />`;
    }

    result += '>';

    // Process child nodes
    for (let i = 0; i < element.childNodes.length; i++) {
      result += this.processNode(element.childNodes[i], attachmentBaseUrl);
    }

    return `${result}</${nodeName}>`;
  }

  /**
   * Process Confluence-specific elements (ac: namespace)
   * @param element The Confluence element
   * @param attachmentBaseUrl Base URL for attachment references
   * @returns The processed HTML string
   */
  private static processConfluenceElement(element: Element, attachmentBaseUrl: string): string {
    const nodeName = element.nodeName.toLowerCase();
    
    // Handle specific Confluence elements
    switch (nodeName) {
      case 'ac:image':
        return this.processConfluenceImage(element, attachmentBaseUrl);
      
      case 'ac:link':
        return this.processConfluenceLink(element, attachmentBaseUrl);

      case 'ac:structured-macro':
        return this.processConfluenceMacro(element, attachmentBaseUrl);

      case 'ac:task-list':
        return this.processConfluenceTaskList(element, attachmentBaseUrl);

      case 'ac:emoticon':
        return this.processConfluenceEmoticon(element);

      case 'ac:layout':
        return this.processConfluenceLayout(element, attachmentBaseUrl);

      case 'ac:plain-text-link-body':
        // Process CDATA content
        const cdataContent = Array.from(element.childNodes)
          .filter(node => node.nodeType === 4) // CDATA
          .map(node => node.nodeValue || '')
          .join('');
        return cdataContent || this.processChildren(element, attachmentBaseUrl);

      default:
        // For unhandled Confluence elements, process their children
        return this.processChildren(element, attachmentBaseUrl);
    }
  }

  /**
   * Process children of an element
   * @param element The element whose children should be processed
   * @param attachmentBaseUrl Base URL for attachment references
   * @returns The processed HTML of all children
   */
  private static processChildren(element: Element, attachmentBaseUrl: string): string {
    let result = '';
    for (let i = 0; i < element.childNodes.length; i++) {
      result += this.processNode(element.childNodes[i], attachmentBaseUrl);
    }
    return result;
  }

  /**
   * Process Confluence image element
   * @param element The ac:image element
   * @param attachmentBaseUrl Base URL for attachment references
   * @returns The HTML img tag
   */
  private static processConfluenceImage(element: Element, attachmentBaseUrl: string): string {
    let imgSrc = '#';
    let altText = 'Image';
    
    // Extract attributes
    const attributes: Record<string, string> = {};
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      const name = attr.name.replace('ac:', '');
      attributes[name] = attr.value;
    }

    // Process child resource identifiers to find the image source
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i] as Element;
      if (!child.nodeName) continue;
      
      const nodeName = child.nodeName.toLowerCase();
      
      if (nodeName === 'ri:url') {
        const value = child.getAttribute('ri:value');
        if (value) imgSrc = value;
      } 
      else if (nodeName === 'ri:attachment') {
        const filename = child.getAttribute('ri:filename');
        if (filename) {
          imgSrc = `${attachmentBaseUrl}/${filename}`;
        }
      }
    }

    // Build the img tag with attributes
    let imgHtml = `<img src="${imgSrc}" alt="${attributes.alt || altText}"`;
    
    if (attributes.height) imgHtml += ` height="${attributes.height}"`;
    if (attributes.width) imgHtml += ` width="${attributes.width}"`;
    if (attributes.title) imgHtml += ` title="${attributes.title}"`;
    if (attributes.class) imgHtml += ` class="${attributes.class}"`;
    if (attributes.style) imgHtml += ` style="${attributes.style}"`;
    
    return imgHtml + ' />';
  }
  /**
   * Process Confluence link element
   * @param element The ac:link element
   * @param attachmentBaseUrl Base URL for attachment references
   * @returns The HTML anchor tag
   */
  private static processConfluenceLink(element: Element, attachmentBaseUrl: string): string {
    let href = '#';
    let linkText = '';
    let anchorName = element.getAttribute('ac:anchor') || '';

    // Process child nodes to extract link details
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i] as Element;
      if (!child.nodeName) continue;
      
      const nodeName = child.nodeName.toLowerCase();
        if (nodeName === 'ri:page') {
        const pageTitle = child.getAttribute('ri:content-title') || '';
        const spaceKey = child.getAttribute('ri:space-key') || '';
        
        // Store the original page title for use as link text if no explicit text is provided
        if (!linkText) {
          linkText = pageTitle;
        }
        
        // In dry run, we need to link directly to the HTML files
        // Use a more URL-safe filename by replacing problematic characters
        const safeFilename = pageTitle.replace(/[^a-zA-Z0-9-_.]/g, '_');
        
        // For dry run previews, create a relative path to the page file
        if (spaceKey) {
          // Link to another space
          href = `../${spaceKey}/${safeFilename}.html`;
        } else {
          // Link within the same space, use the current directory
          href = `./${safeFilename}.html`;
        }
      } else if (nodeName === 'ri:attachment') {
        const filename = child.getAttribute('ri:filename');
        if (filename) {
          href = `${attachmentBaseUrl}/${filename}`;
        }
      }      else if (nodeName === 'ac:plain-text-link-body' || nodeName === 'ac:link-body') {
        // Process the link body to get the displayed text
        const processedLinkText = this.processNode(child, attachmentBaseUrl);
        // Only use this if it's non-empty (could be an empty self-closing tag)
        if (processedLinkText && processedLinkText.trim()) {
          linkText = processedLinkText;
        }
      }
    }    // If no link text was provided after processing all children, use a fallback
    if (!linkText) {
      // For page links, the link text should preferably be the original page title
      const pageNode = Array.from(element.childNodes)
        .find(child => (child as Element).nodeName?.toLowerCase() === 'ri:page') as Element;
      
      if (pageNode) {
        // Use the original page title from ri:content-title
        const pageTitle = pageNode.getAttribute('ri:content-title') || '';
        if (pageTitle) {
          linkText = pageTitle;
        }
      }
      
      // If we still don't have link text, try to extract it from the href
      if (!linkText) {
        const match = href.match(/\/([^\/]+)\.html$/);
        if (match) {
          // Convert the filename back to a readable title
          const filename = match[1];
          // Replace underscores with spaces
          linkText = filename.replace(/_/g, ' ');
        } else {
          // Last resort: fallback to using href
          linkText = href;
        }
      }
    }

    // Add anchor if specified
    if (anchorName) {
      href += `#${anchorName}`;
    }

    return `<a href="${href}">${linkText}</a>`;
  }

  /**
   * Process Confluence macro element
   * @param element The ac:structured-macro element
   * @param attachmentBaseUrl Base URL for attachment references
   * @returns The HTML representation of the macro
   */  private static processConfluenceMacro(element: Element, attachmentBaseUrl: string): string {
    const macroName = element.getAttribute('ac:name') || 'unknown';
    // Handle specific macros
    switch (macroName) {
      case 'code':
        return this.processCodeMacro(element, attachmentBaseUrl);
      
      case 'html':
        return this.processHtmlMacro(element);
      
      case 'panel':
        return this.processPanelMacro(element, attachmentBaseUrl);
      
      case 'tabs-group':
        return this.processTabsGroupMacro(element, attachmentBaseUrl);
        
      case 'tab-pane':
        return this.processTabPaneMacro(element, attachmentBaseUrl);
      
      case 'note':
      case 'info':
      case 'warning':
      case 'tip':
        return this.processAdmonitionMacro(element, macroName, attachmentBaseUrl);
        
      case 'column':
        return `<div class="confluence-column">${this.processChildren(element, attachmentBaseUrl)}</div>`;
        
      case 'section':
        return `<div class="confluence-section">${this.processChildren(element, attachmentBaseUrl)}</div>`;
        
      case 'table-of-contents':
        return `<div class="confluence-toc"><div class="toc-header">Table of Contents</div><div class="toc-placeholder">[Table of Contents would appear here]</div></div>`;
        
      case 'expand':
        let title = 'Click to expand...';
        let expandContent = '';
        
        // Extract title and content
        for (let i = 0; i < element.childNodes.length; i++) {
          const child = element.childNodes[i] as Element;
          if (!child.nodeName) continue;
          
          const nodeName = child.nodeName.toLowerCase();
          
          if (nodeName === 'ac:parameter' && child.getAttribute('ac:name') === 'title') {
            title = child.textContent || title;
          } else if (nodeName === 'ac:rich-text-body') {
            expandContent = this.processChildren(child, attachmentBaseUrl);
          }
        }
        
        return `
          <div class="confluence-expand-macro">
            <div class="expand-header" onclick="this.parentElement.classList.toggle('expanded')">
              <span class="expand-icon">▶</span>
              <span>${title}</span>
            </div>
            <div class="expand-content">${expandContent}</div>
          </div>
        `;
      
      case 'status':
        let color = 'grey';
        let text = 'Status';
        
        // Extract parameters
        for (let i = 0; i < element.childNodes.length; i++) {
          const child = element.childNodes[i] as Element;
          if (!child.nodeName) continue;
          
          if (child.nodeName.toLowerCase() === 'ac:parameter') {
            const paramName = child.getAttribute('ac:name');
            
            if (paramName === 'colour' || paramName === 'color') {
              color = (child.textContent || '').toLowerCase();
            } else if (paramName === 'title') {
              text = child.textContent || text;
            }
          }
        }
        
        return `<span class="confluence-status confluence-status-${color}">${text}</span>`;
        
      case 'chart':
        return `<div class="confluence-chart-placeholder">[Chart: ${element.getAttribute('ac:name')}]</div>`;
                
      default:
        // For unhandled macros, display a placeholder with the macro name
        return `<div class="confluence-macro confluence-macro-${macroName}">
          <div class="macro-title">${macroName}</div>
          <div class="macro-body">${this.processChildren(element, attachmentBaseUrl)}</div>
        </div>`;
    }
  }

  /**
   * Process Confluence code macro
   * @param element The code macro element
   * @param attachmentBaseUrl Base URL for attachment references
   * @returns The HTML code block
   */  private static processCodeMacro(element: Element, attachmentBaseUrl: string): string {
    // Extract parameters
    let language = 'text';
    let title = '';
    let code = '';
    
    // Process child nodes to find parameters and content
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i] as Element;
      if (!child.nodeName) continue;
      
      const nodeName = child.nodeName.toLowerCase();
      
      if (nodeName === 'ac:parameter') {
        const paramName = child.getAttribute('ac:name');
        if (paramName === 'language') {
          language = (child.textContent || '').trim();
        } else if (paramName === 'title') {
          title = (child.textContent || '').trim();
        }
      }
      else if (nodeName === 'ac:plain-text-body') {
        // Extract CDATA content
        const cdataNodes = Array.from(child.childNodes).filter(node => node.nodeType === 4);
        if (cdataNodes.length > 0) {
          code = cdataNodes.map(node => node.nodeValue || '').join('');
        } else {
          code = child.textContent || '';
        }
      }
    }

    // Build HTML representation
    let result = '<div class="code-block">';
    if (title) {
      result += `<div class="code-title">${title}</div>`;
    }
    // Double escape the code content to ensure HTML in code blocks displays correctly
    result += `<pre class="language-${language}"><code>${this.escapeHtml(code)}</code></pre>`;
    result += '</div>';
    
    return result;
  }

  /**
   * Process Confluence HTML macro
   * @param element The html macro element
   * @returns The HTML content
   */
  private static processHtmlMacro(element: Element): string {
    let html = '';
    
    // Process child nodes to find the HTML content
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i] as Element;
      if (!child.nodeName) continue;
      
      const nodeName = child.nodeName.toLowerCase();
      
      if (nodeName === 'ac:plain-text-body') {
        // Extract CDATA content
        const cdataNodes = Array.from(child.childNodes).filter(node => node.nodeType === 4);
        if (cdataNodes.length > 0) {
          html = cdataNodes.map(node => node.nodeValue || '').join('');
        } else {
          html = child.textContent || '';
        }
      }
    }

    // Return the HTML content wrapped in a div for safety
    return `<div class="html-macro">${html}</div>`;
  }

  /**
   * Process Confluence panel macro
   * @param element The panel macro element
   * @param attachmentBaseUrl Base URL for attachment references
   * @returns The HTML panel
   */
  private static processPanelMacro(element: Element, attachmentBaseUrl: string): string {
    // Extract parameters
    let title = '';
    let content = '';
    let panelType = '';
    
    // Process child nodes to find parameters and content
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i] as Element;
      if (!child.nodeName) continue;
      
      const nodeName = child.nodeName.toLowerCase();
      
      if (nodeName === 'ac:parameter') {
        const paramName = child.getAttribute('ac:name');
        if (paramName === 'title') {
          title = (child.textContent || '').trim();
        } else if (paramName === 'type') {
          panelType = (child.textContent || '').trim();
        }
      }
      else if (nodeName === 'ac:rich-text-body') {
        content = this.processChildren(child, attachmentBaseUrl);
      }
    }

    // Build HTML representation
    let result = `<div class="panel panel-${panelType || 'default'}">`;
    if (title) {
      result += `<div class="panel-heading">${title}</div>`;
    }
    result += `<div class="panel-body">${content}</div>`;
    result += '</div>';
    
    return result;
  }  /**
   * Process Confluence tabs-group macro
   * @param element The tabs-group macro element
   * @param attachmentBaseUrl Base URL for attachment references
   * @returns The HTML tabs group
   */
  private static processTabsGroupMacro(element: Element, attachmentBaseUrl: string): string {
    // Extract parameters and content
    let disposition = 'horizontal';
    let outline = false;
    let color = '';
    let content = '';
    
    // Process child nodes to find parameters and content
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i] as Element;
      if (!child.nodeName) continue;
      
      const nodeName = child.nodeName.toLowerCase();
      
      if (nodeName === 'ac:parameter') {
        const paramName = child.getAttribute('ac:name');
        if (paramName === 'disposition') {
          disposition = (child.textContent || 'horizontal').trim().toLowerCase();
        } else if (paramName === 'outline') {
          const outlineText = (child.textContent || 'false').trim().toLowerCase();
          outline = outlineText === 'true';
        } else if (paramName === 'color') {
          color = (child.textContent || '').trim();
        }
      }
      else if (nodeName === 'ac:rich-text-body') {
        content = this.processChildren(child, attachmentBaseUrl);
      }
    }

    // Generate a unique ID for this tab group
    const tabGroupId = `tabs-${Math.random().toString(36).substring(2, 9)}`;
    
    // Build HTML representation that matches the expected structure in preview.ts
    return `<div id="${tabGroupId}" class="confluence-tabs confluence-tabs-${disposition} ${outline ? 'with-outline' : ''}" ${color ? `style="--primary-color:${color}"` : ''}>
      <div class="tabs-menu"></div>
      <div class="tabs-content">${content}</div>
    </div>
    <script>
      // Post-processing to organize tabs correctly
      (function() {
        const tabGroup = document.getElementById('${tabGroupId}');
        if (!tabGroup) return;
        
        const tabsMenu = tabGroup.querySelector('.tabs-menu');
        const tabsContent = tabGroup.querySelector('.tabs-content');
        
        if (!tabsMenu || !tabsContent) return;
        
        // Find all tab panes and move them properly
        const tabPanes = Array.from(tabsContent.querySelectorAll('.tab-pane'));
        
        // Clear the current content (we'll rebuild it)
        tabsContent.innerHTML = '';
        
        // Process each tab pane
        tabPanes.forEach((pane, index) => {
          const title = pane.querySelector('h3');
          const content = pane.querySelector('.tab-content');
          
          if (title && content) {
            // Create tab ID
            const tabId = \`${tabGroupId}-tab-\${index}\`;
            
            // Create tab menu item
            const menuItem = document.createElement('div');
            menuItem.className = 'tab-menu-item';
            menuItem.setAttribute('data-tab-id', tabId);
            menuItem.textContent = title.textContent || \`Tab \${index+1}\`;
            
            // Set the first tab as active
            if (index === 0) {
              menuItem.className += ' active';
            }
            
            // Set ID on content
            content.setAttribute('data-tab-id', tabId);
            if (index === 0) {
              content.className += ' active';
            }
            
            // Add to DOM
            tabsMenu.appendChild(menuItem);
            tabsContent.appendChild(content);
          }
        });
      })();
    </script>`;
  }  /**
   * Process Confluence tab-pane macro
   * @param element The tab-pane macro element
   * @param attachmentBaseUrl Base URL for attachment references
   * @returns The HTML tab pane
   */
  private static processTabPaneMacro(element: Element, attachmentBaseUrl: string): string {
    // Extract parameters and content
    let name = 'Tab';
    let content = '';
    
    // Process child nodes to find parameters and content
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i] as Element;
      if (!child.nodeName) continue;
      
      const nodeName = child.nodeName.toLowerCase();
      
      if (nodeName === 'ac:parameter') {
        const paramName = child.getAttribute('ac:name');
        if (paramName === 'name') {
          name = (child.textContent || 'Tab').trim();
        }
      }
      else if (nodeName === 'ac:rich-text-body') {
        content = this.processChildren(child, attachmentBaseUrl);
      }
    }

    // Create structured output that matches expected format in preview.ts
    return `<div class="tab-pane">
      <h3>${name}</h3>
      <div class="tab-content">
        ${content}
      </div>
    </div>`;
  }

  /**
   * Process Confluence admonition macros (note, info, warning, tip)
   * @param element The admonition macro element
   * @param macroType The type of admonition
   * @param attachmentBaseUrl Base URL for attachment references
   * @returns The HTML admonition
   */
  private static processAdmonitionMacro(element: Element, macroType: string, attachmentBaseUrl: string): string {
    // Extract parameters
    let title = '';
    let content = '';
    
    // Process child nodes to find parameters and content
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i] as Element;
      if (!child.nodeName) continue;
      
      const nodeName = child.nodeName.toLowerCase();
      
      if (nodeName === 'ac:parameter') {
        const paramName = child.getAttribute('ac:name');
        if (paramName === 'title') {
          title = (child.textContent || '').trim();
        }
      }
      else if (nodeName === 'ac:rich-text-body') {
        content = this.processChildren(child, attachmentBaseUrl);
      }
    }

    // Default titles based on type
    if (!title) {
      switch (macroType) {
        case 'note': title = 'Note'; break;
        case 'info': title = 'Info'; break;
        case 'warning': title = 'Warning'; break;
        case 'tip': title = 'Tip'; break;
      }
    }

    // Build HTML representation
    return `<div class="admonition admonition-${macroType}">
      <div class="admonition-title">${title}</div>
      <div class="admonition-content">${content}</div>
    </div>`;
  }

  /**
   * Process Confluence task list element
   * @param element The ac:task-list element
   * @param attachmentBaseUrl Base URL for attachment references
   * @returns The HTML task list
   */
  private static processConfluenceTaskList(element: Element, attachmentBaseUrl: string): string {
    let result = '<div class="task-list">';
    
    // Process each task
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i] as Element;
      if (!child.nodeName) continue;
      
      const nodeName = child.nodeName.toLowerCase();
      
      if (nodeName === 'ac:task') {
        let status = 'incomplete';
        let body = '';
        
        // Extract task status and body
        for (let j = 0; j < child.childNodes.length; j++) {
          const taskChild = child.childNodes[j] as Element;
          if (!taskChild.nodeName) continue;
          
          const taskNodeName = taskChild.nodeName.toLowerCase();
          
          if (taskNodeName === 'ac:task-status') {
            status = (taskChild.textContent || '').trim();
          }
          else if (taskNodeName === 'ac:task-body') {
            body = this.processChildren(taskChild, attachmentBaseUrl);
          }
        }

        // Build task HTML
        result += `<div class="task">
          <input type="checkbox" ${status === 'complete' ? 'checked' : ''} disabled />
          <span class="task-body">${body}</span>
        </div>`;
      }
    }
    
    result += '</div>';
    return result;
  }

  /**
   * Process Confluence emoticon element
   * @param element The ac:emoticon element
   * @returns The HTML emoticon
   */
  private static processConfluenceEmoticon(element: Element): string {
    const name = element.getAttribute('ac:name') || '';
    
    // Map emoticon names to emoji
    const emojiMap: Record<string, string> = {
      'smile': '😊',
      'sad': '😞',
      'cheeky': '😋',
      'laugh': '😄',
      'wink': '😉',
      'thumbs-up': '👍',
      'thumbs-down': '👎',
      'information': 'ℹ️',
      'tick': '✅',
      'cross': '❌',
      'warning': '⚠️'
    };
    
    const emoji = emojiMap[name] || `(${name})`;
    return `<span class="emoticon emoticon-${name}">${emoji}</span>`;
  }

  /**
   * Process Confluence layout element
   * @param element The ac:layout element
   * @param attachmentBaseUrl Base URL for attachment references
   * @returns The HTML layout
   */
  private static processConfluenceLayout(element: Element, attachmentBaseUrl: string): string {
    let result = '<div class="confluence-layout">';
    
    // Process each section
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i] as Element;
      if (!child.nodeName) continue;
      
      const nodeName = child.nodeName.toLowerCase();
      
      if (nodeName === 'ac:layout-section') {
        const sectionType = child.getAttribute('ac:type') || 'single';
        result += `<div class="layout-section layout-section-${sectionType}">`;
        
        // Process each cell in the section
        for (let j = 0; j < child.childNodes.length; j++) {
          const cellChild = child.childNodes[j] as Element;
          if (!cellChild.nodeName) continue;
          
          const cellNodeName = cellChild.nodeName.toLowerCase();
          
          if (cellNodeName === 'ac:layout-cell') {
            result += `<div class="layout-cell">`;
            result += this.processChildren(cellChild, attachmentBaseUrl);
            result += `</div>`;
          }
        }
        
        result += '</div>';
      }
    }
    
    result += '</div>';
    return result;
  }
  /**
   * Process resource identifier element
   * @param element The ri: element
   * @param attachmentBaseUrl Base URL for attachment references
   * @returns The HTML representation or an object with href and title (for page links)
   */  private static processResourceIdentifier(element: Element, attachmentBaseUrl: string): string | { href: string, title: string } {
    const nodeName = element.nodeName.toLowerCase();
    
    switch (nodeName) {
      case 'ri:url':
        return element.getAttribute('ri:value') || '#';
      case 'ri:attachment':
        const filename = element.getAttribute('ri:filename');
        return filename ? `${attachmentBaseUrl}/${filename}` : '#';
        case 'ri:page':
        const pageTitle = element.getAttribute('ri:content-title') || '';
        const spaceKey = element.getAttribute('ri:space-key') || '';
        
        // In dry run, we need to link directly to the HTML files
        // Use a more URL-safe filename by replacing problematic characters
        const safeFilename = pageTitle.replace(/[^a-zA-Z0-9-_.]/g, '_');
        
        // For dry run previews, create a relative path to the page file
        let href;
        if (spaceKey) {
          // Link to another space
          href = `../${spaceKey}/${safeFilename}.html`;
        } else {
          // Link within the same space, use the current directory
          href = `./${safeFilename}.html`;
        }
        
        // Return both the URL and the original page title
        return {
          href,
          title: pageTitle
        };
      
      default:
        // For unhandled resource identifiers, return empty string
        return '';
    }
  }

  /**
   * Process Confluence table element
   * @param element The table element
   * @param attachmentBaseUrl Base URL for attachment references
   * @returns The HTML table
   */
  private static processConfluenceTable(element: Element, attachmentBaseUrl: string): string {
    // Create a more Confluence-like table
    let result = '<div class="confluence-table-wrapper">';
    result += '<table class="confluenceTable">';
    
    // Process thead and tbody
    let inHeader = false;
    
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i] as Element;
      if (!child.nodeName) continue;
      
      const nodeName = child.nodeName.toLowerCase();
      
      if (nodeName === 'thead') {
        inHeader = true;
        result += '<thead>';
        result += this.processChildren(child, attachmentBaseUrl);
        result += '</thead>';
        inHeader = false;
      } 
      else if (nodeName === 'tbody') {
        result += '<tbody>';
        result += this.processChildren(child, attachmentBaseUrl);
        result += '</tbody>';
      }
      else if (nodeName === 'tr') {
        result += '<tr>';
        
        // Process each cell
        for (let j = 0; j < child.childNodes.length; j++) {
          const cell = child.childNodes[j] as Element;
          if (!cell.nodeName) continue;
          
          const cellName = cell.nodeName.toLowerCase();
          
          if (cellName === 'th' || (inHeader && cellName === 'td')) {
            result += '<th class="confluenceTh">';
            result += this.processChildren(cell, attachmentBaseUrl);
            result += '</th>';
          } 
          else if (cellName === 'td') {
            result += '<td class="confluenceTd">';
            result += this.processChildren(cell, attachmentBaseUrl);
            result += '</td>';
          }
        }
        
        result += '</tr>';
      }
    }
    
    result += '</table>';
    result += '</div>';
    
    return result;
  }
  /**
   * Escape HTML special characters
   * @param html The HTML string to escape
   * @returns The escaped HTML string
   */
  private static escapeHtml(html: string): string {
    // Ensure we don't double-escape entities that are already escaped
    // First temporarily replace already escaped entities
    const tempHtml = html
      .replace(/&amp;/g, '__AMP__')
      .replace(/&lt;/g, '__LT__')
      .replace(/&gt;/g, '__GT__')
      .replace(/&quot;/g, '__QUOT__')
      .replace(/&#039;/g, '__APOS__');
    
    // Then escape all remaining special characters
    const escaped = tempHtml
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    
    // Finally, restore the originally escaped entities
    return escaped
      .replace(/__AMP__/g, '&amp;')
      .replace(/__LT__/g, '&lt;')
      .replace(/__GT__/g, '&gt;')
      .replace(/__QUOT__/g, '&quot;')
      .replace(/__APOS__/g, '&#039;');
  }
}
