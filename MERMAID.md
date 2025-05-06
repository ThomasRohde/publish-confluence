# MermaidJS Integration for publish-confluence

## Overview

This document outlines the architecture for supporting MermaidJS diagrams in Confluence pages using the publish-confluence tool. The implementation will allow users to create diagrams with Mermaid syntax directly in their templates.

## Requirements

1. Support a new Handlebars helper: `{{confluence-mermaid}}` for embedding Mermaid diagrams
2. Leverage the user's own Mermaid JS files included in their project's distribution directory
3. Ensure diagrams render correctly in Confluence's HTML macro
4. Allow configuration of Mermaid rendering options
5. Support both inline Mermaid diagram text and file references
6. Track Mermaid assets in a publishing run to avoid duplicate code inclusion

## Architecture

### Helper Usage Examples

```handlebars
{{#confluence-mermaid icons='true' theme='dark'}}
graph TD
    A[Client] --> B[Server]
    B --> C[Database]
{{/confluence-mermaid}}

{{confluence-mermaid file='diagrams/architecture.mmd' theme='neutral'}}
```

### Implementation Architecture

1. **User-Managed Mermaid Assets**
   - Users include Mermaid JS files in their project's build output directory
   - Standard pattern: `/dist/mermaid/mermaid.min.js` (and any required icon packs)
   - User's build process is responsible for placing these files correctly

2. **Attachment Reuse Strategy**
   - Leverage the existing attachment framework in `publisher.ts`
   - Ensure Mermaid scripts are included in the `includedFiles` patterns in `publish-confluence.json`
   - Example pattern: `"mermaid/**/*.js"` and `"mermaid/**/*.json"` for icon packs

3. **Helper Implementation**
   - Register a new `confluence-mermaid` helper in `macro-helpers.ts`
   - Support both block and non-block (file reference) syntax
   - Process diagram content or load from referenced file
   - Generate unique IDs for each diagram
   - Track Mermaid assets already included on the page to avoid duplicates

4. **HTML Generation**
   - Generate HTML structure with a container div for the diagram
   - Include script tags that initialize Mermaid with proper configuration
   - **Important**: Ensure proper XHTML escaping by wrapping content in Confluence's HTML macro with CDATA section
   - Avoid direct inclusion of JavaScript code in the template output that isn't properly wrapped in a macro

5. **Configuration Options**
   - Support Mermaid theme configuration (default, dark, neutral, forest)
   - Support toggling icons and other Mermaid rendering options
   - Allow customization of diagram CSS

## Implementation Details

### 1. User Setup for Mermaid Integration

Users need to include Mermaid in their project:

```json
"dependencies": {
  // ...existing dependencies
  "mermaid": "^10.8.0" 
}
```

And ensure their build process copies Mermaid files to the dist directory:

```json
"scripts": {
  "prebuild": "mkdir -p dist/mermaid",
  "build": "vite build",
  "postbuild": "cp node_modules/mermaid/dist/mermaid.min.js dist/mermaid/"
}
```

### 2. Asset Configuration

In the `publish-confluence.json` file, users need to include Mermaid files in the attachment patterns:

```json
{
  "spaceKey": "DOCS",
  "pageTitle": "Project Documentation",
  "distDir": "./dist",
  "includedFiles": [
    "**/*.js", 
    "**/*.css",
    "**/*.png",
    "mermaid/**/*"
  ],
  "excludedFiles": [
    "**/*.map"
  ]
}
```

### 3. Mermaid Helper Implementation Strategy

The helper will maintain a cache of included Mermaid assets during a publishing run:

```typescript
// Track Mermaid initialization across one publishing run
let mermaidInitialized = false;
const generatedDiagramIds = new Set<string>();

export function registerMermaidHelper(handlebars: HandlebarsInstance): void {
  handlebars.registerHelper('confluence-mermaid', function(this: any, options: any) {
    const uniqueId = `mermaid-${generateUuid()}`;
    generatedDiagramIds.add(uniqueId);
    
    // Generate initialization code only once per page
    const initScript = !mermaidInitialized 
      ? generateMermaidInitScript(options.hash)
      : '';
    
    // Track that we've included initialization
    mermaidInitialized = true;
    
    // Generate HTML structure
    // ...
  });
}
```

### 4. XML Parsing Considerations

A critical aspect of embedding JavaScript content in Confluence pages is proper XML handling. Confluence storage format is XHTML-based and requires special handling:

1. **CDATA Wrapping**: All HTML and JavaScript content must be wrapped in CDATA sections within an HTML macro to prevent XML parsing errors:

```typescript
// Correct approach - wrap in Confluence HTML macro with CDATA
return new handlebars.SafeString(`
  <ac:structured-macro ac:name="html" ac:schema-version="1" ac:macro-id="${macroId}">
    <ac:plain-text-body><![CDATA[${htmlContent}]]></ac:plain-text-body>
  </ac:structured-macro>
`);
```

2. **Avoid Direct JavaScript**: Never include raw JavaScript or HTML that might contain special XML characters (<, >, &, etc.) directly in the Confluence storage format.

3. **Use HTML comments for JavaScript**: When including JavaScript within CDATA blocks, it's best practice to also wrap the code in HTML comments to improve compatibility:

```html
<script><!--
  // JavaScript code here
//--></script>
```

4. **Escaping Content**: Always escape HTML special characters in user-provided content:

```typescript
const escapedDefinition = diagramDefinition
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');
```

## Integration Testing

When implementing and testing Mermaid integration:

1. Start with minimal examples without complex syntax
2. Test the XML parsing by examining Confluence API errors
3. Verify asset uploading works correctly
4. Gradually add more complex diagrams and features

## Troubleshooting Common Issues

- **XML Parsing Errors**: Usually caused by improperly escaped special characters or missing CDATA wrappers
- **Diagram Not Rendering**: Check browser console for JavaScript errors; ensure Mermaid script is properly loaded
- **Asset Upload Failures**: Verify file paths and permissions; check Confluence attachment size limits
- **Icon Pack Issues**: Ensure icon packs are properly extracted and referenced

By following these guidelines, Mermaid diagrams can be successfully embedded in Confluence pages with proper rendering and asset management.

