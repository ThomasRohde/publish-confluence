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
    name: 'React/Preact Application',
    description: 'Modern component-based UI'
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
  }
];