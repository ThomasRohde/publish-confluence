// src/project-templates/data-visualization-project.ts
import fs from 'fs/promises';
import path from 'path';
import { Logger, ProjectTemplate } from './project-template-interface';

/**
 * Data Visualization project template implementation
 */
export class DataVisualizationProject implements ProjectTemplate {
  constructor(private log: Logger) {}

  getName(): string {
    return 'Data Visualization Dashboard';
  }

  getDescription(): string {
    return 'CSV files';
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
      '**/*.csv'
    ];
  }

  getPackageJsonTemplate(projectName: string): any {
    return {
      name: projectName,
      version: "1.0.0",
      description: "A data visualization dashboard for Confluence using publish-confluence",
      main: "src/index.js",
      scripts: {
        "dev": "vite",
        "build": "vite build",
        "preview": "vite preview",
        "publish": "npm run build ; publish-confluence"
      },
      dependencies: {
        "chart.js": "^4.4.0",
        "date-fns": "^2.30.0"
      },
      devDependencies: {
        "vite": "^4.5.0",
        "terser": "^5.39.0",
        "publish-confluence": "file:../../"
      }
    };
  }

  getPageTemplate(): string {
    return `<h1>{{pageTitle}} - Dashboard</h1>

<div class="dashboard-introduction">
  <p>This interactive dashboard provides data visualization and analytics.</p>
  <div class="aui-message aui-message-info">
    <p class="title">
      <span class="aui-icon icon-info"></span>
      <strong>Last updated:</strong> {{currentDate}}
    </p>
    <p>Dashboard data is refreshed daily.</p>
  </div>
</div>

<div class="dashboard-container">
  {{{macro}}}
</div>

<h3>How to use this dashboard</h3>
<ol>
  <li>Use the controls to select your desired filters</li>
  <li>Hover over chart elements to see detailed information</li>
  <li>Click on segments in the charts to filter the data</li>
</ol>

<hr/>
<p><em>For support, please contact the development team.</em></p>`;
  }

  getMacroTemplate(): string {
    return `<div class="dashboard-app">
  <div id="dashboard-root">
    <div class="loading-indicator">Loading dashboard...</div>
  </div>
  {{{styles}}}
  {{{scripts}}}
</div>`;
  }

  async createSourceFiles(srcDir: string, projectName: string): Promise<void> {
    try {
      // Create source directory and required subdirectories
      await fs.mkdir(path.join(srcDir, 'components'), { recursive: true });
      await fs.mkdir(path.join(srcDir, 'data'), { recursive: true });
      
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
  <div id="dashboard-root"></div>
</body>
</html>`,
        'utf8'
      );
      
      // Create index.js
      await fs.writeFile(
        path.join(srcDir, 'index.js'),
        `import './styles.css';
import { createChart } from './components/chart.js';
import { loadData } from './data/dataLoader.js';

document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('dashboard-root');
  
  // Create dashboard layout
  const header = document.createElement('div');
  header.className = 'dashboard-header';
  header.innerHTML = '<h2>Interactive Dashboard</h2>';
  
  const controls = document.createElement('div');
  controls.className = 'dashboard-controls';
  controls.innerHTML = '<div class="control-group"><label>Date Range: </label><select><option>Last 7 days</option><option>Last 30 days</option><option>Last 90 days</option></select></div>';
  
  const chartContainer = document.createElement('div');
  chartContainer.className = 'chart-container';
  
  // Add elements to DOM
  root.appendChild(header);
  root.appendChild(controls);
  root.appendChild(chartContainer);
  
  try {
    // Show loading state
    chartContainer.innerHTML = '<div class="loading">Loading data...</div>';
    
    // Load data and create chart
    const data = await loadData();
    chartContainer.innerHTML = ''; // Clear loading message
    createChart(chartContainer, data);
  } catch (error) {
    chartContainer.innerHTML = '<div class="error">Error loading dashboard data.</div>';
    console.error('Dashboard error:', error);
  }
});`,
        'utf8'
      );
      
      // Create chart.js component
      await fs.writeFile(
        path.join(srcDir, 'components', 'chart.js'),
        `import Chart from 'chart.js/auto';

export function createChart(container, data) {
  // Create canvas element for the chart
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  
  // Create the chart
  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [{
        label: 'Sample Data',
        data: data.values,
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgb(54, 162, 235)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Sample Dashboard Data'
        },
        tooltip: {
          mode: 'index',
          intersect: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}`,
        'utf8'
      );
      
      // Create dataLoader.js
      await fs.writeFile(
        path.join(srcDir, 'data', 'dataLoader.js'),
        `// Mock data loading function
// In a real application, this would fetch from an API
export async function loadData() {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  return {
    labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
    values: [65, 59, 80, 81, 56, 55, 72]
  };
}`,
        'utf8'
      );
      
      // Create styles.css
      await fs.writeFile(
        path.join(srcDir, 'styles.css'),
        `body {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 0;
}

#dashboard-root {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.dashboard-header {
  margin-bottom: 20px;
}

.dashboard-controls {
  background-color: #f4f5f7;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

select {
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #ccc;
}

.chart-container {
  height: 400px;
  background-color: white;
  padding: 20px;
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #6B778C;
}

.error {
  color: #DE350B;
  text-align: center;
  padding: 20px;
}`,
        'utf8'
      );
      
      this.log.success(`Created data visualization source files in ${srcDir}`);
    } catch (error) {
      this.log.error(`Failed to create data visualization source files: ${(error as Error).message}`);
      throw error;
    }
  }
  async createConfigFiles(projectDir: string, projectName: string, spaceKey?: string, parentPageTitle?: string, childPages?: any[]): Promise<void> {
    try {
      // Create vite.config.js
      await fs.writeFile(
        path.resolve(projectDir, 'vite.config.js'),
        `import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'chart': ['chart.js/auto'],
        }
      }
    },
  },
  optimizeDeps: {
    include: ['chart.js/auto']
  }
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