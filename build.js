#!/usr/bin/env node
/**
 * Unified build script for publish-confluence
 * This script orchestrates the entire build process:
 * 1. Type checking with TypeScript
 * 2. Building the library and CLI with esbuild
 * 3. Building template scripts with esbuild
 * 4. Copying templates to output directory
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import processCli from './build-cli.js';
import buildAll from './esbuild.config.js';
import generateTypes from './generate-types.js';

const execAsync = promisify(exec);

async function runCommand(command, description) {
  console.log(`\n📋 ${description}...`);
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    console.log(`✅ ${description} completed successfully`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    return false;
  }
}

async function build() {
  try {
    // Step 1: Run TypeScript type checking (without emitting files)
    const typeCheck = await runCommand(
      'npx tsc --noEmit',
      'TypeScript type checking'
    );
    
    if (!typeCheck) {
      console.error('❌ TypeScript type checking failed, stopping build');
      process.exit(1);
    }
      // Step 2: Build library and CLI with esbuild
    console.log('\n📋 Building library with esbuild...');
    await buildAll();
    
    // Step 2b: Build CLI with proper shebang
    console.log('\n📋 Building CLI with proper shebang...');
    const cliResult = await processCli();
    
    if (!cliResult) {
      console.error('❌ CLI build failed, stopping build');
      process.exit(1);
    }
    
    // Step 3: Build template scripts
    const templateScripts = await runCommand(
      'node bundle-template-scripts.js',
      'Building template scripts'
    );
    
    if (!templateScripts) {
      console.error('❌ Template scripts build failed, stopping build');
      process.exit(1);
    }
      // Step 4: Copy templates
    const copyTemplates = await runCommand(
      'node copy-templates.js',
      'Copying templates'
    );
    
    if (!copyTemplates) {
      console.error('❌ Template copying failed, stopping build');
      process.exit(1);
    }
    
    // Step 5: Generate TypeScript declaration files
    console.log('\n📋 Generating TypeScript declaration files...');
    try {
      await generateTypes();
      console.log('✅ TypeScript declaration files generated successfully');
    } catch (error) {
      console.error('❌ TypeScript declaration files generation failed:', error);
      process.exit(1);
    }
    
    console.log('\n✨ Build completed successfully! ✨');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Execute the build
build();
