// src/prompt-generator.ts
import fs from 'fs/promises';
import Handlebars from 'handlebars';
import path from 'path';
import { Interface as ReadlineInterface } from 'readline';

/**
 * Logger interface for prompt generation
 */
interface Logger {
  error: (message: string) => void;
  info: (message: string) => void;
  success: (message: string) => void;
  verbose: (message: string) => void;
  debug: (message: string) => void;
}

/**
 * Options for prompt generation
 */
interface PromptGeneratorOptions {
  file?: string;
  verbose?: boolean;
  debug?: boolean;
}

/**
 * Default prompt template for generating Confluence-compatible project instructions
 */
const DEFAULT_PROMPT_TEMPLATE = `# Instructions for Creating Confluence-Compatible Projects

You are assisting with creating a project that will be published to Confluence using embedded HTML macros. Follow these guidelines to ensure the project will work properly when embedded in Confluence pages.

## Project Idea: {{idea}}

## CRITICAL REQUIREMENTS

### Browser-Only Execution - STRICTLY REQUIRED
- The application MUST run entirely in the browser
- DO NOT include ANY server-side or Node.js code whatsoever
- DO NOT use any Node.js modules, APIs, or dependencies (fs, path, process, etc.)
- DO NOT use any code that assumes a Node.js runtime environment

### Content Security Restrictions
- The app will run inside a restricted HTML macro environment
- No server communications except for standard fetch/XHR to CORS-enabled endpoints
- No file system access is available

### Bundling - STRICTLY REQUIRED
- All JavaScript MUST be bundled into a single file
- CSS should be bundled into a single file
- This ensures the entire application can be easily embedded in Confluence
- Configure build tools to disable code-splitting and ensure one unified bundle

## Project Requirements

When scaffolding or building a Confluence-compatible project, prioritize:

1. **Pure client-side architecture** - Everything must execute in the browser sandbox
2. **Lightweight bundle size** - Optimize assets for quick loading within Confluence's environment
3. **Self-contained functionality** - The app should operate completely within its embedded context
4. **Responsive design** - Adapt to various Confluence page layouts and widths
5. **Non-conflicting styles/scripts** - Avoid code that might interfere with Confluence's existing elements

## Appropriate Browser APIs
- Use standard Web APIs (DOM, fetch, localStorage, etc.)
- Use browser-compatible ES modules
- For data persistence, use localStorage/sessionStorage or Confluence's Storage API
- For data visualization, use browser-compatible libraries (Chart.js, D3.js)

## Recommended Tech Stack

### Frameworks (choose one)
- React (recommended for component-based UIs)
- Preact (smaller React alternative)
- Alpine.js (for simpler interactions)
- TypeScript (recommended for type safety and better development experience)
- Vanilla JavaScript (for maximum performance in basic applications)

### Styling (choose one)
- Tailwind CSS (recommended for utility-first approach with minimal footprint)
- CSS Modules (for component-scoped styling)
- Plain CSS (with proper namespacing)

### CSS Considerations
- All CSS must be properly scoped with a unique class (e.g., .api-slicer-app) to prevent style conflicts with Confluence
- Keep styles minimal and focused on functional aspects only
- Set max-width to 100% to ensure proper display within the Confluence macro container

### Build System (choose one)
- Vite (recommended for modern, fast builds)
- Webpack (well-supported alternative)
- Rollup (for optimized bundles)
- Always bundle, even for vanilla Javascript projects

## Final Check
- Verify all code can run in a browser-only context
- Ensure no Node.js dependencies are included
- Confirm the application doesn't attempt to access unavailable APIs`;

/**
 * Generate a project prompt for LLM assistance
 * @param rl Readline interface for user input
 * @param options Options for prompt generation
 * @param log Logger interface
 * @returns The generated prompt text
 */
export async function generatePrompt(
  rl: ReadlineInterface,
  options: PromptGeneratorOptions,
  log: Logger
): Promise<string> {
  log.info('Generating a Confluence-compatible project prompt...');
  
  let idea = '';
  
  // If a file path is provided, read the content from the file
  if (options.file) {
    try {
      idea = await fs.readFile(path.resolve(process.cwd(), options.file), 'utf8');
      log.verbose(`Read project idea from file: ${options.file}`);
    } catch (error) {
      throw new Error(`Failed to read file ${options.file}: ${(error as Error).message}`);
    }
  } else {
    // Ask the user for their project idea
    idea = await question(rl, 'What is your project idea? (e.g., "An interactive survey tool", "A data dashboard", etc.)', '');
  }
  
  if (!idea) {
    throw new Error('Project idea is required. Please provide a description of your project.');
  }
  
  // Compile the template with Handlebars
  const compileTemplate = Handlebars.compile(DEFAULT_PROMPT_TEMPLATE);
  const generatedPrompt = compileTemplate({ idea });
  
  return generatedPrompt;
}

/**
 * Promisify the question method for async/await usage
 */
async function question(rl: ReadlineInterface, query: string, defaultValue?: string): Promise<string> {
  const fullQuery = defaultValue 
    ? `${query} (${defaultValue}): ` 
    : `${query}: `;
    
  const answer = await new Promise<string>(resolve => {
    rl.question(fullQuery, resolve);
  });
  
  return answer.trim() || defaultValue || '';
}