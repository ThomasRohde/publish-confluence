# Confluence Storage Format

This page describes the XHTML-based format that Confluence uses to store the content of pages, page templates, blueprints, blog posts and comments. This information is intended for advanced users who need to interpret and edit the underlying markup of a Confluence page. 

We refer to the Confluence storage format as 'XHTML-based'. To be correct, we should call it XML, because the Confluence storage format does not comply with the XHTML definition. In particular, Confluence includes custom elements for macros and more. We're using the term 'XHTML-based' to indicate that there is a large proportion of HTML in the storage format.

## Headings

| Format type | In Confluence 4.0 and later | What you will get |
|-------------|----------------------------|-------------------|
| Heading 1 | `<h1>Heading 1</h1>` | Heading 1 |
| Heading 2 | `<h2>Heading 2</h2>` | Heading 2 |
| Heading 3 | `<h3>Heading 3</h3>` | Heading 3 |

Headings 4 to 6 are also available and follow the same pattern.

## Text effects

| Format type | In Confluence 4.0 and later | What you will get |
|-------------|----------------------------|-------------------|
| strong/bold | `<strong>strong text</strong>` | **strong** |
| emphasis | `<em>Italics Text</em>` | *emphasis* |
| strikethrough | `<span style="text-decoration: line-through;">strikethrough</span>` | ~~strikethrough~~ |
| underline | `<u>underline</u>` | underline |
| superscript | `<sup>superscript</sup>` | superscript |
| subscript | `<sub>subscript</sub>` | subscript |
| monospace | `<code>monospaced</code>` | `monospaced` |
| preformatted | `<pre>preformatted text</pre>` | preformatted text |
| block quotes | `<blockquote><p>block quote</p></blockquote>` | block quote |
| text color | `<span style="color: rgb(255,0,0);">red text</span>` | red text |
| small | `<small>small text</small>` | small text |
| big | `<big>big text</big>` | big text |
| center-align | `<p style="text-align: center;">centered text</p>` | centered text |
| right-align | `<p style="text-align: right;">right aligned text</p>` | right aligned text |

## Text breaks

| Format type | In Confluence 4.0 and later | What you will get |
|-------------|----------------------------|-------------------|
| New paragraph | `<p>Paragraph 1</p><p>Paragraph 2</p>` | Paragraph 1<br><br>Paragraph 2 |
| Line break | `Line 1 <br /> Line 2`<br>Note: Created in the editor using Shift + Return/Enter | Line 1<br>Line 2 |
| Horizontal rule | `<hr />` | --- |
| — symbol | `&mdash;` | — |
| – symbol | `&ndash;` | – |

## Lists

| Format type | In Confluence 4.0 and later | What you will get |
|-------------|----------------------------|-------------------|
| Unordered list – round bullets | `<ul><li>round bullet list item</li></ul>` | • Round bullet list item |
| Ordered list (numbered list) | `<ol><li>numbered list item</li></ol>` | 1. Ordered list item |
| Task Lists | `<ac:task-list><ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>task list item</ac:task-body></ac:task></ac:task-list>` | ☐ task list item |

## Links

| Format type | In Confluence 4.0 and later | What you will get |
|-------------|----------------------------|-------------------|
| Link to another Confluence page | `<ac:link><ri:page ri:content-title="Page Title" /><ac:plain-text-link-body><![CDATA[Link to another Confluence Page]]></ac:plain-text-link-body></ac:link>` | Link to another Confluence page |
| Link to an attachment | `<ac:link><ri:attachment ri:filename="atlassian_logo.gif" /><ac:plain-text-link-body><![CDATA[Link to a Confluence Attachment]]></ac:plain-text-link-body></ac:link>` | Link to an attachment |
| Link to an external site | `<a href="http://www.atlassian.com">Atlassian</a>` | Atlassian |
| Anchor link (same page) | `<ac:link ac:anchor="anchor"><ac:plain-text-link-body><![CDATA[Anchor Link]]></ac:plain-text-link-body></ac:link>` | Anchor Link |
| Anchor link (another page) | `<ac:link ac:anchor="anchor"><ri:page ri:content-title="pagetitle"/><ac:plain-text-link-body><![CDATA[Anchor Link]]></ac:plain-text-link-body></ac:link>` | Anchor Link |
| Link with an embedded image for the body | `<ac:link ac:anchor="Anchor Link"><ac:link-body><ac:image><ri:url ri:value="http://confluence.atlassian.com/images/logo/confluence_48_trans.png" /></ac:image></ac:link-body></ac:link>` | For rich content like images, you need to use ac:link-body to wrap the contents. |

### A note about link bodies

All links received from the editor will be stored as plain text by default, unless they are detected to contain the limited set of mark up that we allow in link bodies. Here are some examples of markup we support in link bodies.

An example of different link bodies:
```xml
<ac:link>
  <!-- Any resource identifier --> 
  <ri:page ri:content-title="Home" ri:space-key="SANDBOX" /> 
  <ac:link-body>Some <strong>Rich</strong> Text</ac:link-body>
</ac:link>
<ac:link>
  <ri:page ri:content-title="Plugin developer tutorial stuff" ri:space-key="TECHWRITING" />
  <ac:plain-text-link-body><![CDATA[A plain <text> link body]]></ac:plain-text-link-body>
</ac:link>
<ac:link>
  <ri:page ri:content-title="Plugin developer tutorial stuff" ri:space-key="TECHWRITING" />
  <!-- A link body isn't necessary. Auto-generated from the resource identifier for display. --> 
</ac:link>
```

The markup tags permitted within the `<ac:link-body>` are `<b>`, `<strong>`, `<em>`, `<i>`, `<code>`, `<tt>`, `<sub>`, `<sup>`, `<br>` and `<span>`.

## Images

| Format type | In Confluence 4.0 and later | What you will get |
|-------------|----------------------------|-------------------|
| Attached image | `<ac:image><ri:attachment ri:filename="atlassian_logo.gif" /></ac:image>` | [Image] |
| External image | `<ac:image><ri:url ri:value="http://confluence.atlassian.com/images/logo/confluence_48_trans.png" /></ac:image>` | [Image] |

Supported image attributes (some of these attributes mirror the equivalent HTML 4 IMG element):

| Name | Description |
|------|-------------|
| ac:align | image alignment |
| ac:border | Set to "true" to set a border |
| ac:class | css class attribute |
| ac:title | image tool tip |
| ac:style | css style |
| ac:thumbnail | Set to "true" to designate this image as a thumbnail |
| ac:alt | alt text |
| ac:height | image height |
| ac:width | image width |
| ac:vspace | the white space on the top and bottom of an image |
| ac:hspace | the white space on the left and right of an image |

## Tables

| Format type | In Confluence 4.0 and later | What you will get |
|-------------|----------------------------|-------------------|
| Two column, two row (top header row) | `<table><tbody><tr><th>Table Heading Cell 1</th><th>Table Heading Cell 2</th></tr><tr><td>Normal Cell 1</td><td>Normal Cell 2</td></tr></tbody></table>` | A 2x2 table with headers |
| Two column, three rows, 2nd and third with merged cells in first row | `<table><tbody><tr><th>Table Heading Cell 1</th><th>Table Heading Cell 2</th></tr><tr><td rowspan="2">Merged Cell</td><td>Normal Cell 1</td></tr><tr><td colspan="1">Normal Cell 2</td></tr></tbody></table>` | A 2x3 table with merged cells |

## Page layouts

Confluence supports page layouts directly, as an alternative to macro-based layouts (using, for example, the section and column macros). This section documents the storage format XML created when these layouts are used in a page.

| Element name | In Confluence 5.2 and later | Attributes |
|-------------|----------------------------|-----------|
| ac:layout | Indicates that the page has a layout. It should be the top level element in the page. | None |
| ac:layout-section | Represents a row in the layout. It must be directly within the ac:layout tag. The type of the section indicates the appropriate number of cells and their relative widths. | ac:type |
| ac:layout-cell | Represents a column in a layout. It must be directly within the ac:layout-section tag. There should be an appropriate number of cells within the layout-section to match the ac:type. | None |

The recognized values of ac:type for ac:layout-section are:

| ac:type | Expected number of cells | Description |
|--------|------------------------|-------------|
| single | 1 | One cell occupies the entire section. |
| two_equal | 2 | Two cells of equal width. |
| two_left_sidebar | 2 | A narrow (~30%) cell followed by a wide cell. |
| two_right_sidebar | 2 | A wide cell followed by a narrow (~30%) cell. |
| three_equal | 3 | Three cells of equal width. |
| three_with_sidebars | 3 | A narrow (~20%) cell at each end with a wide cell in the middle. |

The following example shows one of the more complicated layouts from the old format built in the new. The word {content} indicates where further XHTML or Confluence storage format block content would be entered, such as `<p>` or `<table>` tags.

```xml
<ac:layout>
  <ac:layout-section ac:type="single">
     <ac:layout-cell>
        {content}
     </ac:layout-cell>
  </ac:layout-section>
 <ac:layout-section ac:type="three_with_sidebars">
     <ac:layout-cell>
       {content}
     </ac:layout-cell>
     <ac:layout-cell>
       {content}
     </ac:layout-cell>
     <ac:layout-cell>
       {content}
     </ac:layout-cell>
  </ac:layout-section>
  <ac:layout-section ac:type="single">
     <ac:layout-cell>
        {content}
     </ac:layout-cell>
  </ac:layout-section>
</ac:layout>
```

## Emojis

| Format type | In Confluence 4.0 and later | What you will get |
|-------------|----------------------------|-------------------|
| Emoticons | `<ac:emoticon ac:name="smile" />` | (smile) |
|  | `<ac:emoticon ac:name="sad" />` | (sad) |
|  | `<ac:emoticon ac:name="cheeky" />` | (tongue) |
|  | `<ac:emoticon ac:name="laugh" />` | (big grin) |
|  | `<ac:emoticon ac:name="wink" />` | (wink) |
|  | `<ac:emoticon ac:name="thumbs-up" />` | (thumbs up) |
|  | `<ac:emoticon ac:name="thumbs-down" />` | (thumbs down) |
|  | `<ac:emoticon ac:name="information" />` | (info) |
|  | `<ac:emoticon ac:name="tick" />` | (tick) |
|  | `<ac:emoticon ac:name="cross" />` | (error) |
|  | `<ac:emoticon ac:name="warning" />` | (warning) |

## Resource identifiers

Resource identifiers are used to describe "links" or "references" to resources in the storage format. Examples of resources include pages, blog posts, comments, shortcuts, images and so forth.

| Resource | Resource identifier format |
|----------|----------------------------|
| Page | `<ri:page ri:space-key="FOO" ri:content-title="Test Page"/>` |

**Notes**:
- ri:space-key: (optional) denotes the space key. This can be omitted to create a relative reference.
- ri:content-title: (required) denotes the title of the page.

| Resource | Resource identifier format |
|----------|----------------------------|
| Blog Post | `<ri:blog-post ri:space-key="FOO" ri:content-title="First Post" ri:posting-day="2012/01/30" />` |

**Notes**:
- ri:space-key: (optional) denotes the space key. This can be omitted to create a relative reference.
- ri:content-title: (required) denotes the title of the page.
- ri:posting-day: (required) denotes the posting day. The format is YYYY/MM/DD.

| Resource | Resource identifier format |
|----------|----------------------------|
| Attachment | `<ri:attachment ri:filename>... resource identifier for the container of the attachment ...</ri:attachment>` |

**Notes**:
- ri:filename: (required) denotes the name of the attachment.
- the body of the ri:attachment element should be a resource identifier denoting the container of the attachment. This can be omitted to create a relative attachment reference (similar to [foo.png] in wiki markup).

**Examples**:

Relative Attachment Reference:
```xml
<ri:attachment ri:filename="happy.gif" />
```

Absolute Attachment Reference:
```xml
<ri:attachment ri:filename="happy.gif">
    <ri:page ri:space-key="TST" ri:content-title="Test Page"/>
</ri:attachment>
```

| Resource | Resource identifier format |
|----------|----------------------------|
| URL | `<ri:url ri:value="http://example.org/sample.gif"/>` |

**Notes**:
- ri:value: (required) denotes the actual URL value.

| Resource | Resource identifier format |
|----------|----------------------------|
| Shortcut | `<ri:shortcut ri:key="jira" ri:parameter="ABC-123">` |

**Notes**:
- ri:key: (required) represents the key of the Confluence shortcut.
- ri:parameter: (required) represents the parameter to pass into the Confluence shortcut.
- The example above is equivalent to [ABC-123@jira] in wiki markup.

| Resource | Resource identifier format |
|----------|----------------------------|
| User | `<ri:user ri:userkey="2c9680f7405147ee0140514c26120003"/>` |

**Notes**:
- ri:userkey: (required) denotes the unique identifier of the user.

| Resource | Resource identifier format |
|----------|----------------------------|
| Space | `<ri:space ri:space-key="TST"/>` |

**Notes**:
- ri:space-key: (required) denotes the key of the space.

| Resource | Resource identifier format |
|----------|----------------------------|
| Content Entity | `<ri:content-entity ri:content-id="123"/>` |

**Notes**:
- ri:content-id: (required) denotes the id of the content.

## Whitespace

Minimize excessive vertical whitespace in Confluence Server storage format XHTML and follow these best practices:

1. **Use Minimal Structural Elements**:
   - Avoid unnecessary nested `<div>`, `<p>`, or `<br>` tags. Each adds vertical spacing. For example, use a single `<p>` for a paragraph instead of multiple `<p>` tags with empty lines.
   - Example: Instead of `<p>Text</p><p></p><p>More text</p>`, use `<p>Text</p><p>More text</p>`.

2. **Control Line Breaks**:
   - Avoid `<br>` unless explicitly needed for a line break within a paragraph. Confluence renders `<p>` tags with default margins, so stacking them creates extra whitespace.
   - Use inline elements like `<span>` for text styling within a paragraph to avoid unintended breaks.

3. **Leverage Confluence Macros for Layout**:
   - Use macros like `panel`, `table`, or `section` to structure content tightly instead of relying on multiple `<p>` tags for separation.
   - Example: Wrap related content in a `<ac:structured-macro ac:name="panel">` to group it without extra spacing.

4. **Avoid Empty Elements**:
   - Programmatically ensure no empty `<p></p>`, `<div></div>`, or `<ac:plain-text-body></ac:plain-text-body>` tags are generated, as these render as blank lines.
   - Validate your XHTML output to strip empty tags before sending to the API.

5. **Use CSS Sparingly and Precisely**:
   - If applying custom styles via `<style>` or inline CSS, set `margin` and `padding` to `0` where needed to override Confluence’s defaults.
   - Example: `<p style="margin: 0;">Text</p>` reduces spacing between paragraphs.

6. **Optimize Lists**:
   - For `<ul>` or `<ol>`, ensure no empty `<li></li>` tags. Use minimal nesting to avoid excessive indentation and spacing.
   - Example: `<ul><li>Item 1</li><li>Item 2</li></ul>` instead of `<ul><li>Item 1</li><li></li><li>Item 2</li></ul>`.

7. **Test and Preview Output**:
   - Use the Confluence REST API’s `convert/content` endpoint to preview how your XHTML renders. Adjust programmatically based on observed spacing.
   - Example API call: `POST /rest/api/contentbody/convert/storage` with your XHTML to see the rendered result.

8. **Sanitize Input Data**:
   - If your content comes from external sources, strip extra newlines (`\n`), carriage returns (`\r`), or multiple spaces that could translate into `<br>` or empty `<p>` tags during conversion to XHTML.