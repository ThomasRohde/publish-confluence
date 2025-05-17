// src/project-templates/markdown-documentation-project.ts
import fs from 'fs/promises';
import path from 'path';
import { Logger, ProjectTemplate } from './project-template-interface';

/**
 * Markdown Documentation project template implementation
 * - Creates pure documentation pages for Confluence using Markdown
 * - No macro template (no JavaScript or assets)
 * - Support for parent/child page structure
 * - Templates use Markdown (.md) format instead of HTML
 */
export class MarkdownDocumentationProject implements ProjectTemplate {
  constructor(private log: Logger) {}

  getName(): string {
    return 'Markdown Documentation Project';
  }

  getDescription(): string {
    return 'Pure documentation pages using Markdown format';
  }

  getIncludedFiles(): string[] {
    // Documentation projects don't have attachments
    return [];
  }

  getPackageJsonTemplate(projectName: string): any {
    return {
      name: projectName,
      version: "1.0.0",
      description: "Markdown documentation for Confluence using publish-confluence",
      scripts: {
        "publish": "publish-confluence"
      },
      devDependencies: {
        "publish-confluence": "file:../../"
      }
    };
  }

  getPageTemplate(): string {
    return `# {{pageTitle}}

Add your documentation content here. This template uses Markdown format.

{{#confluence-panel title="Documentation" type="note"}}
This page was created using publish-confluence markdown documentation template.
{{/confluence-panel}}

---
*Last updated: {{currentDate}}*`;
  }

  // Documentation project doesn't need a macro template
  getMacroTemplate(): string {
    return '';
  }

  /**
   * Creates template files for child pages
   * @param childDir The directory to create child templates in
   * @param pageNumber The child page number
   */
  async createChildPageTemplate(childDir: string, pageNumber: number): Promise<void> {
    try {
      const childTemplate = `# Page ${pageNumber}

Add your content for child page ${pageNumber} here.

{{#confluence-info title="Child Page ${pageNumber}"}}
This is a child page in your documentation structure.
{{/confluence-info}}

---
*Last updated: {{currentDate}}*`;
      
      await fs.writeFile(
        path.join(childDir, `page-${pageNumber}.md`),
        childTemplate,
        'utf8'
      );
      
      this.log.success(`Created template for child page ${pageNumber}`);
    } catch (error) {
      this.log.error(`Failed to create child page template: ${(error as Error).message}`);
      throw error;
    }
  }

  async createSourceFiles(srcDir: string, projectName: string): Promise<void> {
    // Documentation project doesn't need source files
    return;
  }
  
  /**
   * Creates documentation pages based on the number of pages requested
   * @param projectDir The project directory
   * @param projectName The name of the project
   * @param pageCount The number of pages to create
   * @returns Array of child page configurations for the publish-confluence.json file
   */
  async createDocumentationPages(projectDir: string, projectName: string, pageCount: number): Promise<any[]> {
    try {
      // Create the main template file
      await fs.writeFile(
        path.join(projectDir, 'confluence-template.md'),
        this.getPageTemplate(),
        'utf8'
      );
      
      this.log.success(`Created main page template: confluence-template.md`);
      
      const childConfigs = [];
      
      if (pageCount > 1) {
        // Create a folder for child pages
        const childPagesDir = path.join(projectDir, 'child-pages');
        await fs.mkdir(childPagesDir, { recursive: true });
        
        // Create templates for each child page
        for (let i = 1; i < pageCount; i++) {
          await this.createChildPageTemplate(childPagesDir, i);
          
          // Add child page configuration
          childConfigs.push({
            pageTitle: `Page ${i}`,
            templatePath: `./child-pages/page-${i}.md`, // Note .md extension for Markdown
            macroTemplatePath: null
          });
        }
        
        this.log.success(`Created ${pageCount - 1} child page templates in 'child-pages' directory`);
      }
      
      return childConfigs;
      
    } catch (error) {
      this.log.error(`Failed to create documentation pages: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Creates a README.md file with information about Markdown templates
   * @param projectDir The project directory
   */
  async createReadmeFile(projectDir: string): Promise<void> {
    const readmeContent = `# Markdown Documentation Project

This project contains Markdown templates for Confluence documentation using publish-confluence.

## Features

- Uses Markdown (.md) files for templates instead of HTML
- Automatically converts Markdown to Confluence-compatible XHTML during publishing
- Supports GitHub Flavored Markdown syntax (tables, code blocks, task lists, etc.)
- Preserves Handlebars expressions during Markdown processing

## Templates

- \`confluence-template.md\`: Main page template
- \`child-pages/*.md\`: Child page templates

## Publishing

To publish your documentation to Confluence:

\`\`\`bash
npm run publish
\`\`\`

To preview your documentation without publishing:

\`\`\`bash
npx publish-confluence --dry-run --markdown
\`\`\`

This will generate preview files with the processed Markdown content.

## Markdown Features

- **Bold**, *italic*, and ~~strikethrough~~ text
- Tables, lists, and code blocks with syntax highlighting
- Links, images, and blockquotes
- Task lists and more

See the [GitHub Flavored Markdown Spec](https://github.github.com/gfm/) for more details.

## Confluence Macros

You can mix Markdown with Confluence macros using Handlebars syntax:

\`\`\`markdown
{{#confluence-info title="Important"}}
This is an info box.
{{/confluence-info}}
\`\`\`
`;

    try {
      await fs.writeFile(path.join(projectDir, 'README.md'), readmeContent, 'utf8');
      this.log.success('Created README.md with project information');
    } catch (error) {
      this.log.error(`Failed to create README.md: ${(error as Error).message}`);
    }
  }
  async createConfigFiles(projectDir: string, projectName: string, spaceKey?: string, parentPageTitle?: string, childPages: any[] = []): Promise<void> {
    try {
      // Create publish-confluence.json configuration file
      const configContent = {
        spaceKey: spaceKey || "YOUR_SPACE",
        pageTitle: projectName,
        parentPageTitle: parentPageTitle || undefined,
        templatePath: "./confluence-template.md", // Note .md extension for Markdown
        childPages: childPages
      };
      
      await fs.writeFile(
        path.join(projectDir, 'publish-confluence.json'),
        JSON.stringify(configContent, null, 2),
        'utf8'
      );
      
      this.log.success('Created publish-confluence.json configuration');
      
      // Create README with project info
      await this.createReadmeFile(projectDir);
      
    } catch (error) {
      this.log.error(`Failed to create configuration files: ${(error as Error).message}`);
      throw error;
    }
  }
}
