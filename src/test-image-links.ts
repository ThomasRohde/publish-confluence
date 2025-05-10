#!/usr/bin/env node
/**
 * This script tests the preview functionality of publish-confluence
 * Specifically focusing on attachment and image link handling
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDryRunClient } from './dry-run.js';
import { createLogger } from './logger.js';

const log = createLogger();

// Get the directory name in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test function to verify image and attachment links in preview
 */
async function testImageAttachmentLinks() {
  // Create a test directory
  const testDir = path.resolve(process.cwd(), 'dry-run-test-attachments');
  
  log.info(`Starting image/attachment links test in: ${testDir}`);
  
  try {
    // Create a dry-run client with preview enabled
    const client = await createDryRunClient(testDir, { 
      previewEnabled: true 
    });
    
    // Create a test space and pages
    const spaceKey = 'TEST';
    
    // Create root page with images
    const rootPage = await client.createPage(
      spaceKey,
      'Test Page With Images',
      '<h1>Test Page With Images</h1>' +
      '<p>This is a test page for verifying image links in the preview.</p>'
    );
    
    // Add sample image as attachment
    const sampleImagePath = path.resolve(__dirname, '..', 'sample-image.png');
    
    try {
      // Make sure the sample image exists, or create a simple one
      try {
        await fs.access(sampleImagePath);
        log.info(`Using existing sample image: ${sampleImagePath}`);
      } catch (error) {
        // Create a sample image if it doesn't exist
        log.info(`Sample image not found, creating one at: ${sampleImagePath}`);
        
        // Create directory if needed
        await fs.mkdir(path.dirname(sampleImagePath), { recursive: true });
        
        // Use a minimal PNG file (1x1 pixel) as a placeholder
        const minimalPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
        await fs.writeFile(sampleImagePath, minimalPng);
      }
      
      // Upload the image as an attachment
      await client.uploadAttachment(rootPage.id, sampleImagePath);
      
      // Update the page content to include the image
      await client.updatePage(
        rootPage.id,
        'Test Page With Images',
        '<h1>Test Page With Images</h1>' +
        '<p>This is a test page for verifying image links in the preview.</p>' +
        '<h2>Image Tests</h2>' +
        '<h3>1. Confluence Image Macro</h3>' +
        '<ac:image><ri:attachment ri:filename="sample-image.png" /></ac:image>' +
        '<h3>2. HTML Image Tag with Confluence Attachment</h3>' +
        '<p>This approach should also work:</p>' +
        '<img src="attachments/' + rootPage.id + '/sample-image.png" alt="Sample Image" />' +
        '<h3>3. Image with other attachments</h3>' +
        '<p>Let\'s also add a text file attachment:</p>' +
        '<ac:link><ri:attachment ri:filename="test-file.txt" /><ac:plain-text-link-body><![CDATA[Download Test File]]></ac:plain-text-link-body></ac:link>',
        1
      );
      
      // Create a test file attachment too
      const testFilePath = path.resolve(testDir, 'test-file.txt');
      await fs.writeFile(testFilePath, 'This is a test file attachment');
      await client.uploadAttachment(rootPage.id, testFilePath);
        // Generate the preview
      const previewPath = await client.generatePreview();
      
      log.success(`Preview with image links generated successfully at: file://${previewPath}`);
      log.info(`Test your browser to verify image links work properly.`);
    } catch (error) {
      log.error(`Error with image attachments: ${error instanceof Error ? error.message : String(error)}`);
    }
  } catch (error) {
    log.error(`Error during test: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run the test
testImageAttachmentLinks().catch(err => {
  log.error(`Unhandled error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
