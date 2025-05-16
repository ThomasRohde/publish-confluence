#!/usr/bin/env node
/**
 * esbuild configuration for publish-confluence
 * This configuration builds the library and CLI as ESM modules
 */

import esbuild from 'esbuild';
import { nodeExternalsPlugin } from 'esbuild-node-externals';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// External packages (dependencies from package.json)
const external = [
  // External dependencies
  'axios',
  'chalk',
  'commander',
  'dotenv',
  'form-data',
  'globby',
  'handlebars',
  'rehype-raw',
  'remark',
  'remark-gfm',
  'remark-parse',
  'remark-rehype', 
  'unified',
  'unist-util-visit',
  'xmldom',
  'zod',
  
  // Node.js built-in modules - explicitly list all used modules
  'path',
  'fs',
  'fs/promises',
  'url',
  'readline',
  'util',
  'process',
  'os',
  'events',
  'stream',
  'buffer',
  
  // Additional Node.js built-ins
  'node:*',
];

// Common esbuild config
const commonConfig = {
  platform: 'node',
  target: 'node20',
  format: 'esm',
  bundle: true,
  minify: false,
  sourcemap: true,
  external,
  plugins: [
    nodeExternalsPlugin(),
  ]
};

// Build all outputs
async function buildAll() {
  try {
    // Ensure output directory exists
    await fs.mkdir(path.resolve(__dirname, 'dist'), { recursive: true });
      // Build library (index.ts)
    await esbuild.build({
      ...commonConfig,
      entryPoints: [path.resolve(__dirname, 'src/index.ts')],
      outfile: path.resolve(__dirname, 'dist/publish-confluence.es.js'),
    });
    
    console.log('Library built successfully!');
    
    return { library: true };
  } catch (error) {
    console.error('Error building library or CLI:', error);
    process.exit(1);
  }
}

// Execute the build if this file is run directly
if (import.meta.url === `file://${__filename}`) {
  buildAll();
}

export default buildAll;
