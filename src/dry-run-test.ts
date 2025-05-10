#!/usr/bin/env node
// src/dry-run-test.ts - This file is for testing the dry-run preview feature

import path from 'path';
import { createDryRunClient } from './dry-run';
import { createLogger } from './logger';

const log = createLogger();

/**
 * A simple test function to demonstrate the dry-run preview generation
 */
async function testDryRunPreview() {
  // Get test directory from command line args or use default
  const args = process.argv.slice(2);
  const testDir = args[0] || path.resolve(process.cwd(), 'dry-run-test');
  
  log.info(`Starting dry-run preview test in: ${testDir}`);
  
  try {
    // Create a dry-run client with preview enabled
    const client = await createDryRunClient(testDir, { 
      previewEnabled: true 
    });
    
    // Create a test space and pages
    const spaceKey = 'TEST';
    
    // Root level page
    const rootPage = await client.createPage(
      spaceKey,
      'Test Root Page',
      '<h1>Test Root Page</h1><p>This is a test page for the dry-run preview feature.</p>'
    );
    
    // Child pages
    const childPage1 = await client.createPage(
      spaceKey,
      'Child Page 1',
      '<h1>Child Page 1</h1><p>This is a child page with various Confluence macros.</p>' +
      '<ac:structured-macro ac:name="info">' +
      '<ac:rich-text-body><p>This is an info macro</p></ac:rich-text-body>' +
      '</ac:structured-macro>',
      rootPage.id
    );
    
    const childPage2 = await client.createPage(
      spaceKey,
      'Child Page 2',
      '<h1>Child Page 2</h1><p>This is another child page with code.</p>' +
      '<ac:structured-macro ac:name="code">' +
      '<ac:parameter ac:name="language">typescript</ac:parameter>' +
      '<ac:plain-text-body><![CDATA[function test() {\n  console.log("Hello world");\n}]]></ac:plain-text-body>' +
      '</ac:structured-macro>',
      rootPage.id
    );
    
    // Create a nested page
    await client.createPage(
      spaceKey,
      'Nested Page',
      '<h1>Nested Page</h1><p>This is a nested page inside Child Page 1.</p>' +
      '<ac:structured-macro ac:name="warning">' +
      '<ac:rich-text-body><p>This is a warning macro</p></ac:rich-text-body>' +
      '</ac:structured-macro>',
      childPage1.id
    );
    
    // Generate the preview
    const previewPath = await client.generatePreview();
    
    log.success(`Preview generated successfully at: file://${previewPath}`);
  } catch (error) {
    log.error(`Error during dry-run preview test: ${(error as Error).message}`);
    process.exit(1);
  }
}

// Run the test function
testDryRunPreview().catch(err => {
  log.error(`Unhandled error: ${err.message}`);
  process.exit(1);
});
