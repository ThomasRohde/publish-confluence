
# Enhancements for Confluence Server API Interaction and Publishing Flow

## Introduction

This document outlines a series of tasks to improve the `publish-confluence` tool, focusing on enhancing its interaction with the Confluence Server REST API and refining the overall publishing workflow. The goal is to make the tool more robust, efficient, and feature-rich for users publishing content to Confluence Server instances.

## I. Confluence API Client Enhancements (`src/client.ts`)

### 1.1. Implement Page Label Management
    - **Description**: Add functionality to manage labels (tags) on Confluence pages.
    - **Rationale**: Labels are crucial for organizing and searching content in Confluence.
    - **Tasks**:
        1. Research Confluence Server REST API endpoints for:
            - Getting labels for a page (e.g., `GET /rest/api/content/{id}/label`).
            - Adding labels to a page (e.g., `POST /rest/api/content/{id}/label`).
            - Removing labels from a page (e.g., `DELETE /rest/api/content/{id}/label/{labelName}`).

        2. Implement methods in `ConfluenceClient` (e.g., `getPageLabels`, `addLabelsToPage`, `removeLabelFromPage`, `setPageLabels`).
        3. Update `Publisher` to use these methods based on new configuration options (e.g., `labels: ["label1", "label2"]` in `publish-confluence.json`).

    - **Relevant Files**: `src/client.ts`, `src/publisher.ts`, `src/types.ts`


## II. Publishing Workflow Enhancements (`src/publisher.ts` and CLI)

### 2.3. Option to Publish Without Updating Attachments
    - **Description**: Provide a CLI option or configuration setting to publish page content changes without re-evaluating or re-uploading attachments.
    - **Rationale**: Speeds up updates when only text/template content has changed, not the embedded application assets. This is a TODO item in `README.md`.
    - **Tasks**:
        1. Add a CLI flag (e.g., `--skip-attachments`) or a config option (e.g., `skipAttachments: true` in `publish-confluence.json`).
        2. In `Publisher.processPage`, if this option is active, completely bypass the attachment processing logic (i.e., do not call `getAttachments`, `processLocalFile`, `deleteRemovedAttachments`).
        3. Ensure this interacts correctly with `macroTemplatePath`. If `macroTemplatePath` is null, attachments are already skipped. This option provides explicit control even if a macro template is defined.
    - **Relevant Files**: `src/cli.ts`, `src/publisher.ts`, `src/config.ts`

