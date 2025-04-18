// src/project-templates/project-template-interface.ts
/**
 * Logger interface for consistent logging across project templates
 */
export interface Logger {
  error: (message: string) => void;
  info: (message: string) => void;
  success: (message: string) => void;
  verbose: (message: string) => void;
  debug: (message: string) => void;
}

/**
 * Base interface for all project templates
 */
export interface ProjectTemplate {
  /**
   * Get the name of the project type
   */
  getName(): string;

  /**
   * Get the description of the project type
   */
  getDescription(): string;
  
  /**
   * Get the file patterns that should be included in the distribution
   */
  getIncludedFiles(): string[];
  
  /**
   * Get the default package.json template
   * @param projectName The name of the project
   */
  getPackageJsonTemplate(projectName: string): any;
  
  /**
   * Get the default page template for Confluence
   */
  getPageTemplate(): string;
  
  /**
   * Get the default macro template for Confluence
   */
  getMacroTemplate(): string;
  
  /**
   * Create the source files for the project
   * @param srcDir The directory where source files should be created
   * @param projectName The name of the project
   */
  createSourceFiles(srcDir: string, projectName: string): Promise<void>;
  
  /**
   * Create additional configuration files
   * @param projectDir The root directory of the project
   * @param projectName The name of the project
   */
  createConfigFiles(projectDir: string, projectName: string): Promise<void>;
}