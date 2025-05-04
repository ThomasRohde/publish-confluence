// src/project-templates/react-project.ts
import fs from 'fs/promises';
import path from 'path';
import { Logger, ProjectTemplate } from './project-template-interface';

/**
 * React project template implementation
 */
export class ReactProject implements ProjectTemplate {
  constructor(private log: Logger) {}

  getName(): string {
    return 'React Application';
  }

  getDescription(): string {
    return 'Modern component-based UI with React';
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
      '**/*.json',
      '**/*.woff2'
    ];
  }

  getPackageJsonTemplate(projectName: string): any {
    return {
      name: projectName,
      version: "1.0.0",
      description: "A React application for Confluence using publish-confluence",
      main: "src/index.jsx",
      scripts: {
        "dev": "vite",
        "build": "vite build",
        "preview": "vite preview",
        "publish": "npm run build ; publish-confluence"
      },
      dependencies: {
        "react": "latest",
        "react-dom": "latest"
      },
      devDependencies: {
        "@vitejs/plugin-react": "latest",
        "vite": "latest",
        "terser": "latest",
        "publish-confluence": "file:../../"
      }
    };
  }

  getPageTemplate(): string {
    return `<h1>{{pageTitle}}</h1>

<div class="app-container">
  {{{macro}}}
</div>

<hr/>
<p><em>Last updated: {{currentDate}}</em></p>`;
  }

  getMacroTemplate(): string {
    return `<div class="react-app-container">
  <div id="root">
    <div class="loading-indicator">Loading application...</div>
  </div>
  {{{styles}}}
  {{{scripts}}}
</div>`;
  }

  async createSourceFiles(srcDir: string, projectName: string): Promise<void> {
    try {
      // Create source directory and components subdirectory
      await fs.mkdir(path.join(srcDir, 'components'), { recursive: true });
      
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
  <div id="root"></div>
</body>
</html>`,
        'utf8'
      );
      
      // Create index.jsx
      await fs.writeFile(
        path.join(srcDir, 'index.jsx'),
        `import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './components/App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
        'utf8'
      );
      
      // Create App.jsx component
      await fs.writeFile(
        path.join(srcDir, 'components', 'App.jsx'),
        `import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);
  
  return (
    <div className="app">
      <h1>Hello from React!</h1>
      <p>This app is published to Confluence using publish-confluence</p>
      
      <div className="card">
        <button onClick={() => setCount(count + 1)}>
          Count is {count}
        </button>
      </div>
    </div>
  );
}`,
        'utf8'
      );
      
      // Create styles.css
      await fs.writeFile(
        path.join(srcDir, 'styles.css'),
        `.app {
  max-width: 800px;
  margin: 0 auto;
  text-align: center;
  font-family: Arial, sans-serif;
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #0052CC;
  color: white;
  cursor: pointer;
  transition: border-color 0.25s;
}

button:hover {
  border-color: #646cff;
}`,
        'utf8'
      );
      
      this.log.success(`Created React source files in ${srcDir}`);
    } catch (error) {
      this.log.error(`Failed to create React source files: ${(error as Error).message}`);
      throw error;
    }
  }

  async createConfigFiles(projectDir: string, projectName: string): Promise<void> {
    try {
      // Create vite.config.js
      await fs.writeFile(
        path.resolve(projectDir, 'vite.config.js'),
        `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});`,
        'utf8'
      );
      
      this.log.success('Created vite.config.js');
    } catch (error) {
      this.log.error(`Failed to create vite.config.js: ${(error as Error).message}`);
      throw error;
    }
  }
}