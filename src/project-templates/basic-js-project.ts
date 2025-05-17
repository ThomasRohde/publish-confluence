// src/project-templates/basic-js-project.ts
import fs from 'fs/promises';
import path from 'path';
import { Logger, ProjectTemplate } from './project-template-interface';

/**
 * Basic JavaScript project template implementation
 */
export class BasicJsProject implements ProjectTemplate {
  constructor(private log: Logger) {}

  getName(): string {
    return 'Basic JavaScript Application';
  }

  getDescription(): string {
    return 'Vanilla JS, minimal dependencies';
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
      '**/*.eot'
    ];
  }

  getPackageJsonTemplate(projectName: string): any {
    return {
      name: projectName,
      version: "1.0.0",
      description: "A JavaScript application for Confluence using publish-confluence",
      main: "src/index.js",
      scripts: {
        "build": "webpack --mode production",
        "dev": "webpack --mode development",
        "publish": "npm run build ; publish-confluence"
      },
      devDependencies: {
        "webpack": "^5.74.0",
        "webpack-cli": "^4.10.0",
        "css-loader": "^6.7.1",
        "style-loader": "^3.3.1",
        "html-webpack-plugin": "^5.5.0",
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
    return `<div>
  <div id="app"></div>
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
  <div id="app"></div>
</body>
</html>`,
        'utf8'
      );
      
      // Create index.js
      await fs.writeFile(
        path.join(srcDir, 'index.js'),
        `import './styles.css';

document.addEventListener('DOMContentLoaded', () => {
  // Create app elements
  const app = document.getElementById('app');
  const header = document.createElement('h1');
  const message = document.createElement('p');
  
  // Set content
  header.textContent = 'Hello Confluence!';
  message.textContent = 'This is a simple JavaScript app published to Confluence using publish-confluence.';
  
  // Add elements to the DOM
  app.appendChild(header);
  app.appendChild(message);
});`,
        'utf8'
      );
      
      // Create styles.css
      await fs.writeFile(
        path.join(srcDir, 'styles.css'),
        `body {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 20px;
}

#app {
  max-width: 800px;
  margin: 0 auto;
}

h1 {
  color: #0052CC;
}`,
        'utf8'
      );
      
      this.log.success(`Created basic JavaScript source files in ${srcDir}`);
    } catch (error) {
      this.log.error(`Failed to create basic JavaScript source files: ${(error as Error).message}`);
      throw error;
    }
  }
  async createConfigFiles(projectDir: string, projectName: string, spaceKey?: string, parentPageTitle?: string, childPages?: any[]): Promise<void> {
    try {
      // Create webpack.config.js
      await fs.writeFile(
        path.resolve(projectDir, 'webpack.config.js'),
        `const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html'
    })
  ]
};`,
        'utf8'
      );
      
      this.log.success('Created webpack.config.js');
    } catch (error) {
      this.log.error(`Failed to create webpack.config.js: ${(error as Error).message}`);
      throw error;
    }
  }
}