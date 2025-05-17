// src/project-templates/project-type-choices.ts
/**
 * Project type choice with description
 */
export interface ProjectTypeChoice {
  id: number;
  name: string;
  description: string;
}

/**
 * List of available project types with descriptions
 */
export const PROJECT_TYPE_CHOICES: ProjectTypeChoice[] = [
  {
    id: 1,
    name: 'Basic JavaScript Application',
    description: 'Vanilla JS, minimal dependencies'
  },
  {
    id: 2,
    name: 'React Application',
    description: 'Modern component-based UI with React'
  },
  {
    id: 3,
    name: 'Data Visualization Dashboard',
    description: 'CSV files'
  },
  {
    id: 4,
    name: 'TypeScript Application',
    description: 'Static typing, enhanced developer experience'
  },
  {
    id: 5,
    name: 'Documentation Project',
    description: 'Pure documentation pages (no JavaScript)'
  },  {
    id: 6,
    name: 'Confluence Embeddable Application Scaffold',
    description: 'TypeScript application that can be embedded in Confluence as an HTML macro'
  },
  {
    id: 7,
    name: 'Markdown Documentation Project',
    description: 'Pure documentation pages using Markdown format'
  }
];