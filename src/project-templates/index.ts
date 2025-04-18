// src/project-templates/index.ts
import { BasicJsProject } from './basic-js-project';
import { DataVisualizationProject } from './data-visualization-project';
import { Logger, ProjectTemplate } from './project-template-interface';
import { ReactPreactProject } from './react-preact-project';
import { TypeScriptProject } from './typescript-project';

/**
 * Get a project template instance by project type
 * @param projectType The numeric project type (1-4)
 * @param logger The logger instance
 * @returns A project template instance for the specified type
 */
export function getProjectTemplate(projectType: number, logger: Logger): ProjectTemplate {
  switch (projectType) {
    case 1:
      return new BasicJsProject(logger);
    case 2:
      return new ReactPreactProject(logger);
    case 3:
      return new DataVisualizationProject(logger);
    case 4:
      return new TypeScriptProject(logger);
    default:
      // Default to basic JavaScript project
      return new BasicJsProject(logger);
  }
}

export { Logger, ProjectTemplate } from './project-template-interface';
export { ProjectTypeChoice } from './project-type-choices';
