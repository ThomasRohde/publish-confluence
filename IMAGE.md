Okay, here is a detailed specification for expanding the `thomasrohde-publish-confluence` project with `confluence-image` macro helpers.

**Spec: Confluence Image Macro Helper for `publish-confluence`**

**1. Introduction**

This document outlines the requirements and implementation details for adding a new Handlebars helper to the `publish-confluence` tool. This helper, `{{confluence-image}}`, will enable users to easily embed images into their Confluence page templates, supporting both images attached via the publishing process and external images referenced by URL.

**2. Goal**

The primary goal is to provide a convenient way for users to include images in their `confluence-template.html` files by abstracting the complexity of the Confluence Storage Format for images (`<ac:image>`). The helper should integrate seamlessly with the existing asset attachment mechanism for local images and also support external image URLs.

**3. Background**

The `publish-confluence` tool currently provides several Handlebars helpers (e.g., `confluence-panel`, `confluence-layout`, `confluence-code`) defined in `src/macro-helpers.ts`. These helpers generate the appropriate Confluence Storage Format XML when used within the `templatePath` file (`confluence-template.html`).

Confluence represents images using the `<ac:image>` tag, which can contain either an `<ri:attachment>` element for attached files or an `<ri:url>` element for external resources. It also supports various attributes for alignment, dimensions, borders, etc.

**4. Requirements**

**4.1. New Handlebars Helper: `confluence-image`**

*   A new inline Handlebars helper named `confluence-image` shall be created.
*   It should be usable within the main page template (`templatePath`).
*   The helper will generate the corresponding `<ac:image>...</ac:image>` structure in Confluence Storage Format.

**4.2. Helper Parameters**

The `confluence-image` helper shall accept the following parameters (passed as hash arguments in Handlebars):

| Parameter     | Type    | Required | Default   | Description                                                                                                                                  | Maps to Confluence Attribute(s) |
| :------------ | :------ | :------- | :-------- | :------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------ |
| `src`         | String  | Yes      | -         | The source of the image. Can be a relative filename (assumed to be in `distDir` and attached) or a full external URL (http/https).           | `ri:filename` or `ri:value`     |
| `alt`         | String  | No       | ""        | Alternative text for the image (important for accessibility).                                                                                | `ac:alt`                        |
| `title`       | String  | No       | ""        | Tooltip text displayed on hover.                                                                                                             | `ac:title`                      |
| `width`       | String  | No       | null      | The desired width of the image (e.g., "200", "50%"). Should be passed directly.                                                               | `ac:width`                      |
| `height`      | String  | No       | null      | The desired height of the image (e.g., "150", "auto"). Should be passed directly.                                                              | `ac:height`                     |
| `align`       | String  | No       | null      | Alignment of the image within the content. Valid values: `"left"`, `"center"`, `"right"`.                                                      | `ac:align`                      |
| `border`      | Boolean | No       | `false`   | Whether to display a border around the image.                                                                                                | `ac:border="true"`              |
| `thumbnail`   | Boolean | No       | `false`   | Whether to render the image as a thumbnail (behaviour defined by Confluence).                                                                | `ac:thumbnail="true"`           |
| `class`       | String  | No       | null      | Assigns a CSS class to the image element (useful for custom styling, though styling options within Confluence macros can be limited).        | `ac:class`                      |
| `style`       | String  | No       | null      | Applies inline CSS styles to the image element (use with caution, Confluence may override).                                                  | `ac:style`                      |

**4.3. Functional Logic**

*   The helper must inspect the `src` parameter to determine if it's an attachment filename or an external URL.
    *   A simple check (e.g., starts with `http://` or `https://`) can differentiate. More robust URL validation isn't strictly necessary initially.
*   If `src` is determined to be a filename:
    *   The helper should generate `<ac:image ...><ri:attachment ri:filename="{{src}}"/></ac:image>`.
    *   It assumes the file specified by `src` will be included in the `includedFiles` (or not excluded by `excludedFiles`) and uploaded as an attachment by the `Publisher` service.
*   If `src` is determined to be a URL:
    *   The helper should generate `<ac:image ...><ri:url ri:value="{{src}}"/></ac:image>`.
*   Optional parameters (`alt`, `title`, `width`, `height`, `align`, `border`, `thumbnail`, `class`, `style`) should be added as attributes (`ac:alt`, `ac:title`, etc.) to the `<ac:image>` tag *only if they are provided* in the helper call.
*   Boolean parameters (`border`, `thumbnail`) should only add the attribute `ac:border="true"` or `ac:thumbnail="true"` respectively, if their value is `true`.

**4.4. Generated Storage Format Examples**

*   **Attached Image (Simple):**
    ```handlebars
    {{confluence-image src="logo.png" alt="Company Logo"}}
    ```
    Should generate:
    ```xml
    <ac:image ac:alt="Company Logo"><ri:attachment ri:filename="logo.png"/></ac:image>
    ```

*   **External Image (with dimensions and alignment):**
    ```handlebars
    {{confluence-image src="https://example.com/image.jpg" width="300" height="200" align="center" title="Example from Web"}}
    ```
    Should generate:
    ```xml
    <ac:image ac:width="300" ac:height="200" ac:align="center" ac:title="Example from Web"><ri:url ri:value="https://example.com/image.jpg"/></ac:image>
    ```

*   **Attached Image (with border and thumbnail):**
    ```handlebars
    {{confluence-image src="product-thumb.gif" thumbnail=true border=true alt="Product Thumbnail"}}
    ```
    Should generate:
    ```xml
    <ac:image ac:alt="Product Thumbnail" ac:thumbnail="true" ac:border="true"><ri:attachment ri:filename="product-thumb.gif"/></ac:image>
    ```

**5. Implementation Details**

**5.1. File Modifications**

*   **`src/macro-helpers.ts`:**
    *   Add a new function, `registerConfluenceImageHelper(handlebars: typeof Handlebars): void`.
    *   Implement the logic within this function using `handlebars.registerHelper('confluence-image', (options) => { ... })`.
    *   Access parameters via `options.hash`.
    *   Implement the `src` type detection (URL vs. filename).
    *   Construct the `<ac:image>` XML string based on parameters. Ensure proper XML escaping for attribute values (Handlebars usually handles this for simple values, but be mindful).
    *   Return a `Handlebars.SafeString` containing the generated XML.
    *   Call `registerConfluenceImageHelper(Handlebars)` within the main `registerMacroHelpers` function.
*   **`src/types.ts` (Potentially):**
    *   While the helper parameters are handled within the helper itself, consider if any related types need updates, although likely not required for this specific helper.
*   **`src/publisher.ts`:**
    *   No direct changes required here, as the helper operates during template compilation, which already occurs. The existing file attachment logic should handle uploading image files specified in `includedFiles`.

**5.2. Error Handling**

*   The helper should gracefully handle the case where the required `src` parameter is missing, perhaps by returning an empty string or a placeholder comment in the output, and logging a warning (if logging is accessible within helpers).

**6. Documentation Updates**

*   **`README.md`:**
    *   Add `confluence-image` to the "Supported Macro Helpers" section.
    *   Include syntax, parameters table, and examples for both attached and external images.
*   **`docs/child-pages/page-4.html` (Macro Helper Reference):**
    *   Add a dedicated section for the `confluence-image` helper with detailed explanations and examples mirroring the README.
*   **`PROMPT.md` / `docs/template-prompt.md`:**
    *   Update the "List of `publish-confluence` Macro Helpers" section to include `confluence-image` with its parameters and purpose.
    *   Potentially update the example scenario if relevant.

**7. Sample Updates**

*   **`samples/macro-showcase/`:**
    *   Modify `samples/macro-showcase/confluence-template.html` to include examples of the `{{confluence-image}}` helper.
        *   Include an example referencing a fictional attached image (e.g., `src="sample-image.png"`). Ensure a dummy `sample-image.png` exists in the `samples/macro-showcase/src/` or `public/` directory so it gets copied to `dist` and included in the build (or add it to `includedFiles` in the sample's `publish-confluence.json`).
        *   Include an example referencing an external image URL.
        *   Show usage of various parameters like `width`, `height`, `alt`, `align`, `border`.
    *   Update `samples/macro-showcase/publish-confluence.json` if needed to ensure image files are included (e.g., adding `**/*.png` to `includedFiles`).

