## TODOs and Future Improvements

- [ ] Document in page-5.html the --comment flag and its usage.
  - Add a new row to the "Global Options" table in page-5.html around line 40
  - Include explanation that the comment flag enables developer-only content in admonition macros
  - Add example usage: `publish-confluence --comment` to show how the flag is used
  - Explain that comments are implemented using the `comment=true` parameter in info macros

- [ ] Implement the comment flag in the other admonition helpers.
  - Modify the following helpers in macro-helpers.ts (around lines 450-500):
    - confluence-note
    - confluence-warning
    - confluence-tip
  - For each helper, add the comment parameter like in confluence-info:
    ```typescript
    const comment = helperOptions.hash.comment === true;
    
    // Skip output if this is a comment macro and the --comment flag is not enabled
    if (comment && (!options || !options.comment)) {
      return '';
    }
    ```
  - Update JSDoc comments for each modified helper to document the comment parameter

- [ ] Implement {{confluence-include}} macro to include other XHTML macro file files in the page.
  - Create a new helper named 'confluence-include' in macro-helpers.ts
  - The helper should:
    - Accept a `file` parameter specifying the path to the file to include
    - Read the file content from the specified path
    - Parse the content with Handlebars to handle any variables
    - Return the processed content as a SafeString
  - Add proper JSDoc comments explaining usage
  - Example implementation structure:
    ```typescript
    handlebars.registerHelper('confluence-include', function(this: any, options: Handlebars.HelperOptions) {
      const filePath = options.hash.file;
      if (!filePath) {
        console.warn('Warning: confluence-include helper called without required "file" parameter');
        return '';
      }
      
      // Read file content, process it, and return
      // ...
    });
    ```