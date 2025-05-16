#!/usr/bin/env node
/**
 * Generate TypeScript declaration files
 * This script runs the TypeScript compiler to generate d.ts files
 */

import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to output directories
const typesDir = path.resolve(__dirname, 'dist/types');

async function generateTypes() {
  try {
    // Create temporary tsconfig for declaration generation
    const tempTsConfig = {
      extends: './tsconfig.json',
      compilerOptions: {
        declaration: true,
        emitDeclarationOnly: true,
        outDir: 'dist/types',
      },
      exclude: ['src/cli.ts', 'node_modules', 'dist'],
    };

    // Write temporary tsconfig
    const tempTsConfigPath = path.resolve(__dirname, 'tsconfig.types.json');
    await fs.writeFile(
      tempTsConfigPath,
      JSON.stringify(tempTsConfig, null, 2)
    );

    // Run TypeScript compiler to generate declarations
    await new Promise((resolve, reject) => {
      exec('npx tsc -p tsconfig.types.json', (error, stdout, stderr) => {
        if (error) {
          console.error('Error generating type declarations:', stderr);
          reject(error);
          return;
        }
        console.log('Type declarations generated successfully!');
        resolve(stdout);
      });
    });

    // Clean up temporary tsconfig
    await fs.unlink(tempTsConfigPath);
  } catch (error) {
    console.error('Failed to generate type declarations:', error);
    process.exit(1);
  }
}

// Execute the function if this file is run directly
if (import.meta.url === `file://${__filename}`) {
  generateTypes();
}

export { generateTypes as default };
