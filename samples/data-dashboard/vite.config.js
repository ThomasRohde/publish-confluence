import preact from '@preact/preset-vite';
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    preact()
  ],
  // Specify the entry point file
  root: 'src',
  build: {
    outDir: '../dist',
    assetsDir: 'assets',
    sourcemap: false,
    // Generate hashed filenames for better caching
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Optimize for smaller bundle size
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    },
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json']
  },
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    jsxInject: `import { h, Fragment } from 'preact'`,
    jsx: 'automatic',
    jsxImportSource: 'preact'
  },
  optimizeDeps: {
    include: ['preact', 'preact/hooks', 'chart.js', 'date-fns']
  },
  // Ensure compatibility with Confluence's environment
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
  }
});