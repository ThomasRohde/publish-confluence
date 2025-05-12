#!/usr/bin/env node
/**
 * This script copies template files from src/templates to dist/templates
 * It's a workaround for the Vite plugin that doesn't seem to be working
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to source and destination directories
const srcTemplatesDir = path.resolve(__dirname, 'src/templates');
const distTemplatesDir = path.resolve(__dirname, 'dist/templates');

// Recursively copy a directory (including subdirectories and files)
async function copyDir(srcDir, destDir) {
  await fs.mkdir(destDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
      console.log(`Copied template file: ${destPath}`);
    }
  }
}

async function copyTemplateFiles() {
  try {
    // Check if source directory exists
    try {
      await fs.access(srcTemplatesDir);
    } catch (error) {
      console.error(`Source templates directory not found: ${srcTemplatesDir}`);
      process.exit(1);
    }

    // Recursively copy all templates and partials
    await copyDir(srcTemplatesDir, distTemplatesDir);
    console.log('All template files (including partials) copied successfully!');
  } catch (error) {
    console.error('Error copying template files:', error);
    process.exit(1);
  }
}

// Execute the function
copyTemplateFiles();
