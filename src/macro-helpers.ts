// src/macro-helpers.ts
import fs from 'fs';
import Handlebars from 'handlebars';
import path from 'path';
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
   * URL helper - Generates a standard URL reference to an attached file
   * 
   * This helper generates a standard URL reference for a file attached to a Confluence page.
   * It uses the Confluence download URL format which works in all contexts (scripts, stylesheets, img tags).
   * 
   * Usage:
   * ```handlebars
   * <script src="{{confluence-url file="script.js"}}"></script>
   * <link rel="stylesheet" href="{{confluence-url file="styles.css"}}">
   * <img src="{{confluence-url file="image.png"}}">
   * ```
   * 
   * @param file - Name of the attached file
   */
  handlebars.registerHelper('confluence-url', function(this: any, options: Handlebars.HelperOptions) {
    const filename = options.hash.file;
    
    // Ensure filename parameter is provided
    if (!filename) {
      console.warn('Warning: confluence-url helper called without required "file" parameter');
      return '';
    }
    
    // Access pageId and baseUrl from the current context
    // In Handlebars, 'this' refers to the current context data
    const pageId = this.pageId || '';
    const baseUrl = this.baseUrl || '';
    
    // Build the complete URL path
    let fullUrl = '';
    
    // If we have baseUrl, use it to build the absolute URL
    if (baseUrl) {
      // Ensure baseUrl doesn't have a trailing slash before appending the path
      const baseUrlNormalized = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      fullUrl = `${baseUrlNormalized}/download/attachments/${pageId}/${filename}`;
    } else {
      // Fallback to relative URL if baseUrl is not available, but always include the pageId
      fullUrl = `/download/attachments/${pageId}/${filename}`;
    }
    
    if (!pageId) {
      console.warn(`Warning: confluence-url used without pageId in context. File: ${filename}`);
    }
    
    return new handlebars.SafeString(fullUrl);
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
   * {{#confluence-panel title="Important Information"}}
   *   <p>This panel contains important information.</p>
   * {{/confluence-panel}}
   * 
   * {{#confluence-panel title="Developer Notes" borderStyle="dashed" borderColor="#FF0000" borderWidth="2" bgColor="#F5F5F5" titleBGColor="#E0E0E0" titleColor="#000000" comment=true}}
   *   <p>This panel will only be visible when running with the --comment flag.</p>
   * {{/confluence-panel}}
   * ```
   * 
   * @param title - Title of the panel
   * @param borderStyle - Style of the panel's border (solid, dashed, etc.)
   * @param borderColor - Color of the panel's border (HTML color name or hex code)
   * @param borderWidth - Width of the panel's border in pixels (value only)
   * @param bgColor - Background color of the panel (HTML color name or hex code)
   * @param titleBGColor - Background color of the title row (HTML color name or hex code)
   * @param titleColor - Text color of the title row (HTML color name or hex code)
   * @param comment - If true, content only appears when --comment flag is used
   */
  handlebars.registerHelper('confluence-panel', function(this: any, helperOptions: Handlebars.HelperOptions) {
    const macroId = generateUuid();
    const content = helperOptions.fn(this);
    const title = helperOptions.hash.title || '';
    const comment = helperOptions.hash.comment === true;
    
    // Skip output if this is a comment macro and the --comment flag is not enabled
    if (comment && (!options || !options.comment)) {
      return '';
    }
    
    // Additional style parameters
    const borderStyle = helperOptions.hash.borderStyle || '';
    const borderColor = helperOptions.hash.borderColor || '';
    const borderWidth = helperOptions.hash.borderWidth || '';
    const bgColor = helperOptions.hash.bgColor || '';
    const titleBGColor = helperOptions.hash.titleBGColor || '';
    const titleColor = helperOptions.hash.titleColor || '';
    
    return new handlebars.SafeString(
      `<ac:structured-macro ac:name="panel" ac:schema-version="1" ac:macro-id="${macroId}">
        <ac:parameter ac:name="title">${title}</ac:parameter>
        ${borderStyle ? `<ac:parameter ac:name="borderStyle">${borderStyle}</ac:parameter>` : ''}
        ${borderColor ? `<ac:parameter ac:name="borderColor">${borderColor}</ac:parameter>` : ''}
        ${borderWidth ? `<ac:parameter ac:name="borderWidth">${borderWidth}</ac:parameter>` : ''}
        ${bgColor ? `<ac:parameter ac:name="bgColor">${bgColor}</ac:parameter>` : ''}
        ${titleBGColor ? `<ac:parameter ac:name="titleBGColor">${titleBGColor}</ac:parameter>` : ''}
        ${titleColor ? `<ac:parameter ac:name="titleColor">${titleColor}</ac:parameter>` : ''}
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
   * Tabs group macro - Creates a tabbed content container
   * 
   * Usage:
   * ```handlebars
   * {{#confluence-tabs disposition="horizontal" outline=true color="#FF5630"}}
   *   {{#confluence-tab name="Tab 1" icon="icon-sp-lock"}}
   *     <p>Content for Tab 1</p>
   *   {{/confluence-tab}}
   *   {{#confluence-tab name="Tab 2" icon="icon-sp-flag"}}
   *     <p>Content for Tab 2</p>
   *   {{/confluence-tabs}}
   * ```
   * 
   * @param disposition - Tab orientation: "horizontal" or "vertical"
   * @param outline - Whether to show a border around the tabs (true/false)
   * @param color - Accent color for the tabs (HTML color name or hex code)
   */
  handlebars.registerHelper('confluence-tabs', function(this: any, options: Handlebars.HelperOptions) {
    const macroId = generateUuid();
    const content = options.fn(this);
    const disposition = options.hash.disposition || 'horizontal';
    const outline = options.hash.outline === true ? 'true' : 'false';
    const color = options.hash.color || '';
    
    return new handlebars.SafeString(
      `<ac:structured-macro ac:name="tabs-group" ac:schema-version="1" ac:macro-id="${macroId}">
        <ac:parameter ac:name="disposition">${disposition}</ac:parameter>
        <ac:parameter ac:name="outline">${outline}</ac:parameter>
        ${color ? `<ac:parameter ac:name="color">${color}</ac:parameter>` : ''}
        <ac:rich-text-body>${content}</ac:rich-text-body>
      </ac:structured-macro>`
    );
  });
  
  /**
   * Tab pane macro - Defines an individual tab within a tabs group
   * 
   * Usage: See confluence-tabs example above
   * 
   * @param name - Display name of the tab
   * @param icon - Optional icon for the tab (e.g., "icon-sp-lock", "icon-sp-flag")
   * @param anchor - Optional anchor ID for the tab (auto-generated if not provided)
   */
  handlebars.registerHelper('confluence-tab', function(this: any, options: Handlebars.HelperOptions) {
    const macroId = generateUuid();
    const content = options.fn(this);
    const name = options.hash.name || 'Tab';
    const icon = options.hash.icon || '';
    // Generate a random anchor ID if not provided
    const anchor = options.hash.anchor || Math.floor(Math.random() * 100000000);
    
    return new handlebars.SafeString(
      `<ac:structured-macro ac:name="tab-pane" ac:schema-version="1" ac:macro-id="${macroId}">
        <ac:parameter ac:name="anchor">${anchor}</ac:parameter>
        ${icon ? `<ac:parameter ac:name="icon">${icon}</ac:parameter>` : ''}
        <ac:parameter ac:name="name">${name}</ac:parameter>
        <ac:rich-text-body>${content}</ac:rich-text-body>
      </ac:structured-macro>`
    );
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
   * {{#confluence-info title="Dev Comment" comment=true}}
   *   <p>This will only be visible when running with --comment flag.</p>
   * {{/confluence-info}}
   * ```
   * 
   * @param title - Title of the info box
   * @param comment - If true, content only appears when --comment flag is used
   */
  handlebars.registerHelper('confluence-info', function(this: any, helperOptions: Handlebars.HelperOptions) {
    const macroId = generateUuid();
    const content = helperOptions.fn(this);
    const title = helperOptions.hash.title || '';
    const comment = helperOptions.hash.comment === true;
    
    // Skip output if this is a comment macro and the --comment flag is not enabled
    if (comment && (!options || !options.comment)) {
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
   * 
   * {{#confluence-note title="Dev Note" comment=true}}
   *   <p>This will only be visible when running with --comment flag.</p>
   * {{/confluence-note}}
   * ```
   * 
   * @param title - Title of the note box
   * @param comment - If true, content only appears when --comment flag is used
   */
  handlebars.registerHelper('confluence-note', function(this: any, helperOptions: Handlebars.HelperOptions) {
    const macroId = generateUuid();
    const content = helperOptions.fn(this);
    const title = helperOptions.hash.title || '';
    const comment = helperOptions.hash.comment === true;
    
    // Skip output if this is a comment macro and the --comment flag is not enabled
    if (comment && (!options || !options.comment)) {
      return '';
    }
    
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
   * 
   * {{#confluence-warning title="Dev Warning" comment=true}}
   *   <p>This will only be visible when running with --comment flag.</p>
   * {{/confluence-warning}}
   * ```
   * 
   * @param title - Title of the warning box
   * @param comment - If true, content only appears when --comment flag is used
   */
  handlebars.registerHelper('confluence-warning', function(this: any, helperOptions: Handlebars.HelperOptions) {
    const macroId = generateUuid();
    const content = helperOptions.fn(this);
    const title = helperOptions.hash.title || '';
    const comment = helperOptions.hash.comment === true;
    
    // Skip output if this is a comment macro and the --comment flag is not enabled
    if (comment && (!options || !options.comment)) {
      return '';
    }
    
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
   * 
   * {{#confluence-tip title="Dev Tip" comment=true}}
   *   <p>This will only be visible when running with --comment flag.</p>
   * {{/confluence-tip}}
   * ```
   * 
   * @param title - Title of the tip box
   * @param comment - If true, content only appears when --comment flag is used
   */
  handlebars.registerHelper('confluence-tip', function(this: any, helperOptions: Handlebars.HelperOptions) {
    const macroId = generateUuid();
    const content = helperOptions.fn(this);
    const title = helperOptions.hash.title || '';
    const comment = helperOptions.hash.comment === true;
    
    // Skip output if this is a comment macro and the --comment flag is not enabled
    if (comment && (!options || !options.comment)) {
      return '';
    }
    
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

  /**
   * Date macro - Displays a formatted date using the Confluence Date macro
   * 
   * Usage:
   * ```handlebars
   * {{confluence-date date="2024-03-15" format="dd MMM yyyy"}}
   * ```
   * 
   * @param date - The date in YYYY-MM-DD format
   * @param format - Optional date format string (e.g., "MMM dd, yyyy")
   */
  handlebars.registerHelper('confluence-date', function(this: any, options: Handlebars.HelperOptions) {
    const macroId = generateUuid();
    const date = options.hash.date;
    const format = options.hash.format || '';
    
    // Ensure date parameter is provided
    if (!date) {
      console.warn('Warning: confluence-date helper called without required "date" parameter');
      return '';
    }
    
    return new handlebars.SafeString(
      `<time datetime="${date}" />`
    );
  });

  /**
   * Include macro - Includes content from another file
   * 
   * Usage:
   * ```handlebars
   * {{confluence-include file="path/to/include-file.html"}}
   * ```
   * 
   * This helper allows you to include content from other files in your templates.
   * The content of the included file will be processed with Handlebars to handle any variables,
   * but cannot contain recursive {{confluence-include}} calls.
   * 
   * @param file - Path to the file to include, relative to the current working directory
   */
  handlebars.registerHelper('confluence-include', function(this: any, helperOptions: Handlebars.HelperOptions) {
    const filePath = helperOptions.hash.file;
    
    // Ensure file parameter is provided
    if (!filePath) {
      console.warn('Warning: confluence-include helper called without required "file" parameter');
      return '';
    }
    
    // Resolve the file path relative to the current working directory
    const resolvedPath = path.resolve(process.cwd(), filePath);
    
    try {
      // Check if the file exists
      if (!fs.existsSync(resolvedPath)) {
        console.warn(`Warning: File not found for confluence-include: ${filePath}`);
        return '';
      }
      
      // Read the file content
      const fileContent = fs.readFileSync(resolvedPath, 'utf8');
      
      // Check for recursive includes (not allowed)
      if (fileContent.includes('{{confluence-include') || fileContent.includes('{{#confluence-include')) {
        console.warn(`Warning: Recursive includes not allowed in: ${filePath}`);
        return '';
      }
      
      // Compile the content with Handlebars to handle any variables
      const template = handlebars.compile(fileContent);
      const processedContent = template(this);
      
      // Return the processed content as a SafeString
      return new handlebars.SafeString(processedContent);
    } catch (error) {
      console.error(`Error processing confluence-include for file ${filePath}:`, error);
      return '';
    }
  });
}