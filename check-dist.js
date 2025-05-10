#!/usr/bin/env node
/**
 * This script checks the directory structure of dist and lists all files
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function listFilesRecursively(dir, level = 0) {
  try {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      const filePath = path.join(dir, item.name);
      
      // Print with indentation based on level
      console.log(`${' '.repeat(level * 2)}${item.name}${item.isDirectory() ? '/' : ''}`);
      
      // Recursively list files in subdirectories
      if (item.isDirectory()) {
        await listFilesRecursively(filePath, level + 1);
      }
    }
  } catch (error) {
    console.error(`Error listing files in ${dir}:`, error);
  }
}

async function main() {
  const distDir = path.resolve(__dirname, 'dist');
  
  try {
    console.log(`Checking dist directory structure at: ${distDir}`);
    await listFilesRecursively(distDir);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
