import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

/**
 * Vite configuration for publish-confluence
 * This configuration builds the library and CLI as ESM modules
 * and properly handles Node.js built-in modules
 */
export default defineConfig({
  build: {
    lib: {
      entry: {
        'publish-confluence': resolve(__dirname, 'src/index.ts'),
        'cli': resolve(__dirname, 'src/cli.ts')
      },
      formats: ['es']
    },
    rollupOptions: {
      external: [
        // External dependencies
        'axios',
        'chalk',
        'commander',
        'dotenv',        'form-data',
        'globby',
        'handlebars',
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
        
        // Regex pattern for other Node.js built-ins (node:*)
        /^node:/,
        /node:.*/
      ],
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'cli' ? 'cli.js' : '[name].es.js';
        }
      }
    },
    // Ensure we're targeting Node environments, not browsers
    target: 'node20',
    outDir: 'dist',
    sourcemap: true,
    emptyOutDir: true
  },
  // Tell Vite this is a Node.js application
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },  plugins: [
    dts({
      outDir: 'dist/types',
      exclude: ['src/cli.ts']
    }),    // Custom plugin to copy template files
    {
      name: 'copy-template-files',
      // Use closeBundle instead of buildEnd to ensure it runs after all files are written
      closeBundle: async () => {
        const fs = await import('fs/promises');
        const path = await import('path');
        
        // Ensure templates directory exists
        const templatesDir = resolve(__dirname, 'dist/templates');
        await fs.mkdir(templatesDir, { recursive: true });
        
        // Copy template files
        const templateFiles = [
          { src: 'src/templates/preview.hbs', dest: 'dist/templates/preview.hbs' },
          { src: 'src/templates/index.html', dest: 'dist/templates/index.html' }
        ];
        
        for (const file of templateFiles) {
          try {
            await fs.copyFile(
              path.resolve(__dirname, file.src), 
              path.resolve(__dirname, file.dest)
            );
            console.log(`Copied template file: ${file.src} to ${file.dest}`);
          } catch (error) {
            console.error(`Failed to copy template file ${file.src}:`, error);
          }
        }
      }
    }
  ],
  // Additional optimization for Node.js environments
  optimizeDeps: {
    // Exclude Node.js built-ins from optimization
    exclude: [
      'fs', 
      'path', 
      'readline', 
      'util', 
      'os', 
      'events', 
      'stream',
      'buffer'
    ]
  }
});