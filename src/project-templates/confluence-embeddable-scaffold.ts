// src/project-templates/confluence-embeddable-scaffold.ts
import fs from 'fs/promises';
import path from 'path';
import { Logger, ProjectTemplate } from './project-template-interface';

/**
 * Confluence Embeddable Application Scaffold template implementation
 */
export class ConfluenceEmbeddableScaffold implements ProjectTemplate {
  constructor(private log: Logger) {}

  getName(): string {
    return 'Confluence Embeddable Application Scaffold';
  }

  getDescription(): string {
    return 'TypeScript application that can be embedded in Confluence as an HTML macro';
  }

  getIncludedFiles(): string[] {
    return [
      '**/*.js', 
      '**/*.css', 
      '**/*.png', 
      '**/*.jpg', 
      '**/*.svg', 
      '**/*.json',
      '!**/*.map'
    ];
  }

  getPackageJsonTemplate(projectName: string): any {
    return {
      name: projectName,
      version: "1.0.0",
      description: "A TypeScript application that can be embedded in Confluence as an HTML macro",
      type: "module",
      scripts: {
        "dev": "vite",
        "build": "tsc -b && vite build",
        "preview": "vite preview",
        "publish": "npm run build ; publish-confluence"
      },
      devDependencies: {
        "vite": "^4.4.9",
        "typescript": "^5.1.6",
        "@types/node": "^20.4.5",
        "publish-confluence": "file:../../"
      },
      dependencies: {
        "axios": "^1.4.0"
      }
    };
  }

  getPageTemplate(): string {
    return `<div class="app-container">
  {{{macro}}}
</div>

<hr/>
<p><em>Last updated: {{currentDate}}</em></p>`;
  }

  getMacroTemplate(): string {
    return `<div class="react-app-container my-app">
  <div id="root">
    <div class="loading-indicator">Loading application...</div>
  </div>
  <div 
    class="my-app-config" 
    data-json-url="https://confluence.example.com/download/attachments/12345/data.json?api=v2"
    data-option-1="value1"
    data-option-2="value2"
    data-option-3="value3"
  >
    Loading application...
  </div>
  {{{styles}}}
  {{{scripts}}}
</div>`;
  }

  async createSourceFiles(srcDir: string, projectName: string): Promise<void> {
    try {
      // Create source directory if it doesn't exist
      await fs.mkdir(srcDir, { recursive: true });
      
      // Create index.html
      await fs.writeFile(
        path.join(srcDir, 'index.html'),
        `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName}</title>
</head>
<body>
  <div class="react-app-container my-app">
    <div id="root">
      <div class="loading-indicator">Loading application...</div>
    </div>
    <div 
      class="my-app-config" 
      data-json-url="./sample-data.json"
      data-option-1="value1"
      data-option-2="value2"
      data-option-3="value3"
    >
      Loading application...
    </div>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>`,
        'utf8'
      );
      
      // Create main.ts
      await fs.writeFile(
        path.join(srcDir, 'main.ts'),
        `// Main entry point for the application
import './styles.css';
import { setupApp } from './utils/setup';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  console.log('App: Application initialized');
  
  // Find the root element
  const root = document.getElementById('root');
  if (root) {
    // Create app container with app-specific class to scope styles
    const appContainer = document.createElement('div');
    appContainer.className = 'app my-app';
    
    // Add to DOM
    root.innerHTML = ''; // Clear loading indicator
    root.appendChild(appContainer);
  }
  
  // Set up application
  setupApp();
});`,
        'utf8'
      );
      
      // Create styles.css
      await fs.writeFile(
        path.join(srcDir, 'styles.css'),
        `/* Application styles */
.my-app {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  max-width: 100%;
  margin: 0 auto;
}

.loading-indicator {
  text-align: center;
  padding: 20px;
  color: #555;
}

.app-content {
  padding: 15px;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-top: 10px;
}

/* Add more styles as needed */`,
        'utf8'
      );
      
      // Create vite-env.d.ts
      await fs.writeFile(
        path.join(srcDir, 'vite-env.d.ts'),
        `/// <reference types="vite/client" />`,
        'utf8'
      );
      
      // Create sample-data.json
      await fs.writeFile(
        path.join(srcDir, 'sample-data.json'),
        `{
  "items": [
    {"id": 1, "name": "Item 1", "value": 100},
    {"id": 2, "name": "Item 2", "value": 200},
    {"id": 3, "name": "Item 3", "value": 300},
    {"id": 4, "name": "Item 4", "value": 400}
  ],
  "metadata": {
    "title": "Sample Data",
    "description": "This is sample data for development purposes"
  }
}`,
        'utf8'
      );
      
      // Create utils directory
      const utilsDir = path.join(srcDir, 'utils');
      await fs.mkdir(utilsDir, { recursive: true });
      
      // Create utils/setup.ts
      await fs.writeFile(
        path.join(utilsDir, 'setup.ts'),
        `import { fetchData } from './http';
import { AppConfig } from '../types/app';

export function setupApp(): void {
  // Find all configuration elements
  const configElements = document.querySelectorAll('.my-app-config');
  
  configElements.forEach(async (element) => {
    try {
      // Extract configuration from data attributes
      const config: AppConfig = {
        jsonUrl: element.getAttribute('data-json-url') || '',
        option1: element.getAttribute('data-option-1') || '',
        option2: element.getAttribute('data-option-2') || '',
        option3: element.getAttribute('data-option-3') || '',
      };
      
      // Validate configuration
      if (!config.jsonUrl) {
        throw new Error('Missing JSON URL configuration');
      }
      
      // Fetch data
      const data = await fetchData(config.jsonUrl);
      
      // Process and display data
      renderApp(data, config);
      
      // Clear loading indicator
      element.innerHTML = '';
      
    } catch (error) {
      console.error('Error setting up application:', error);
      element.innerHTML = \`Error: \${error instanceof Error ? error.message : 'Unknown error'}\`;
    }
  });
}

function renderApp(data: any, config: AppConfig): void {
  // Implement your rendering logic here
  console.log('Rendering application with data:', data);
  console.log('Using configuration:', config);
  
  // Example: Find a target element to render into
  const appContainer = document.querySelector('.app.my-app');
  if (appContainer) {
    // Create a sample visualization or UI
    const content = document.createElement('div');
    content.className = 'app-content';
    content.textContent = \`App loaded with \${Object.keys(data.items).length} data items\`;
    
    appContainer.appendChild(content);
  }
}`,
        'utf8'
      );
      
      // Create utils/http.ts
      await fs.writeFile(
        path.join(utilsDir, 'http.ts'),
        `import axios from 'axios';

export async function fetchData(url: string): Promise<any> {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching data:', error);
    throw new Error('Failed to fetch data from server');
  }
}`,
        'utf8'
      );
      
      // Create types directory
      const typesDir = path.join(srcDir, 'types');
      await fs.mkdir(typesDir, { recursive: true });
      
      // Create types/app.ts
      await fs.writeFile(
        path.join(typesDir, 'app.ts'),
        `export interface AppConfig {
  jsonUrl: string;
  option1: string;
  option2: string;
  option3: string;
  [key: string]: string | undefined;
}`,
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
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}`,
        'utf8'
      );
      
      // Create vite.config.ts
      await fs.writeFile(
        path.resolve(projectDir, 'vite.config.ts'),
        `import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
});`,
        'utf8'
      );
      
      this.log.success('Created TypeScript and Vite configuration files');
    } catch (error) {
      this.log.error(`Failed to create configuration files: ${(error as Error).message}`);
      throw error;
    }
  }
}