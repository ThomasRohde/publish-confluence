// src/project-creator.ts
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import * as readline from 'readline';
import { getProjectTemplate, Logger } from './project-templates';
import { PROJECT_TYPE_CHOICES } from './project-templates/project-type-choices';

/**
 * Create a readline interface for interactive prompts
 */
function createPrompt(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Promisify the question method for async/await usage
 */
async function question(rl: readline.Interface, query: string, defaultValue?: string): Promise<string> {
  const fullQuery = defaultValue 
    ? `${query} (${defaultValue}): ` 
    : `${query}: `;
    
  const answer = await new Promise<string>(resolve => {
    rl.question(fullQuery, resolve);
  });
  
  return answer.trim() || defaultValue || '';
}

/**
 * Create a new publish-confluence project interactively
 * @param log Logger instance for output
 */
export async function createProject(log: Logger): Promise<void> {
  const rl = createPrompt();

  try {
    log.info('Creating a new publish-confluence project...');
    
    // Check if package.json exists to determine if we're in a project
    let packageJson: any = {};
    let projectName = '';
    
    try {
      const packageJsonPath = path.resolve(process.cwd(), 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
      packageJson = JSON.parse(packageJsonContent);
      projectName = packageJson.name || '';
      log.verbose('Found existing package.json');
    } catch (error) {
      log.verbose('No package.json found, will create one');
    }
    
    // Project type selection
    console.log('\nAvailable project types:');
    PROJECT_TYPE_CHOICES.forEach(type => 
      console.log(chalk.cyan(`${type.id}. ${type.name} (${type.description})`))
    );
    
    let projectTypeInput = await question(rl, 'Select project type (1-4)', '1');
    const projectType = parseInt(projectTypeInput) || 1;
    
    if (projectType < 1 || projectType > 4) {
      log.error(`Invalid project type selection. Using type 1 (${PROJECT_TYPE_CHOICES[0].name})`);
    }
    
    // Get the project template based on the selected type
    const template = getProjectTemplate(projectType, log);
    
    // Basic configuration
    if (!projectName) {
      projectName = await question(rl, 'Enter project name', path.basename(process.cwd()));
    }
    
    const pageTitle = await question(rl, 'Enter the page title', projectName);
    const spaceKey = await question(rl, 'Enter the Confluence space key', 'MYSPACE');
    const parentPageTitle = await question(rl, 'Enter the parent page title (optional)', '');
    const distDir = await question(rl, 'Enter the distribution directory', './dist');
    
    // Advanced configuration
    console.log(chalk.blue('\nAdvanced configuration (press Enter to use defaults):'));
    const templatePath = await question(rl, 'Path to the page template', './confluence-template.html');
    const macroTemplatePath = await question(rl, 'Path to the macro template', './macro-template.html');
    
    const createDotEnv = (await question(rl, 'Create .env file for authentication? (y/n)', 'y')).toLowerCase() === 'y';
    const createTemplates = (await question(rl, 'Create template files? (y/n)', 'y')).toLowerCase() === 'y';
    
    // Create publish-confluence.json
    const config: any = {
      spaceKey,
      pageTitle,
      ...(parentPageTitle && { parentPageTitle }),
      distDir,
      templatePath,
      macroTemplatePath,
      includedFiles: template.getIncludedFiles(),
      excludedFiles: ['**/*.map'],
    };
    
    // Create config file
    const configPath = path.resolve(process.cwd(), 'publish-confluence.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
    log.success(`Created publish-confluence.json`);
    
    // Create template files if requested
    if (createTemplates) {
      await fs.writeFile(path.resolve(process.cwd(), templatePath), template.getPageTemplate(), 'utf8');
      await fs.writeFile(path.resolve(process.cwd(), macroTemplatePath), template.getMacroTemplate(), 'utf8');
      
      log.success(`Created template files: ${templatePath}, ${macroTemplatePath}`);
    }
    
    // Create .env file if requested
    if (createDotEnv) {
      const envContent = `# Confluence API credentials
# Replace placeholder values with your actual credentials
CONFLUENCE_BASE_URL=https://your-confluence-instance.atlassian.net
CONFLUENCE_TOKEN=your-api-token`;

      await fs.writeFile(path.resolve(process.cwd(), '.env'), envContent, 'utf8');
      log.success(`Created .env file with placeholder credentials`);
    }
    
    // Update package.json or create one if it doesn't exist
    if (!Object.keys(packageJson).length) {
      // Create a new package.json using the template
      const packageJsonTemplate = template.getPackageJsonTemplate(projectName);
      
      await fs.writeFile(
        path.resolve(process.cwd(), 'package.json'),
        JSON.stringify(packageJsonTemplate, null, 2),
        'utf8'
      );
      
      log.success(`Created package.json`);
    } else {
      // Update existing package.json
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }
      
      // Add publish script if it doesn't exist
      if (!packageJson.scripts.publish) {
        packageJson.scripts.publish = "npm run build ; publish-confluence";
        
        await fs.writeFile(
          path.resolve(process.cwd(), 'package.json'),
          JSON.stringify(packageJson, null, 2),
          'utf8'
        );
        
        log.success(`Updated package.json with publish script`);
      }
    }
    
    // Create source directory structure and files using the template
    const srcDir = path.resolve(process.cwd(), 'src');
    await template.createSourceFiles(srcDir, projectName);
    
    // Create additional configuration files
    await template.createConfigFiles(process.cwd(), projectName);
    
    log.success(`\nProject created successfully!`);
    log.info(`\nNext steps:
1. Edit the .env file with your Confluence credentials
2. Install dependencies: npm install
3. Build your project: npm run build
4. Publish to Confluence: npm run publish`);
    
  } catch (error) {
    log.error(`Failed to create project: ${(error as Error).message}`);
  } finally {
    rl.close();
  }
}