// src/macro-helpers.ts
import Handlebars from 'handlebars';
import { generateUuid } from './utils';

/**
 * Registers all macro helpers with the Handlebars instance
 * 
 * This function registers a set of Handlebars helpers that generate various Confluence macros.
 * These helpers can be used in templates to create rich content in Confluence pages.
 * 
 * @param handlebars - The Handlebars instance to register helpers with
 * @param options - Command-line options that might affect helper behavior
 */
export function registerMacroHelpers(handlebars: typeof Handlebars, options?: any): void {
    /**
   * HTML macro - Embeds HTML content in a Confluence page
   * 
   * Usage:
   * ```handlebars
   * {{#confluence-html}}
   *   <div id="app"></div>
   *   {{{styles}}}
   *   {{{scripts}}}
   * {{/confluence-html}}
   * ```
   */
  handlebars.registerHelper('confluence-html', function(this: any, options: Handlebars.HelperOptions) {
    const macroId = generateUuid();
    const content = options.fn(this);
    
    return new handlebars.SafeString(
      `<ac:structured-macro ac:name="html" ac:schema-version="1" ac:macro-id="${macroId}">
        <ac:plain-text-body><![CDATA[${content}]]></ac:plain-text-body>
      </ac:structured-macro>`
    );
  });
  
  /**
   * Children macro - Displays a list of child pages
   * 
   * Usage:
   * ```handlebars
   * {{confluence-children sortBy="title" reverse=true includeLabels="label1,label2" excludeLabels="hide" mode="list"}}
   * ```
   * 
   * @param sortBy - Field to sort children by (e.g., "title", "created", "modified")
   * @param reverse - Whether to reverse the sort order (true/false)
   * @param includeLabels - Comma-separated list of labels to include
   * @param excludeLabels - Comma-separated list of labels to exclude
   * @param mode - Display mode ("list", "pages", etc.)
   */
  handlebars.registerHelper('confluence-children', function(this: any, options: Handlebars.HelperOptions) {
    const macroId = generateUuid();
    const sortBy = options.hash.sortBy || '';
    const reverse = options.hash.reverse === true ? 'true' : 'false';
    const includeLabels = options.hash.includeLabels || '';
    const excludeLabels = options.hash.excludeLabels || '';
    const mode = options.hash.mode || '';
    
    return new handlebars.SafeString(
      `<ac:structured-macro ac:name="children" ac:schema-version="2" ac:macro-id="${macroId}">
        ${sortBy ? `<ac:parameter ac:name="sort">${sortBy}</ac:parameter>` : ''}
        ${reverse === 'true' ? `<ac:parameter ac:name="reverse">true</ac:parameter>` : ''}
        ${includeLabels ? `<ac:parameter ac:name="labels">${includeLabels}</ac:parameter>` : ''}
        ${excludeLabels ? `<ac:parameter ac:name="excludeLabels">${excludeLabels}</ac:parameter>` : ''}
        ${mode ? `<ac:parameter ac:name="mode">${mode}</ac:parameter>` : ''}
      </ac:structured-macro>`
    );
  });
  
  /**
   * Panel macro - Creates a styled panel with optional title
   * 
   * Usage:
   * ```handlebars
   * {{#confluence-panel title="Important Information" type="note"}}
   *   <p>This panel contains important information.</p>
   * {{/confluence-panel}}
   * ```
   * 
   * @param title - Title of the panel
   * @param type - Panel type (note, info, warning, success, error)
   */
  handlebars.registerHelper('confluence-panel', function(this: any, options: Handlebars.HelperOptions) {
    const macroId = generateUuid();
    const content = options.fn(this);
    const title = options.hash.title || '';
    const type = options.hash.type || 'info';
    
    return new handlebars.SafeString(
      `<ac:structured-macro ac:name="panel" ac:schema-version="1" ac:macro-id="${macroId}">
        <ac:parameter ac:name="title">${title}</ac:parameter>
        <ac:parameter ac:name="panelType">${type}</ac:parameter>
        <ac:rich-text-body>${content}</ac:rich-text-body>
      </ac:structured-macro>`
    );
  });
  
  /**
   * Layout macro - Creates a multi-column layout container
   * 
   * Usage:
   * ```handlebars
   * {{#confluence-layout}}
   *   {{#layout-section type="two_equal"}}
   *     {{#layout-cell}}
   *       <!-- Content for left column -->
   *     {{/layout-cell}}
   *     {{#layout-cell}}
   *       <!-- Content for right column -->
   *     {{/layout-cell}}
   *   {{/layout-section}}
   * {{/confluence-layout}}
   * ```
   */
  handlebars.registerHelper('confluence-layout', function(this: any, options: Handlebars.HelperOptions) {
    const content = options.fn(this);
    return new handlebars.SafeString(`<ac:layout>${content}</ac:layout>`);
  });
  
  /**
   * Layout section - Defines a section within a layout with a specified column type
   * 
   * @param type - Section type: single, two_equal, two_left_sidebar, two_right_sidebar, three_equal
   */
  handlebars.registerHelper('layout-section', function(this: any, options: Handlebars.HelperOptions) {
    const type = options.hash.type || 'single';
    const content = options.fn(this);
    return new handlebars.SafeString(
      `<ac:layout-section ac:type="${type}">${content}</ac:layout-section>`
    );
  });
  
  /**
   * Layout cell - Defines a cell within a layout section
   */
  handlebars.registerHelper('layout-cell', function(this: any, options: Handlebars.HelperOptions) {
    const content = options.fn(this);
    return new handlebars.SafeString(`<ac:layout-cell>${content}</ac:layout-cell>`);
  });
  
  /**
   * Code block macro - Displays code with syntax highlighting
   * 
   * Usage:
   * ```handlebars
   * {{#confluence-code language="javascript" title="Example JavaScript" linenumbers=true}}
   * function hello() {
   *   console.log("Hello, world!");
   * }
   * {{/confluence-code}}
   * ```
   * 
   * @param language - Programming language for syntax highlighting
   * @param title - Optional title for the code block
   * @param linenumbers - Whether to show line numbers (true/false)
   */
  handlebars.registerHelper('confluence-code', function(this: any, options: Handlebars.HelperOptions) {
    const macroId = generateUuid();
    let content = options.fn(this);
    const language = options.hash.language || '';
    const title = options.hash.title || '';
    const lineNumbers = options.hash.linenumbers === true ? 'true' : 'false';
    
    // Special handling for content that may contain CDATA end markers
    // This prevents issues when showing examples of templates that themselves use CDATA
    if (content.includes(']]>')) {
      // Split the CDATA section to avoid illegal nested CDATA markers
      content = content.replace(/]]>/g, ']]]]><![CDATA[>');
    }
    
    return new handlebars.SafeString(
      `<ac:structured-macro ac:name="code" ac:schema-version="1" ac:macro-id="${macroId}">
        <ac:parameter ac:name="language">${language}</ac:parameter>
        <ac:parameter ac:name="title">${title}</ac:parameter>
        <ac:parameter ac:name="linenumbers">${lineNumbers}</ac:parameter>
        <ac:plain-text-body><![CDATA[${content}]]></ac:plain-text-body>
      </ac:structured-macro>`
    );
  });
  
  /**
   * Table of Contents macro - Generates a table of contents for the page
   * 
   * Usage:
   * ```handlebars
   * {{confluence-toc minLevel=2 maxLevel=4}}
   * ```
   * 
   * @param minLevel - Minimum heading level to include (1-7)
   * @param maxLevel - Maximum heading level to include (1-7)
   */
  handlebars.registerHelper('confluence-toc', function(this: any, options: Handlebars.HelperOptions) {
    const macroId = generateUuid();
    const minLevel = options.hash.minLevel || 1;
    const maxLevel = options.hash.maxLevel || 7;
    
    return new handlebars.SafeString(
      `<ac:structured-macro ac:name="toc" ac:schema-version="1" ac:macro-id="${macroId}">
        <ac:parameter ac:name="minLevel">${minLevel}</ac:parameter>
        <ac:parameter ac:name="maxLevel">${maxLevel}</ac:parameter>
      </ac:structured-macro>`
    );
  });
  
  /**
   * Status macro - Displays a colored status indicator
   * 
   * Usage:
   * ```handlebars
   * {{confluence-status type="green" text="Completed"}}
   * ```
   * 
   * @param type - Status color (green, yellow, red, blue)
   * @param text - Status text to display
   */
  handlebars.registerHelper('confluence-status', function(this: any, options: Handlebars.HelperOptions) {
    const macroId = generateUuid();
    const type = options.hash.type || 'info';
    const text = options.hash.text || '';
    
    return new handlebars.SafeString(
      `<ac:structured-macro ac:name="status" ac:schema-version="1" ac:macro-id="${macroId}">
        <ac:parameter ac:name="colour">${type}</ac:parameter>
        <ac:parameter ac:name="title">${text}</ac:parameter>
      </ac:structured-macro>`
    );
  });
  
  /**
   * Info macro - Creates an information admonition block
   * 
   * Usage:
   * ```handlebars
   * {{#confluence-info title="Information"}}
   *   <p>This is an informational note.</p>
   * {{/confluence-info}}
   * 
   * {{#confluence-info title="Dev Comment" commentFlag=true}}
   *   <p>This will only be visible when running with --comment flag.</p>
   * {{/confluence-info}}
   * ```
   * 
   * @param title - Title of the info box
   * @param commentFlag - If true, content only appears when --comment flag is used
   */
  handlebars.registerHelper('confluence-info', function(this: any, helperOptions: Handlebars.HelperOptions) {
    const macroId = generateUuid();
    const content = helperOptions.fn(this);
    const title = helperOptions.hash.title || '';
    const commentFlag = helperOptions.hash.commentFlag === true;
    
    // Skip output if this is a comment macro and the --comment flag is not enabled
    if (commentFlag && (!options || !options.comment)) {
      return '';
    }
    
    return new handlebars.SafeString(
      `<ac:structured-macro ac:name="info" ac:schema-version="1" ac:macro-id="${macroId}">
        <ac:parameter ac:name="title">${title}</ac:parameter>
        <ac:rich-text-body>${content}</ac:rich-text-body>
      </ac:structured-macro>`
    );
  });
  
  /**
   * Note macro - Creates a note admonition block
   * 
   * Usage:
   * ```handlebars
   * {{#confluence-note title="Note"}}
   *   <p>This is a standard note.</p>
   * {{/confluence-note}}
   * ```
   * 
   * @param title - Title of the note box
   */
  handlebars.registerHelper('confluence-note', function(this: any, options: Handlebars.HelperOptions) {
    const macroId = generateUuid();
    const content = options.fn(this);
    const title = options.hash.title || '';
    
    return new handlebars.SafeString(
      `<ac:structured-macro ac:name="note" ac:schema-version="1" ac:macro-id="${macroId}">
        <ac:parameter ac:name="title">${title}</ac:parameter>
        <ac:rich-text-body>${content}</ac:rich-text-body>
      </ac:structured-macro>`
    );
  });
  
  /**
   * Warning macro - Creates a warning admonition block
   * 
   * Usage:
   * ```handlebars
   * {{#confluence-warning title="Warning"}}
   *   <p>This is a warning message.</p>
   * {{/confluence-warning}}
   * ```
   * 
   * @param title - Title of the warning box
   */
  handlebars.registerHelper('confluence-warning', function(this: any, options: Handlebars.HelperOptions) {
    const macroId = generateUuid();
    const content = options.fn(this);
    const title = options.hash.title || '';
    
    return new handlebars.SafeString(
      `<ac:structured-macro ac:name="warning" ac:schema-version="1" ac:macro-id="${macroId}">
        <ac:parameter ac:name="title">${title}</ac:parameter>
        <ac:rich-text-body>${content}</ac:rich-text-body>
      </ac:structured-macro>`
    );
  });
  
  /**
   * Tip macro - Creates a tip admonition block
   * 
   * Usage:
   * ```handlebars
   * {{#confluence-tip title="Tip"}}
   *   <p>This is a helpful tip.</p>
   * {{/confluence-tip}}
   * ```
   * 
   * @param title - Title of the tip box
   */
  handlebars.registerHelper('confluence-tip', function(this: any, options: Handlebars.HelperOptions) {
    const macroId = generateUuid();
    const content = options.fn(this);
    const title = options.hash.title || '';
    
    return new handlebars.SafeString(
      `<ac:structured-macro ac:name="tip" ac:schema-version="1" ac:macro-id="${macroId}">
        <ac:parameter ac:name="title">${title}</ac:parameter>
        <ac:rich-text-body>${content}</ac:rich-text-body>
      </ac:structured-macro>`
    );
  });
  
  /**
   * Expand macro - Creates an expandable/collapsible content section
   * 
   * Usage:
   * ```handlebars
   * {{#confluence-expand title="Click to see more details"}}
   *   <p>This content is hidden by default and will be revealed when clicked.</p>
   * {{/confluence-expand}}
   * ```
   * 
   * @param title - Title text displayed on the expandable header
   */
  handlebars.registerHelper('confluence-expand', function(this: any, options: Handlebars.HelperOptions) {
    const macroId = generateUuid();
    const content = options.fn(this);
    const title = options.hash.title || 'Click to expand';
    
    return new handlebars.SafeString(
      `<ac:structured-macro ac:name="expand" ac:schema-version="1" ac:macro-id="${macroId}">
        <ac:parameter ac:name="title">${title}</ac:parameter>
        <ac:rich-text-body>${content}</ac:rich-text-body>
      </ac:structured-macro>`
    );
  });

  /**
   * Image macro - Embeds an image in Confluence with various formatting options
   * 
   * Usage:
   * ```handlebars
   * {{confluence-image src="logo.png" alt="Company Logo" width="300" height="200" align="center"}}
   * {{confluence-image src="https://example.com/image.jpg" title="External Image" border=true thumbnail=true}}
   * ```
   * 
   * @param src - Image source (filename for attached images or full URL for external images)
   * @param alt - Alternative text for the image (for accessibility)
   * @param title - Tooltip text displayed on hover
   * @param width - Desired width of the image (e.g., "200", "50%")
   * @param height - Desired height of the image (e.g., "150", "auto")
   * @param align - Alignment of the image (left, center, right)
   * @param border - Whether to display a border around the image (true/false)
   * @param thumbnail - Whether to render the image as a thumbnail (true/false)
   * @param class - CSS class for custom styling
   * @param style - Inline CSS styles
   */
  handlebars.registerHelper('confluence-image', function(this: any, options: Handlebars.HelperOptions) {
    const src = options.hash.src;
    
    // Ensure src parameter is provided
    if (!src) {
      console.warn('Warning: confluence-image helper called without required "src" parameter');
      return '';
    }
    
    // Determine if source is a URL or a filename
    const isUrl = src.startsWith('http://') || src.startsWith('https://');
    
    // Optional parameters
    const alt = options.hash.alt || '';
    const title = options.hash.title || '';
    const width = options.hash.width || null;
    const height = options.hash.height || null;
    const align = options.hash.align || null;
    const border = options.hash.border === true ? 'true' : null;
    const thumbnail = options.hash.thumbnail === true ? 'true' : null;
    const cssClass = options.hash.class || null;
    const style = options.hash.style || null;
    
    // Start building the image tag with its attributes
    let imageTag = '<ac:image';
    
    // Add attributes only if they are provided
    if (alt) imageTag += ` ac:alt="${alt}"`;
    if (title) imageTag += ` ac:title="${title}"`;
    if (width) imageTag += ` ac:width="${width}"`;
    if (height) imageTag += ` ac:height="${height}"`;
    if (align) imageTag += ` ac:align="${align}"`;
    if (border) imageTag += ` ac:border="${border}"`;
    if (thumbnail) imageTag += ` ac:thumbnail="${thumbnail}"`;
    if (cssClass) imageTag += ` ac:class="${cssClass}"`;
    if (style) imageTag += ` ac:style="${style}"`;
    
    imageTag += '>';
    
    // Add the appropriate source element based on the source type
    if (isUrl) {
      // External URL source
      imageTag += `<ri:url ri:value="${src}"/>`;
    } else {
      // Attachment source (assumed to be included in the build/dist files)
      imageTag += `<ri:attachment ri:filename="${src}"/>`;
    }
    
    // Close the image tag
    imageTag += '</ac:image>';
    
    return new handlebars.SafeString(imageTag);
  });

  /**
   * Link macro - Creates links to various Confluence entities or external URLs
   * 
   * Usage:
   * ```handlebars
   * <!-- Link to another Confluence page -->
   * {{confluence-link type="page" pageTitle="Target Page" text="Link to page"}}
   * 
   * <!-- Link to an attachment -->
   * {{confluence-link type="attachment" filename="document.pdf" text="View document"}}
   * 
   * <!-- Link to an external site -->
   * {{confluence-link type="url" url="https://example.com" text="External link"}}
   * 
   * <!-- Anchor link (same page) -->
   * {{confluence-link type="anchor" anchor="section-id" text="Jump to section"}}
   * 
   * <!-- Anchor link (another page) -->
   * {{confluence-link type="pageAnchor" pageTitle="Other Page" anchor="section-id" text="Jump to section on other page"}}
   * 
   * <!-- Link with an embedded image for the body -->
   * {{#confluence-link type="page" pageTitle="Image Link Example"}}
   *   {{confluence-image src="logo.png" width="30"}}
   * {{/confluence-link}}
   * ```
   * 
   * @param type - Type of link: "page", "attachment", "url", "anchor", "pageAnchor"
   * @param text - Text to display for the link (required for text links)
   * @param pageTitle - Title of the target Confluence page (for page and pageAnchor types)
   * @param filename - Name of the attachment file (for attachment type)
   * @param url - URL for external links (for url type)
   * @param anchor - Anchor name/ID to link to (for anchor and pageAnchor types)
   * @param tooltip - Optional tooltip text that appears on hover
   */
  handlebars.registerHelper('confluence-link', function(this: any, options: Handlebars.HelperOptions) {
    const type = options.hash.type || 'url';
    const tooltip = options.hash.tooltip || '';
    
    // Check if the helper is used as a block (for image links)
    const isBlock = options.fn && typeof options.fn === 'function';
    const linkContent = isBlock ? options.fn(this) : '';
    
    // For text links, get the text content
    const text = options.hash.text || '';
    
    let result = '';
    
    switch (type) {
      case 'page': {
        const pageTitle = options.hash.pageTitle || '';
        if (!pageTitle) {
          console.warn('Warning: confluence-link with type="page" missing required "pageTitle" parameter');
          return '';
        }
        
        result = `<ac:link${tooltip ? ` ac:tooltip="${tooltip}"` : ''}>
          <ri:page ri:content-title="${pageTitle}" />
          ${isBlock 
            ? `<ac:link-body>${linkContent}</ac:link-body>` 
            : `<ac:plain-text-link-body><![CDATA[${text}]]></ac:plain-text-link-body>`
          }
        </ac:link>`;
        break;
      }
      
      case 'attachment': {
        const filename = options.hash.filename || '';
        if (!filename) {
          console.warn('Warning: confluence-link with type="attachment" missing required "filename" parameter');
          return '';
        }
        
        result = `<ac:link${tooltip ? ` ac:tooltip="${tooltip}"` : ''}>
          <ri:attachment ri:filename="${filename}" />
          ${isBlock 
            ? `<ac:link-body>${linkContent}</ac:link-body>` 
            : `<ac:plain-text-link-body><![CDATA[${text}]]></ac:plain-text-link-body>`
          }
        </ac:link>`;
        break;
      }
      
      case 'url': {
        const url = options.hash.url || '';
        if (!url) {
          console.warn('Warning: confluence-link with type="url" missing required "url" parameter');
          return '';
        }
        
        // External URLs use standard HTML anchor tags
        result = `<a href="${url}"${tooltip ? ` title="${tooltip}"` : ''}>${text}</a>`;
        break;
      }
      
      case 'anchor': {
        const anchor = options.hash.anchor || '';
        if (!anchor) {
          console.warn('Warning: confluence-link with type="anchor" missing required "anchor" parameter');
          return '';
        }
        
        result = `<ac:link ac:anchor="${anchor}"${tooltip ? ` ac:tooltip="${tooltip}"` : ''}>
          ${isBlock 
            ? `<ac:link-body>${linkContent}</ac:link-body>` 
            : `<ac:plain-text-link-body><![CDATA[${text}]]></ac:plain-text-link-body>`
          }
        </ac:link>`;
        break;
      }
      
      case 'pageAnchor': {
        const pageTitle = options.hash.pageTitle || '';
        const anchor = options.hash.anchor || '';
        
        if (!pageTitle) {
          console.warn('Warning: confluence-link with type="pageAnchor" missing required "pageTitle" parameter');
          return '';
        }
        
        if (!anchor) {
          console.warn('Warning: confluence-link with type="pageAnchor" missing required "anchor" parameter');
          return '';
        }
        
        result = `<ac:link ac:anchor="${anchor}"${tooltip ? ` ac:tooltip="${tooltip}"` : ''}>
          <ri:page ri:content-title="${pageTitle}"/>
          ${isBlock 
            ? `<ac:link-body>${linkContent}</ac:link-body>` 
            : `<ac:plain-text-link-body><![CDATA[${text}]]></ac:plain-text-link-body>`
          }
        </ac:link>`;
        break;
      }
      
      default:
        console.warn(`Warning: Unknown confluence-link type: ${type}`);
        return '';
    }
    
    return new handlebars.SafeString(result);
  });
}