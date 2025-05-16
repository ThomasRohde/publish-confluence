#!/usr/bin/env node
/**
 * This script processes CLI files to prevent double shebang
 * and properly builds the CLI with esbuild
 */

import esbuild from 'esbuild';
import { nodeExternalsPlugin } from 'esbuild-node-externals';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Common esbuild config (similar to esbuild.config.js)
const commonConfig = {
  platform: 'node',
  target: 'node20',
  format: 'esm',
  bundle: true,
  minify: false,
  sourcemap: true,
  external: [
    // External dependencies
    'axios',
    'chalk',
    'commander',
    'dotenv',
    'form-data',
    'globby',
    'handlebars',
    'xmldom',
    'zod',
    
    // Node.js built-in modules
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
    'node:*',
  ],
  plugins: [
    nodeExternalsPlugin(),
  ]
};

async function processCli() {
  try {
    // Read the CLI file content
    const cliPath = path.resolve(__dirname, 'src/cli.ts');
    const cliContent = await fs.readFile(cliPath, 'utf8');
    
    // Check if file already has shebang
    const hasShebang = cliContent.trim().startsWith('#!/usr/bin/env node');
    
    // Create a temp file with processed content (either remove shebang or use as-is)
    const tempCliPath = path.resolve(__dirname, 'src/cli.temp.ts');
    
    if (hasShebang) {
      // Remove shebang line to prevent duplication
      const processedContent = cliContent.replace('#!/usr/bin/env node', '').trimStart();
      await fs.writeFile(tempCliPath, processedContent);
      console.log('Created temporary CLI file without shebang');
    } else {
      // Just copy the file as is
      await fs.writeFile(tempCliPath, cliContent);
      console.log('Created temporary CLI file (no shebang found)');
    }
    
    // Ensure dist directory exists
    await fs.mkdir(path.resolve(__dirname, 'dist'), { recursive: true });
    
    // Build CLI with banner for shebang
    await esbuild.build({
      ...commonConfig,
      entryPoints: [tempCliPath],
      outfile: path.resolve(__dirname, 'dist/cli.js'),
      banner: {
        js: '#!/usr/bin/env node\n\n',
      },
    });
    
    // Make CLI executable (for Unix systems)
    const outputCliPath = path.resolve(__dirname, 'dist/cli.js');
    const stats = await fs.stat(outputCliPath);
    await fs.chmod(outputCliPath, stats.mode | 0o111); // Add executable permissions
    
    // Clean up temp file
    await fs.unlink(tempCliPath);
    
    console.log('CLI built successfully with proper shebang!');
    return true;
  } catch (error) {
    console.error('Error processing CLI:', error);
    return false;
  }
}

// Execute if run directly
if (import.meta.url === `file://${__filename}`) {
  processCli();
}

export { processCli as default };
