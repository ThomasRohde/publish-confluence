// src/project-creator.ts
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import * as readline from 'readline';
import { getProjectTemplate, Logger } from './project-templates';
import { MarkdownDocumentationProject } from './project-templates/markdown-documentation-project';
import { PROJECT_TYPE_CHOICES } from './project-templates/project-type-choices';
import { PROMPT_TEXT } from './prompt';
import { MARKDOWN_PROMPT_TEXT } from './prompt-markdown';

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
    log.info('\nAvailable project types:');
    PROJECT_TYPE_CHOICES.forEach(type => 
      log.info(chalk.cyan(`${type.id}. ${type.name} (${type.description})`))
    );
      let projectTypeInput = await question(rl, `Select project type (1-${PROJECT_TYPE_CHOICES.length})`, '1');
    const projectType = parseInt(projectTypeInput) || 1;
    
    if (projectType < 1 || projectType > PROJECT_TYPE_CHOICES.length) {
      log.error(`Invalid project type selection. Using type 1 (${PROJECT_TYPE_CHOICES[0].name})`);
    }
      // Get the project template based on the selected type
    const template = getProjectTemplate(projectType, log);
    
    // Basic configuration
    if (!projectName) {
      projectName = await question(rl, 'Enter project name', path.basename(process.cwd()));
    }
      // Special handling for Documentation Projects
    let pageCount = 1;
    if (projectType === 5 || projectType === 7) { // Documentation Projects
      const pageCountInput = await question(rl, 'Enter the number of pages', '1');
      pageCount = parseInt(pageCountInput) || 1;
      if (pageCount < 1) {
        pageCount = 1;
        log.error('Invalid page count. Using 1 page.');
      }
    }
      const pageTitle = await question(rl, 'Enter the page title', projectName);
    const spaceKey = await question(rl, 'Enter the Confluence space key', 'MYSPACE');
    
    // Ask for parent page title (always needed regardless of project type)
    const parentPageTitle = await question(rl, 'Enter the parent page title (optional)', '');
      const distDir = await question(rl, 'Enter the distribution directory', './dist');      // Advanced configuration
    log.info(chalk.blue('\nAdvanced configuration (press Enter to use defaults):'));
    // Default template path - use .md for Markdown project, .html for others
    const defaultTemplatePath = projectType === 7 ? './confluence-template.md' : './confluence-template.html';
    const templatePath = await question(rl, 'Path to the page template', defaultTemplatePath);
      // Only ask for macro template path if not a documentation project (types 5 and 7)
    let macroTemplatePath = null;
    if (projectType !== 5 && projectType !== 7) {
      macroTemplatePath = await question(rl, 'Path to the macro template', './macro-template.html');
    }
      const createDotEnv = (await question(rl, 'Create .env file for authentication? (y/n)', 'y')).toLowerCase() === 'y';
    const createPromptFile = (await question(rl, 'Create prompt file for LLM template generation? (y/n)', 'y')).toLowerCase() === 'y';
    
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
      // For Documentation Projects with multiple pages, set up child pages
    if ((projectType === 5 || projectType === 7) && pageCount > 1) {
      // Create child page configurations
      const childPages = [];
      for (let i = 1; i < pageCount; i++) {
        // Use .md extension for Markdown Documentation Project, otherwise use .html
        const fileExtension = projectType === 7 ? '.md' : '.html';
        childPages.push({
          pageTitle: `Page ${i}`,
          templatePath: `./child-pages/page-${i}${fileExtension}`,
          macroTemplatePath: null
        });
      }
      
      // Add child pages to config
      config.childPages = childPages;
    }
    
    // Create config file
    const configPath = path.resolve(process.cwd(), 'publish-confluence.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
    log.success(`Created publish-confluence.json`);
      // Always create template files
    await fs.writeFile(path.resolve(process.cwd(), templatePath), template.getPageTemplate(), 'utf8');
      // For Documentation Projects with multiple pages, create child page structure
    if ((projectType === 5 || projectType === 7) && pageCount > 1) {
      // Create child pages directory
      const childPagesDir = path.join(process.cwd(), 'child-pages');
      await fs.mkdir(childPagesDir, { recursive: true });
      
      // For Markdown Documentation Project (type 7), use the template's method to create child pages
      if (projectType === 7) {
        const markdownTemplate = template as MarkdownDocumentationProject;
        for (let i = 1; i < pageCount; i++) {
          await markdownTemplate.createChildPageTemplate(childPagesDir, i);
        }
      } 
      // For regular Documentation Project (type 5), create HTML templates
      else {
        // Create template files for each child page
        for (let i = 1; i < pageCount; i++) {
          const childTemplate = `<h1>Page ${i}</h1>

<p>Add your content for child page ${i} here.</p>

{{#confluence-info title="Child Page ${i}"}}
<p>This is a child page in your documentation structure.</p>
{{/confluence-info}}

<hr/>
<p><em>Last updated: {{currentDate}}</em></p>`;

          await fs.writeFile(
            path.join(childPagesDir, `page-${i}.html`),
            childTemplate,
            'utf8'
          );
        }
      }
      
      log.success(`Created ${pageCount - 1} child page templates in 'child-pages' directory`);
    }
    
    // Create macro template if needed (not for Documentation Projects)
    if (projectType !== 5 && projectType !== 7 && template.getMacroTemplate()) {
      await fs.writeFile(path.resolve(process.cwd(), macroTemplatePath as string), template.getMacroTemplate(), 'utf8');
      log.success(`Created template files: ${templatePath}, ${macroTemplatePath}`);
    } else {
      log.success(`Created template file: ${templatePath}`);
    }
    
    // Create .env file if requested
    if (createDotEnv) {
      const envContent = `# Confluence API credentials
# Replace placeholder values with your actual credentials
CONFLUENCE_BASE_URL=https://your-confluence-instance.atlassian.net
CONFLUENCE_TOKEN=your-api-token`;

      await fs.writeFile(path.resolve(process.cwd(), '.env'), envContent, 'utf8');
      log.success(`Created .env file with placeholder credentials`);
    }    // Create prompt file for LLM template generation if requested
    if (createPromptFile) {
      const promptFilePath = path.resolve(process.cwd(), 'template-prompt.md');
      await fs.writeFile(promptFilePath, PROMPT_TEXT, 'utf8');
      log.success(`Created template-prompt.md for generating templates with AI`);

      // Also create a Markdown-specific prompt file
      const markdownPromptFilePath = path.resolve(process.cwd(), 'markdown-template-prompt.md');
      await fs.writeFile(markdownPromptFilePath, MARKDOWN_PROMPT_TEXT, 'utf8');
      log.success(`Created markdown-template-prompt.md for generating Markdown templates with AI`);
    }// Update package.json or create one if it doesn't exist (skip for documentation projects)
    if (projectType !== 5 && projectType !== 7) { // Skip for Documentation Projects
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
      }    } else {
      log.verbose('Skipping package.json creation for Documentation Project');
    }
    
    // Create source directory structure and files using the template
    const srcDir = path.resolve(process.cwd(), 'src');
    await template.createSourceFiles(srcDir, projectName);
    
    // Create additional configuration files
    // Pass child pages to createConfigFiles if they exist
    await template.createConfigFiles(process.cwd(), projectName, spaceKey, parentPageTitle, config.childPages || []);
    
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