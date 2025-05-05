// src/project-templates/documentation-project.ts
import fs from 'fs/promises';
import path from 'path';
import { Logger, ProjectTemplate } from './project-template-interface';

/**
 * Documentation project template implementation
 * - Creates pure documentation pages for Confluence
 * - No macro template (no JavaScript or assets)
 * - Support for parent/child page structure
 */
export class DocumentationProject implements ProjectTemplate {
  constructor(private log: Logger) {}

  getName(): string {
    return 'Documentation Project';
  }

  getDescription(): string {
    return 'Pure documentation pages (no JavaScript)';
  }

  getIncludedFiles(): string[] {
    // Documentation projects don't have attachments
    return [];
  }

  getPackageJsonTemplate(projectName: string): any {
    return {
      name: projectName,
      version: "1.0.0",
      description: "Documentation for Confluence using publish-confluence",
      scripts: {
        "publish": "publish-confluence"
      },
      devDependencies: {
        "publish-confluence": "file:../../"
      }
    };
  }

  getPageTemplate(): string {
    return `<h1>{{pageTitle}}</h1>

<p>Add your documentation content here.</p>

{{#confluence-panel title="Documentation" type="note"}}
<p>This page was created using publish-confluence documentation template.</p>
{{/confluence-panel}}

<hr/>
<p><em>Last updated: {{currentDate}}</em></p>`;
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
      const childTemplate = `<h1>Page ${pageNumber}</h1>

<p>Add your content for child page ${pageNumber} here.</p>

{{#confluence-info title="Child Page ${pageNumber}"}}
<p>This is a child page in your documentation structure.</p>
{{/confluence-info}}

<hr/>
<p><em>Last updated: {{currentDate}}</em></p>`;
      
      await fs.writeFile(
        path.join(childDir, `page-${pageNumber}.html`),
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
        path.join(projectDir, 'confluence-template.html'),
        this.getPageTemplate(),
        'utf8'
      );
      
      this.log.success(`Created main page template: confluence-template.html`);
      
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
            templatePath: `./child-pages/page-${i}.html`,
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

  async createConfigFiles(projectDir: string, projectName: string, spaceKey?: string, parentPageTitle?: string): Promise<void> {
    // Documentation project doesn't need additional config files
    return;
  }
}
