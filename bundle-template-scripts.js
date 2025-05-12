#!/usr/bin/env node
/**
 * This script bundles template JavaScript files for browser usage
 */

import esbuild from 'esbuild';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bundleTemplateScripts() {
  try {
    // Ensure the output directory exists
    const outputDir = path.resolve(__dirname, 'dist/templates/scripts');
    await fs.mkdir(outputDir, { recursive: true });
    
    // Input file
    const inputFile = path.resolve(__dirname, 'src/template-scripts/index.ts');
    
    // Bundle the scripts
    await esbuild.build({
      entryPoints: [inputFile],
      bundle: true,
      minify: true,
      format: 'esm',
      target: ['es2020'],
      outfile: path.resolve(outputDir, 'template-scripts.js'),
      sourcemap: true
    });
    
    console.log('Template scripts bundled successfully!');
  } catch (error) {
    console.error('Error bundling template scripts:', error);
    process.exit(1);
  }
}

// Execute the function
bundleTemplateScripts();
