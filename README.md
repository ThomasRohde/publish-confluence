# publish-confluence

  A TypeScript/Node.js CLI tool for instantly publishing modern JavaScript and TypeScript applications to Confluence pages—streamlining your development, testing, and deployment cycles.
  

  ## Overview

  **publish-confluence** is a powerful solution for embedding interactive web applications, dashboards, and widgets directly into Confluence. With a single command, you can push your latest build to a Confluence page, complete with all required assets and custom layout. No more manual uploads, brittle macros, or copy-paste workflows.

  Designed for rapid iteration, publish-confluence lets you update your app, rebuild, and immediately publish changes to Confluence—making it ideal for fast feedback, demos, and continuous delivery. The tool's flexible template system and smart asset management enable you to deliver rich, production-quality experiences inside Confluence, while keeping your workflow simple and repeatable.

  While originally designed for JavaScript applications, publish-confluence has evolved into a comprehensive documentation and content management solution. It now supports complex documentation structures with nested child pages, CI/CD pipeline integration, and powerful template customization using Confluence macros. This makes it perfect for technical documentation, knowledge bases, release notes, and API documentation—all maintained under source control with automated publishing workflows.

  Whether you're building data visualizations, internal tools, documentation widgets, or managing entire documentation sites, publish-confluence empowers you to:
  - Develop locally with your favorite stack and build tools
  - Instantly deploy to Confluence for review or production
  - Automate and standardize your publishing process
  - Maintain documentation as code with full version control
  - Integrate with CI/CD pipelines for automatic publishing

### Key Features

- **Instant App Publishing:** Deploy JavaScript/TypeScript applications to Confluence pages in seconds—perfect for fast iteration and continuous delivery.
- **Seamless Asset Management:** Automatically uploads and attaches all your build assets (JS, CSS, images, fonts, etc.) to the Confluence page, ensuring everything just works.
- **Customizable Templates:** Use Handlebars-powered templates to fully control both the page layout and the embedded HTML macro, supporting everything from simple widgets to complex dashboards.
- **Macro Helper Library:** Easily compose Confluence-native macros (panels, layouts, code blocks, status, admonitions, and more) directly in your templates for rich, interactive content.
- **Effortless Configuration:** Get started quickly with sensible defaults, or fine-tune every aspect via a simple JSON config and environment variables.
- **Supports Modern Workflows:** Designed for modern JavaScript/TypeScript projects and build tools (Vite, Webpack, Rollup, etc.), with first-class support for rapid development and testing.
- **Robust CLI Experience:** Includes commands for project scaffolding, content fetching, and prompt generation for AI-assisted workflows.
- **Flexible Logging:** Choose your preferred verbosity level for clean output or detailed debugging.

## Installation

```bash
npm install publish-confluence
```

## Global Installation

To make the `publish-confluence` command available globally on your system, you can install the package globally:

```bash
# Install globally from npm
npm install -g publish-confluence

# Or install globally from a local directory
cd /path/to/publish-confluence
npm install -g .
```

After global installation, you can use the `publish-confluence` command from any directory:

```bash
# Run from any project directory
publish-confluence

# Create a new project
publish-confluence create
```

### Windows-specific Notes

On Windows, global installation makes the command available in Command Prompt, PowerShell, and Git Bash. If you encounter any permission issues during installation, try running your terminal as Administrator.

To verify successful installation, run:

```powershell
publish-confluence --version
```

If you need to update a globally installed package after making changes:

```powershell
# Rebuild and reinstall
npm run build
npm install -g .
```

## Quick Start

1. Create a `.env` file with your Confluence credentials:

```
CONFLUENCE_BASE_URL=https://your-confluence-instance.com
CONFLUENCE_TOKEN=your_api_token
```

2. (Optional) Create a `publish-confluence.json` configuration file:

```json
{
  "spaceKey": "YOURSPACE",
  "pageTitle": "Your JavaScript App",
  "parentPageTitle": "Parent Page",
  "distDir": "./dist"
}
```

3. Run the tool:

```bash
npx publish-confluence
```

## Configuration

You can configure publish-confluence using a `publish-confluence.json` file in your project root. Here are the available options:

| Option | Description | Default |
|--------|-------------|---------|
| `spaceKey` | Confluence space key (required) | - |
| `pageTitle` | Title of the page to create/update | Value from package.json |
| `parentPageTitle` | Title of the parent page | Space homepage |
| `templatePath` | Path to the Confluence page template | ./confluence-template.html |
| `macroTemplatePath` | Path to the HTML macro template | null |
| `includedFiles` | Array of glob patterns for files to include | Common web assets |
| `excludedFiles` | Array of glob patterns for files to exclude | Source maps |
| `distDir` | Directory containing build output files | ./dist |
| `childPages` | Array of nested child page configurations (optional) | [] |

> **Note:** If `macroTemplatePath` is not specified (null), file attachments will be skipped.

## Nested Pages Example

```json
{
  "spaceKey": "YOURSPACE",
  "pageTitle": "Root Page",
  "distDir": "./dist/root",
  "templatePath": "./templates/root.html",
  "childPages": [
    {
      "pageTitle": "Child A",
      "distDir": "./dist/a"
    },
    {
      "pageTitle": "Child B",
      "distDir": "./dist/b",
      "childPages": [
        {
          "pageTitle": "Grandchild B1",
          "distDir": "./dist/b1"
        }
      ]
    }
  ]
}
```

## Templates

The tool uses two primary templates:

1. **Page Template**: The overall Confluence page content, which includes the macro placeholder
2. **Macro Template**: The HTML structure for the Confluence HTML macro

### Page Template Variables

- `{{pageTitle}}`: The title of the page
- `{{{macro}}}`: Expands to the compiled HTML macro content. Remember to use triple braces to avoid HTML escaping.
- `{{currentDate}}`: Current date in ISO format (YYYY-MM-DD)

### Macro Template Variables

- `{{{scripts}}}`: Expands to `<script>` tags for all attached JavaScript files. Remember to use triple braces to avoid HTML escaping.
- `{{{styles}}}`: Expands to `<link>` tags for all attached CSS files. Remember to use triple braces to avoid HTML escaping.

## Supported Macro Helpers

Publish-confluence provides Handlebars helper functions that you can use in your page templates to generate different types of Confluence macros.

### HTML Macro

Embeds HTML content, typically used for JavaScript applications:

```handlebars
{{#confluence-html}}
  <div id="app"></div>
  {{{styles}}}
  {{{scripts}}}
{{/confluence-html}}
```

### URL Helper

Generates a standard URL reference to a file attached to a Confluence page:

```handlebars
<script src="{{confluence-url file="script.js"}}"></script>
<link rel="stylesheet" href="{{confluence-url file="styles.css"}}">
<img src="{{confluence-image src="image.png"}}">
```

Parameters:
- `file`: Name of the attached file (required)

The helper automatically builds the correct Confluence attachment URL format using the current page's `pageId` and `baseUrl` from the context.

### Panel Macro

Creates a Confluence panel with customizable appearance:

```handlebars
{{#confluence-panel title="Important Information" borderStyle="solid" borderColor="#cccccc" borderWidth="1" bgColor="#f5f5f5" titleBGColor="#e0e0e0" titleColor="#000000" comment=true}}
  <p>This panel contains important information that users should be aware of.</p>
{{/confluence-panel}}
```

### Layout Macros

Create complex layouts with multiple columns:

```handlebars
{{#confluence-layout}}
  {{#layout-section type="two_equal"}}
    {{#layout-cell}}
      <!-- Content for left column -->
    {{/layout-cell}}
    {{#layout-cell}}
      <!-- Content for right column -->
    {{/layout-cell}}
  {{/layout-section}}
{{/confluence-layout}}
```

Section types: `single`, `two_equal`, `two_left_sidebar`, `two_right_sidebar`, `three_equal`

### Code Block Macro

Display code with syntax highlighting:

```handlebars
{{#confluence-code language="javascript" title="Example JavaScript" linenumbers=true}}
function hello() {
  console.log("Hello, world!");
}
{{/confluence-code}}
```

### Table of Contents Macro

Generate a table of contents for your page:

```handlebars
{{confluence-toc minLevel=2 maxLevel=4}}
```

### Status Macro

Display a status indicator:

```handlebars
{{confluence-status type="green" text="Completed"}}
```

Status types: `green`, `yellow`, `red`, `blue`

### Link Macro

Create links to Confluence pages, attachments, external URLs, or anchors:

```handlebars
{{confluence-link type="page" pageTitle="Target Page" text="Link to page" tooltip="Optional tooltip"}}
```

Link types: `page`, `attachment`, `url`, `anchor`, `pageAnchor`

Parameters:

- `type`: one of `page`, `attachment`, `url`, `anchor`, `pageAnchor` (required)
- `text`: link text (required for inline use)
- `pageTitle`: title of the Confluence page (required for `page`/`pageAnchor`)
- `filename`: name of the attachment file (required for `attachment`)
- `url`: external URL (required for `url`)
- `anchor`: anchor name/ID (required for `anchor`/`pageAnchor`)
- `tooltip`: optional hover text

### Image Macro

Embed images in your Confluence pages with customizable attributes:

```handlebars
{{confluence-image src="logo.png" alt="Company Logo" width="300" height="200" align="center"}}
```

For external images:

```handlebars
{{confluence-image src="https://example.com/image.jpg" title="External Image" border=true thumbnail=true}}
```

| Parameter   | Description                                                 |
|-------------|-------------------------------------------------------------|
| `src`       | Image source (filename for attachments or URL for external) |
| `alt`       | Alternative text for accessibility                          | 
| `title`     | Tooltip text displayed on hover                             |
| `width`     | Desired width (e.g., "200", "50%")                          |
| `height`    | Desired height (e.g., "150", "auto")                        |
| `align`     | Alignment (left, center, right)                             |
| `border`    | Whether to display a border (true/false)                    |
| `thumbnail` | Whether to render as a thumbnail (true/false)               |
| `class`     | CSS class for custom styling                                |
| `style`     | Inline CSS styles                                           |

### Admonition Macros

Create various admonition blocks:

```handlebars
{{#confluence-info title="Information"}}
  <p>This is an informational note.</p>
{{/confluence-info}}

{{#confluence-note title="Note"}}
  <p>This is a standard note.</p>
{{/confluence-note}}

{{#confluence-warning title="Warning"}}
  <p>This is a warning message.</p>
{{/confluence-warning}}

{{#confluence-tip title="Tip"}}
  <p>This is a helpful tip.</p>
{{/confluence-tip}}
```

### Tabs Macros

Create tabbed content sections with multiple tabs:

```handlebars
{{#confluence-tabs disposition="horizontal" outline=true color="#FF5630"}}
  {{#confluence-tab name="Tab 1" icon="icon-sp-lock"}}
    <p>Content for Tab 1</p>
  {{/confluence-tab}}
  {{#confluence-tab name="Tab 2" icon="icon-sp-flag"}}
    <p>Content for Tab 2</p>
  {{/confluence-tab}}
{{/confluence-tabs}}
```

| Parameter      | Description                                            |
|----------------|--------------------------------------------------------|
| `disposition`  | Tab orientation: "horizontal" or "vertical"            |
| `outline`      | Whether to show a border around the tabs (true/false)  |
| `color`        | Accent color for the tabs (HTML color code)            |
| `name`         | Display name of the tab (for confluence-tab)           |
| `icon`         | Optional icon for the tab (e.g., "icon-sp-lock")       |
| `anchor`       | Optional anchor ID for the tab (auto-generated if not provided) |

### Expand Macro

Create expandable/collapsible content:

```handlebars
{{#confluence-expand title="Click to see more details"}}
  <p>This content is hidden by default and will be revealed when clicked.</p>
{{/confluence-expand}}
```

## Using Macro Helpers

Publish-confluence provides two approaches for adding macros to your Confluence pages:

### Approach 1: Using the `{{{macro}}}` Variable (Recommended)

The simplest approach is to include the `{{{macro}}}` variable in your page template:

```handlebars
<h1>{{pageTitle}}</h1>

{{{macro}}}

<hr/>
<p><em>Last updated: {{currentDate}}</em></p>
```

With this approach:
- The `macro` variable contains the HTML macro content generated from your macro template
- This is ideal for most cases and provides a clean separation between page structure and macro content

### Approach 2: Using Macro Helper Functions Directly

You can also use macro helpers directly in your page template:

```handlebars
<h1>{{pageTitle}}</h1>

{{#confluence-html}}
  <div id="app"></div>
  {{{styles}}}
  {{{scripts}}}
{{/confluence-html}}

{{#confluence-panel title="About This App" type="info"}}
  <p>This application provides...</p>
{{/confluence-panel}}

<hr/>
<p><em>Last updated: {{currentDate}}</em></p>
```

With this approach:
- You have control over the placement of each macro
- You can include multiple macros of different types
- This is ideal for complex page layouts

## Default Templates

If you don't provide custom templates, the tool uses these default templates:

**Default Page Template:**
```html
<h1>{{pageTitle}}</h1>

{{{macro}}}

<hr/>
<p><em>Last updated: {{currentDate}}</em></p>
```

**Default Macro Template:**
```html
<div>
  <div id="app"></div>
  {{{styles}}}
  {{{scripts}}}
</div>
```

You can create your own custom templates based on these defaults.

## Custom Templates

Create your own templates to customize the page and macro content:

**confluence-template.html** (page template):
```html
<h1>{{pageTitle}}</h1>

{{confluence-toc minLevel=2 maxLevel=3}}

<h2>Application Dashboard</h2>

{{#confluence-layout}}
  {{#layout-section type="two_equal"}}
    {{#layout-cell}}
      {{#confluence-panel title="About This Application" type="info"}}
        <p>This dashboard provides real-time insights into your data.</p>
        {{confluence-status type="green" text="Active"}}
      {{/confluence-panel}}
    {{/layout-cell}}
    
    {{#layout-cell}}
      {{{macro}}}
    {{/layout-cell}}
  {{/layout-section}}
{{/confluence-layout}}

<hr/>
<p><em>Last updated: {{currentDate}}</em></p>
```

**macro-template.html** (macro template):
```html
<div class="html-macro">
  <div id="app">
    <p>Loading application...</p>
  </div>
  {{{styles}}}
  {{{scripts}}}
</div>
```

## Command Line Options

```
Usage: publish-confluence [options] [command]

Options:
  -q, --quiet              Suppress all output except errors
  -v, --verbose            Enable verbose output
  -d, --debug              Enable debug output
  --dry-run [dir]          Generate storage files locally instead of publishing to Confluence
  --no-preview             Disable HTML preview generation in dry-run mode
  -c, --comment            Display content with comment flags in info macros
  --log-file [path]        Enable logging to file with optional custom path
  --allow-self-signed      Allow self-signed SSL certificates (default: true)
  --no-allow-self-signed   Disallow self-signed SSL certificates
  -h, --help               Display help

Commands:
  publish                  Publish JavaScript builds and HTML content to Confluence (default)
  create                   Create a new publish-confluence project
  fetch                    Fetch content from a Confluence page
  generate-prompt          Generate a project prompt for LLM assistance
```

### Dry-Run Mode

The dry-run mode allows you to generate Confluence storage format files locally without actually publishing to Confluence. This is useful for testing, previewing, and debugging your pages before publishing them.

```bash
# Generate files in the default 'dry-run' directory
publish-confluence --dry-run

# Specify a custom directory
publish-confluence --dry-run ./my-preview
```

When using dry-run mode, the tool will:

1. Create a local directory structure mirroring your Confluence space hierarchy
2. Generate HTML files with properly formatted Confluence storage content
3. Copy all attachments to the appropriate directories
4. Generate an HTML preview that looks similar to Confluence for browsing locally

#### HTML Preview Feature

By default, dry-run mode generates an HTML preview that allows you to browse the page hierarchy and view your pages with Confluence-like styling. This makes it easy to verify the output before publishing to the actual Confluence instance.

To disable the preview generation:

```bash
publish-confluence --dry-run --no-preview
```

The preview provides:
- A browsable page hierarchy similar to Confluence
- Confluence-like styling and formatting
- Proper rendering of Confluence macros
- Links to attachments and other pages
- A responsive layout that works on different screen sizes

You can open the generated `index.html` file in any browser to browse your pages.

## Authentication

Authentication details are read from environment variables:

- `CONFLUENCE_BASE_URL`: Your Confluence instance URL 
- `CONFLUENCE_TOKEN`: Your API token for authentication

You can set these in a `.env` file in your project root.

## Example Workflow

1. Create a JavaScript application with a build process that outputs to `./dist`
2. Configure publish-confluence with your Confluence details
3. Run `publish-confluence` after building your application
4. View your application on the published Confluence page

## Project Structure and Tech Stack Recommendations

To make the most of publish-confluence when embedding web applications in Confluence, consider the following recommendations for structuring your projects and selecting appropriate technologies.

### Recommended Project Structure

```
my-confluence-app/
├── src/                      # Source code
│   ├── components/           # UI components
│   ├── services/             # API services and data handling
│   ├── styles/               # CSS/SCSS styles
│   ├── utils/                # Utility functions
│   ├── index.js              # Main entry point
│   └── index.html            # HTML template
├── public/                   # Static assets
│   ├── images/
│   └── fonts/
├── dist/                     # Build output (generated)
├── confluence-template.html  # Confluence page template
├── macro-template.html       # HTML macro template
├── publish-confluence.json   # Publishing configuration
├── package.json              # Dependencies and scripts
└── README.md                 # Project documentation
```

### Recommended Tech Stacks

#### 1. Lightweight Applications (Best Performance)

For optimal performance in Confluence HTML macros:

- **Framework**: Vanilla JS, Preact, or Alpine.js
- **Bundler**: esbuild, Rollup, or Webpack 5 with minimal plugins
- **CSS**: Plain CSS or PostCSS for simple needs
- **Build size**: Aim for <100KB total bundle size
- **Dependencies**: Minimize external dependencies

This stack works well for dashboards, simple tools, and content-focused applications.

#### 2. Modern React/Vue Applications

For more complex applications with rich interactions:

- **Framework**: React, Vue, or Svelte
- **Bundler**: Vite or Webpack 5
- **CSS**: CSS Modules, Styled Components, or Tailwind CSS
- **Build optimization**: Code splitting, tree shaking, and modern browser targets
- **Loading strategy**: Consider adding a loading state in the macro template

This stack is ideal for interactive tools, advanced visualizations, and multi-step processes.

#### 3. Data Visualization Applications

For applications focused on displaying data:

- **Framework**: Any lightweight framework
- **Visualization**: D3.js, Chart.js, or ECharts
- **Data handling**: Keep data processing minimal or use web workers
- **Streaming**: Consider streaming large datasets rather than loading all at once
- **Interactivity**: Add filtering and exploration capabilities when appropriate

Perfect for reports, analytics dashboards, and data exploration tools.

### Build Optimization Tips

1. **Module Federation**: For very large applications, consider using Webpack's Module Federation to load parts of your application on demand.

2. **Asset Optimization**:
   - Compress images and convert to modern formats (WebP)
   - Use SVG for icons and simple illustrations
   - Deliver only the fonts and font weights you need

3. **Code Splitting**: Break your application into chunks that load on demand:
   ```js
   // Example using dynamic imports
   const DataVisualizer = React.lazy(() => import('./components/DataVisualizer'));
   ```

4. **Performance Monitoring**:
   - Add Lighthouse CI to your build process
   - Set budgets for JavaScript, CSS, and total page size
   - Monitor Core Web Vitals in your embedded applications

### Template Customization

Create specialized templates for different types of applications:

1. **Full-Page Applications**:
   ```html
   <div class="app-container full-width">
     <div id="app"></div>
     {{{styles}}}
     {{{scripts}}}
   </div>
   ```

2. **Side-by-Side Content and App**:
   ```html
   <div class="flex-container">
     <div class="content-side">
       <h3>Application Guide</h3>
       <p>Instructions and context for using this tool...</p>
     </div>
     <div class="app-side">
       <div id="app"></div>
       {{{styles}}}
       {{{scripts}}}
     </div>
   </div>
   ```

3. **Multiple Apps on One Page**:
   Consider creating separate macros for each app and publishing them to the same page with different HTML element IDs.


### Common Pitfalls to Avoid

1. **DOM Conflicts**: Confluence may have global styles and scripts that conflict with your application. Use namespacing and scoped styles.

2. **Authentication Issues**: Remember that users viewing your app will be authenticated to Confluence, not necessarily to your backend services.

3. **Large Dependencies**: Avoid frameworks and libraries that significantly increase bundle size without providing equivalent value.

4. **Aggressive Polling**: Limit polling frequency for data updates to avoid putting excessive load on Confluence servers.

5. **Script Errors**: Add error boundaries and comprehensive error logging to ensure script errors don't cause the entire macro to fail.

By following these recommendations, you can create performant, maintainable applications that integrate smoothly with Confluence using publish-confluence.

## TODOs and Future Improvements

- [ ] Implement page labels/tags support for better organization
- [ ] Add template validation to catch common errors before publishing
- [ ] Add option to publish without updating attachments (faster updates)
- [x] Add support for other macro types beyond HTML macro
- [x] Create a configuration wizard for easier setup
- [x] Add support for publishing multiple pages at once. Add 'childPages' to configuration files
- [ ] Add testing infrastructure and unit tests
- [ ] Support for concurrent uploads to improve performance with many attachments
- [ ] Add a preview mode to see compiled templates without publishing

## Troubleshooting

If you encounter issues:

1. Use the `--debug` flag to enable detailed logging:
   ```bash
   publish-confluence --debug
   ```

2. Check that your Confluence credentials are correct:
   - Ensure `CONFLUENCE_BASE_URL` is the full URL (e.g., "https://your-domain.atlassian.net")
   - Verify your `CONFLUENCE_TOKEN` is valid and has not expired
   - For self-signed certificates, use the `--allow-self-signed` flag

3. Verify that your space key and parent page (if specified) exist:
   - Space keys are case-sensitive
   - If using a personal space, prefix the space key with a tilde (e.g., "~username")
   - Check if you have view permissions for the parent page

4. Ensure your build directory contains the expected files:
   - Verify your build process completed successfully
   - Check that your `includedFiles` patterns in `publish-confluence.json` are correct
   - Make sure the `distDir` path in your config points to the correct build output directory

5. Check that you have the necessary permissions in Confluence:
   - You need "Add Page" permissions to create new pages
   - You need "Edit" permissions to update existing pages
   - You need "Add Attachment" permissions to upload files

### Common Error Messages and Solutions

| Error Message | Possible Cause | Solution |
|---------------|----------------|----------|
| "Authentication credentials are invalid" | Invalid or expired token | Generate a new API token in your Atlassian account |
| "You do not have permission to perform this action" | Insufficient Confluence permissions | Request necessary permissions from your Confluence admin |
| "Parent page not found" | The specified parent page doesn't exist or is inaccessible | Check the exact title of the parent page or use the space homepage instead |
| "No files found to attach" | Build files missing or incorrect patterns | Verify build output exists and check includedFiles patterns |
| "Page already exists" | A page with the same title exists but couldn't be detected | Use a unique page title or check if the page exists in a different location |
| "SSL certificate error" | Self-signed or invalid SSL certificate | Use the `--allow-self-signed` flag if your Confluence instance uses a self-signed certificate |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
