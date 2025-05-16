#!/usr/bin/env node
/**
 * Check that the dist/ directory contains all expected files after migration to esbuild
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Required files to check
const REQUIRED_FILES = [
  // Main library and CLI
  'dist/publish-confluence.es.js',
  'dist/publish-confluence.es.js.map',
  'dist/cli.js',
  'dist/cli.js.map',
  
  // Type definitions
  'dist/types/index.d.ts',
  'dist/types/client.d.ts',
  'dist/types/config.d.ts',
  'dist/types/errors.d.ts',
  
  // Templates
  'dist/templates/preview.hbs', 
  'dist/templates/index.html',
  
  // Template scripts
  'dist/templates/scripts/template-scripts.js',
  'dist/templates/scripts/template-scripts.js.map'
];

async function checkDist() {
  let success = true;
  const missing = [];
  
  console.log('Checking dist/ directory for required files...\n');
  
  for (const file of REQUIRED_FILES) {
    const filePath = path.resolve(__dirname, file);
    try {
      await fs.access(filePath);
      console.log(`✅ ${file}`);
    } catch (error) {
      console.error(`❌ ${file} - MISSING`);
      missing.push(file);
      success = false;
    }
  }
  
  console.log('\n');
  
  if (success) {
    console.log('✅ All required files are present in the dist/ directory');
    return true;
  } else {
    console.error(`❌ The following files are missing: ${missing.join(', ')}`);
    return false;
  }
}

// Execute the check
const result = await checkDist();
process.exit(result ? 0 : 1);
