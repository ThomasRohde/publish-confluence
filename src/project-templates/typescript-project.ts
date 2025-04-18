// src/project-templates/typescript-project.ts
import fs from 'fs/promises';
import path from 'path';
import { Logger, ProjectTemplate } from './project-template-interface';

/**
 * TypeScript project template implementation
 */
export class TypeScriptProject implements ProjectTemplate {
  constructor(private log: Logger) {}

  getName(): string {
    return 'TypeScript Application';
  }

  getDescription(): string {
    return 'Static typing, enhanced developer experience';
  }

  getIncludedFiles(): string[] {
    return [
      '**/*.js', 
      '**/*.css', 
      '**/*.png', 
      '**/*.jpg', 
      '**/*.svg', 
      '**/*.woff', 
      '**/*.woff2', 
      '**/*.ttf', 
      '**/*.eot',
      '**/*.ts',
      '**/*.tsx'
    ];
  }

  getPackageJsonTemplate(projectName: string): any {
    return {
      name: projectName,
      version: "1.0.0",
      description: "A TypeScript application for Confluence using publish-confluence",
      main: "src/index.ts",
      scripts: {
        "dev": "tsc --watch",
        "build": "tsc",
        "publish": "npm run build ; publish-confluence"
      },
      devDependencies: {
        "typescript": "^5.0.0",
        "publish-confluence": "file:../../"
      }
    };
  }

  getPageTemplate(): string {
    return `<h1>{{pageTitle}}</h1>

{{{macro}}}

<hr/>
<p><em>Last updated: {{currentDate}}</em></p>`;
  }

  getMacroTemplate(): string {
    return `<div class="typescript-app">
  <div id="app"></div>
  {{{styles}}}
  {{{scripts}}}
</div>`;
  }

  async createSourceFiles(srcDir: string, projectName: string): Promise<void> {
    try {
      // Create source directory
      await fs.mkdir(srcDir, { recursive: true });
      
      // Create index.ts
      await fs.writeFile(
        path.join(srcDir, 'index.ts'),
        `/**
 * Main entry point for the TypeScript application
 */

interface AppConfig {
  name: string;
  version: string;
  environment: 'development' | 'production';
}

class ConfluenceApp {
  private config: AppConfig;
  private container: HTMLElement | null;

  constructor(config: AppConfig) {
    this.config = config;
    this.container = null;
  }

  public initialize(): void {
    console.log(\`Initializing \${this.config.name} v\${this.config.version}\`);
    this.container = document.getElementById('app');
    
    if (!this.container) {
      console.error('App container not found');
      return;
    }
    
    this.render();
  }

  private render(): void {
    if (!this.container) return;
    
    // Create app elements
    const header = document.createElement('h1');
    const message = document.createElement('p');
    const environmentBadge = document.createElement('div');
    
    // Set content and classes
    header.textContent = 'TypeScript Confluence App';
    message.textContent = 'This is a TypeScript application published to Confluence using publish-confluence.';
    environmentBadge.textContent = this.config.environment;
    environmentBadge.className = \`environment-badge \${this.config.environment}\`;
    
    // Add elements to the DOM
    this.container.appendChild(header);
    this.container.appendChild(message);
    this.container.appendChild(environmentBadge);
  }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new ConfluenceApp({
    name: '${projectName}',
    version: '1.0.0',
    environment: 'production'
  });
  
  app.initialize();
});`,
        'utf8'
      );
      
      this.log.success(`Created TypeScript source files in ${srcDir}`);
    } catch (error) {
      this.log.error(`Failed to create TypeScript source files: ${(error as Error).message}`);
      throw error;
    }
  }

  async createConfigFiles(projectDir: string, projectName: string): Promise<void> {
    try {
      // Create tsconfig.json
      await fs.writeFile(
        path.resolve(projectDir, 'tsconfig.json'),
        `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}`,
        'utf8'
      );
      
      this.log.success('Created tsconfig.json');
    } catch (error) {
      this.log.error(`Failed to create tsconfig.json: ${(error as Error).message}`);
      throw error;
    }
  }
}