# MermaidJS Integration for publish-confluence

## Overview

This document outlines the architecture for supporting MermaidJS diagrams in Confluence pages using the publish-confluence tool. The implementation will allow users to create diagrams with Mermaid syntax directly in their templates.

## Requirements

1. Support a new Handlebars helper: `{{confluence-mermaid}}` for embedding Mermaid diagrams
2. Upload MermaidJS script and icon packs to Confluence page attachments only once per page
3. Ensure diagrams render correctly in Confluence's HTML macro
4. Allow configuration of Mermaid rendering options
5. Support both inline Mermaid diagram text and file references

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

1. **Mermaid Assets Management**
   - Package the required Mermaid JS files with the publish-confluence tool
   - Include the core Mermaid script and icon packs
   - Version the assets to allow updating

2. **Asset Upload Logic**
   - Before rendering the page, check if Mermaid assets exist on the page
   - Upload assets only if they don't exist or if versions differ
   - Track uploaded assets to prevent duplicate uploads in the same session

3. **Helper Implementation**
   - Register a new `confluence-mermaid` helper in `macro-helpers.ts`
   - Support both block and non-block (file reference) syntax
   - Process diagram content or load from referenced file
   - Generate unique IDs for each diagram

4. **HTML Generation**
   - Generate HTML structure with a container div for the diagram
   - Include script tags that initialize Mermaid with proper configuration
   - **Important**: Ensure proper XHTML escaping by wrapping content in Confluence's HTML macro with CDATA section
   - Avoid direct inclusion of JavaScript code in the template output that isn't properly wrapped in a macro

5. **Configuration Options**
   - Support Mermaid theme configuration (default, dark, neutral, forest)
   - Support toggling icons and other Mermaid rendering options
   - Allow customization of diagram CSS

## Asset Management Implementation

### 1. Adding Mermaid Dependencies

Add MermaidJS and icon pack dependencies to the project's package.json:

```json
"dependencies": {
  // ...existing dependencies
  "mermaid": "^10.8.0",
  "uuid": "^9.0.1"
}
```

### 2. Asset Structure

Create a dedicated assets directory for Mermaid files within the project:

```
/assets
  /mermaid
    mermaid.min.js       # Minified Mermaid library
    icons-logos.json     # Icon pack - logos
    icons-mdi.json       # Icon pack - Material Design Icons
    icons-fa.json        # Icon pack - Font Awesome
    asset-manifest.json  # Version info for assets
```

### 3. Build Process Integration

Add a build step to copy and prepare Mermaid assets:

1. Create a build script that:
   - Copies the necessary Mermaid files from node_modules
   - Extracts and optimizes icon packs
   - Generates an asset manifest with version information

2. Add a script to package.json to run this during build:

```json
"scripts": {
  "prepare-mermaid-assets": "ts-node src/scripts/prepare-mermaid-assets.ts",
  "build": "tsc --noEmit && vite build && npm run prepare-mermaid-assets"
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

### 5. Helper Implementation

The Mermaid helper implementation should:

1. Extract diagram content from block content or file
2. Generate a unique ID for the diagram
3. Wrap the diagram in a properly structured Confluence HTML macro
4. Include initialization JavaScript within CDATA section
5. Track used icon packs for asset uploading

```typescript
// src/mermaid-helper.ts
export function registerMermaidHelper(handlebars: HandlebarsInstance): void {
  handlebars.registerHelper('confluence-mermaid', function(this: any, options: any) {
    // Process options and get diagram definition...
    
    // Generate HTML structure with proper CDATA wrapping
    const htmlContent = `
      <div id="${diagramId}" class="mermaid">
        ${escapedDefinition}
      </div>
      <script><!--
        // Mermaid initialization code
      //--></script>
    `;
    
    // Wrap in Confluence HTML macro
    return new handlebars.SafeString(`
      <ac:structured-macro ac:name="html" ac:schema-version="1" ac:macro-id="${macroId}">
        <ac:plain-text-body><![CDATA[${htmlContent}]]></ac:plain-text-body>
      </ac:structured-macro>
    `);
  });
}
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

