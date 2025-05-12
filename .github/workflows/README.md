# GitHub Actions Workflow for Documentation

This directory contains the GitHub Actions workflow that:

1. Builds the publish-confluence tool
2. Generates diagrams for the documentation (if needed)
3. Runs publish-confluence on the docs/ directory with the `--dry-run` option
4. Publishes the generated HTML files to GitHub Pages

## How it works

The workflow:
- Runs on every push to the main branch or when manually triggered
- Builds the publish-confluence package using `npm run build`
- Runs `npm run build:diagram` in the docs directory to generate diagram images
- Runs the publish-confluence CLI on the docs/ directory in dry-run mode with:
  ```bash
  cd docs
  node ../dist/cli.js publish --dry-run ./docs-output
  ```
- Copies the generated files to the `public/` directory
- Uploads and deploys the result to GitHub Pages

## Customizing

If you need to modify the workflow:
- Change the output directory by updating the `--dry-run ./docs-output` parameter
- Adjust the file copying commands in the "Copy generated docs to public directory" step
- Add additional build or post-processing steps as needed

Note: This workflow uses the GitHub Pages deployment process directly, which is different from the pages-build-deployment workflow that runs when the content is in the root of the repository.
