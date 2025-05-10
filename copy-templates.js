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

async function copyTemplateFiles() {
  try {
    // Check if source directory exists
    try {
      await fs.access(srcTemplatesDir);
    } catch (error) {
      console.error(`Source templates directory not found: ${srcTemplatesDir}`);
      process.exit(1);
    }

    // Ensure destination directory exists
    await fs.mkdir(distTemplatesDir, { recursive: true });
    
    // Get template files
    let files;
    try {
      files = await fs.readdir(srcTemplatesDir);
    } catch (error) {
      console.error(`Failed to read source templates directory: ${error.message}`);
      process.exit(1);
    }
    
    if (files.length === 0) {
      console.warn(`No template files found in ${srcTemplatesDir}`);
    }
    
    let copySuccess = true;
    for (const file of files) {
      const srcFilePath = path.join(srcTemplatesDir, file);
      const destFilePath = path.join(distTemplatesDir, file);
      
      // Check if it's a file
      try {
        const stats = await fs.stat(srcFilePath);
        if (stats.isFile()) {
          // Copy the file
          try {
            await fs.copyFile(srcFilePath, destFilePath);
            console.log(`Copied template file: ${file}`);
          } catch (error) {
            console.error(`Failed to copy file ${file}: ${error.message}`);
            copySuccess = false;
          }
        }
      } catch (error) {
        console.error(`Failed to check file stats for ${file}: ${error.message}`);
        copySuccess = false;
      }
    }
    
    if (copySuccess) {
      console.log('All template files copied successfully!');
    } else {
      console.warn('Some template files could not be copied. Check the logs for details.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error copying template files:', error);
    process.exit(1);
  }
}

// Execute the function
copyTemplateFiles();
