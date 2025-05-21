Implementation Plan for hbsmd Post-Processor1. Introduction1.1. ObjectiveThis document outlines a comprehensive, step-by-step technical plan for the implementation of a new post-processor, designated hbsmd, within the publish-confluence command-line interface (CLI) tool. The primary function of the hbsmd processor is to convert Confluence Storage Format (XHTML) into GitHub Flavored Markdown (GFM). A key feature of this conversion is the embedding of publish-confluence specific Handlebars helper syntax for supported Confluence macros, while simultaneously preserving any pre-existing raw Handlebars expressions found within the input content.1.2. BackgroundThe publish-confluence tool, as detailed in its documentation and codebase 1, currently provides content transformation capabilities through its fetch command. Users can specify --process handlebars or --process markdown to convert fetched Confluence page content.1The existing handlebars processor transforms Confluence content, particularly its macros, into Handlebars templates. This allows for dynamic rendering where Confluence macros are represented by executable Handlebars helpers, which then generate the final Confluence XHTML.1Conversely, the markdown processor converts Confluence content into a clean, human-readable Markdown format, stripping away Confluence-specific markup and representing content structures using standard Markdown syntax.1The proposed hbsmd processor aims to synthesize these functionalities. It will produce Markdown that is largely static and readable but retains the dynamic templating capabilities of Handlebars for a defined set of Confluence macros, effectively bridging the gap between a Markdown-centric workflow and the rich macro ecosystem of Confluence as supported by publish-confluence.1.3. Rationale for hbsmd ProcessorThe introduction of an hbsmd processor addresses several use cases and enhances the utility of the publish-confluence tool:
Enhanced Readability and Templating: It allows users to fetch Confluence content into a format that is both human-readable (Markdown) and machine-processable for templating (Handlebars for macros). This is particularly useful for content that benefits from Markdown's simplicity but requires dynamic elements upon re-publishing.
Markdown-Centric Workflows: It facilitates workflows where Markdown is the primary authoring and editing format, yet the generation of complex or standardized Confluence macro structures is still desired when publishing back to Confluence.
Content Migration and Reusability: It offers a pathway for migrating Confluence content to Markdown-based documentation systems while preserving the semantics and functionality of publish-confluence supported macros, should the content need to be re-integrated or transformed further.
Developer Experience: For developers managing documentation-as-code, having Markdown files that can still leverage the power of Confluence macros via Handlebars offers a flexible and powerful combination.
1.4. Scope of this DocumentThis implementation plan details the necessary modifications to the publish-confluence tool, including:
Updates to the CLI argument parsing to recognize the new hbsmd option.
Changes to the post-processor registration mechanism to include the new processor.
A detailed design and implementation strategy for the HbsmdProcessor class itself.
A core principle guiding this plan is the maximization of code reuse from the existing MarkdownProcessor and HandlebarsProcessor to ensure consistency and reduce development effort.
1.5. Target AudienceThis document is intended for software developers and architects who will be responsible for implementing, or overseeing the implementation of, this new hbsmd post-processor feature within the publish-confluence project. A familiarity with TypeScript, Node.js, the existing publish-confluence codebase, Confluence Storage Format, Markdown, and Handlebars templating is assumed.2. hbsmd Processor Functional Specification2.1. Input FormatThe hbsmd processor will accept Confluence Storage Format (XHTML) as its primary input. This is the native XML-based format that Confluence uses internally to store page content, page templates, and other rich text entities.1 This format consists of standard XHTML elements (e.g., <p>, <h1>, <ul>) alongside custom elements prefixed with ac: (Atlassian Confluence specific, such as <ac:structured-macro>) and ri: (Resource Identifier, such as <ri:page>). A comprehensive understanding of this input format, as detailed in Confluence documentation 1, is essential for accurate conversion.2.2. Output FormatThe processor will generate output in GitHub Flavored Markdown (GFM). This Markdown output will not be pure static Markdown; instead, it will be a hybrid format where:
Standard XHTML elements are converted to their GFM equivalents.
Specific Confluence macros, those supported by the publish-confluence project's Handlebars helper library, are converted into their corresponding Handlebars helper syntax (e.g., {{#confluence-panel title="Example"}}...{{/confluence-panel}}).
Any raw Handlebars expressions (e.g., {{pageTitle}}, {{customVariable}}) already present in the input XHTML (often found within CDATA sections or as text nodes that were not intended as Confluence macro parameters) must be preserved verbatim in the final Markdown output.
The dual nature of this output format—being both Markdown and a Handlebars template—is a critical aspect. If this output is subsequently processed, the processing system must be Handlebars-aware to correctly interpret the embedded templating logic. Rendering this output with a standard Markdown parser alone will result in the Handlebars tags appearing as literal text. The intended workflow involves processing the .hbsmd file with a Handlebars engine (using the publish-confluence helpers) before or as part of rendering it as final Confluence content.2.3. Definition of "Confluence Handlebars supported by the project"The phrase "Confluence Handlebars supported by the project" refers specifically to the set of Handlebars helpers that are registered and made available by the publish-confluence tool, primarily within the src/macro-helpers.ts file.1 These helpers are designed to generate the Confluence Storage Format XHTML for various commonly used Confluence macros, such as panels, code blocks, table of contents, status lozenges, and layout macros.The document context/llms.txt 1 provides an exhaustive list of these available Handlebars helpers, detailing their names, parameters, whether they are block or inline helpers, and the expected Confluence XHTML structure they produce. This list serves as the definitive specification for determining which Confluence ac:structured-macro elements the hbsmd processor should convert into Handlebars helper syntax. The processor must maintain an internal mapping or logic to identify these macros based on their ac:name attribute and accurately translate them and their parameters into the correct Handlebars helper invocation string. This process will mirror aspects of the parameter extraction and mapping logic already present in the existing HandlebarsProcessor 1, but with the goal of generating the helper call rather than its executed output.2.4. Behavior SummaryThe hbsmd processor will exhibit the following conversion behaviors:
Standard XHTML Elements: Tags such as <p>, <h1> through <h6>, <ul>, <ol>, <li>, <a>, <img>, <table>, <strong>, <em>, and <code> will be converted into their GFM equivalents.
Supported Confluence Macros: ac:structured-macro elements whose ac:name corresponds to a Handlebars helper defined in src/macro-helpers.ts 1 will be transformed into the appropriate Handlebars helper call syntax. This includes correctly mapping macro parameters to helper arguments and embedding the processed macro body content (if any) within block helpers.
Unsupported Confluence Macros: ac:structured-macro elements that do not have a corresponding supported Handlebars helper will be converted into a standard Markdown representation. The precise representation (e.g., a blockquote containing the macro's content, or an HTML comment indicating the macro name and its parameters) is a design decision to be finalized, with a preference for preserving content where possible. The MarkdownProcessor currently adopts a strategy of converting unsupported macros into some form of visible Markdown 1, which may be preferable to silent HTML comments if content preservation is prioritized.
Raw Handlebars Expressions: Any text content within the input XHTML that matches Handlebars expression syntax (e.g., {{variable}}, {{#helper}}...{{/helper}}) and is not part of a Confluence macro's parameter definition will be preserved as-is in the output Markdown.
3. Proposed Implementation Strategy3.1. OverviewThe implementation will center around a new class, HbsmdProcessor, to be located in a new file src/post-processor/hbsmd-processor.ts. This class will extend the existing BasePostProcessor 1, thereby inheriting its foundational XML parsing capabilities, which utilize xmldom.1The core responsibilities of HbsmdProcessor will be realized by overriding key methods from BasePostProcessor, notably processElementNode (for handling general XHTML elements and dispatching macros) and processMacro (for specific conversion of ac:structured-macro elements).The conversion strategy will involve the following logical steps, orchestrated primarily through the recursive traversal of the input XHTML Document Object Model (DOM) initiated by BasePostProcessor:
DOM Traversal: The input Confluence Storage Format (XHTML) string will be parsed into a DOM structure. The HbsmdProcessor will traverse this DOM node by node.
Standard Element Conversion: For standard XHTML elements (e.g., <p>, <h1>, <ul>), the processor will adapt or reuse logic from the existing MarkdownProcessor 1 to convert these elements into their corresponding Markdown string representations.
Confluence Macro Handling (ac:structured-macro):

Supported Macros: If a macro element corresponds to one of the "Confluence Handlebars supported by the project" 1, it will be converted into its Handlebars helper string representation (e.g., <ac:structured-macro ac:name="panel"...> becomes the string {{#confluence-panel title="My Panel"}}...{{/confluence-panel}}). This step will require adapting the macro identification and parameter extraction logic currently found in HandlebarsProcessor.1
Unsupported Macros: If a macro is not among the supported set, it will be converted into a fallback Markdown representation (e.g., a blockquote detailing the macro name and its content, or an HTML comment, similar to how MarkdownProcessor handles unknown macros).


Text Node Processing and Handlebars Preservation: For text nodes encountered during DOM traversal, any raw Handlebars expressions (e.g., {{pageTitle}}) must be preserved verbatim. This requires careful serialization of text content to avoid escaping or altering these expressions. The integration of remark with the remark-hbs plugin 1 is anticipated as a final processing step on the generated Markdown string to ensure the integrity of both Markdown and embedded Handlebars syntax.
The order of operations during DOM traversal is crucial. The conversion of XHTML elements to Markdown must be aware of the potential for embedded Handlebars syntax to ensure it is not inadvertently altered. For instance, if a <p> tag contains text like "Hello {{user.name}}", the output Markdown paragraph should retain "{{user.name}}" literally.3.2. Code Reuse ApproachA primary objective is to maximize code reuse from the existing MarkdownProcessor and HandlebarsProcessor classes.

From MarkdownProcessor 1:

The processElementNode method within HbsmdProcessor will heavily reference or adapt the conversion logic from MarkdownProcessor for standard XHTML elements such as <p>, <h1>-<h6>, <ul>, <li>, <a>, <img>, <table>, <strong>, <em>, and <code>. The goal is to produce identical Markdown strings for these common elements.
Utility methods from MarkdownProcessor, such as normalizeText (for whitespace handling) and potentially parts of cleanupMarkdown (for final Markdown formatting), may be directly reusable or adaptable.
The granularity of reuse needs careful consideration. Simply calling entire methods from MarkdownProcessor might be challenging if its internal string-building mechanisms are not designed for interspersing Handlebars syntax. It may be more practical to adapt the logical approach for each element type or refactor MarkdownProcessor (and potentially BasePostProcessor) to expose more granular, reusable protected methods.



From HandlebarsProcessor 1:

The logic within HandlebarsProcessor's processMacro method, which maps Confluence macro names and parameters to Handlebars helper syntax, serves as a blueprint. HbsmdProcessor will adapt this logic: instead of generating the final XHTML output that results from executing the Handlebars helper, it will generate the Handlebars helper invocation string itself.
The formatParameters method from HandlebarsProcessor, which correctly quotes or omits quotes for helper parameters, can likely be reused directly.
The method for extracting macro body content (e.g., from ac:rich-text-body or ac:plain-text-body) will also be adapted. HbsmdProcessor will need to process this body content recursively to convert its contents into Markdown or further Handlebars syntax.


3.3. Handlebars PreservationPreserving raw Handlebars expressions (e.g., {{pageTitle}}) that might exist in the input Confluence content is critical. Standard Markdown processing can inadvertently escape or modify such syntax.The remark-hbs plugin, listed in the project's package.json 1, is specifically designed to parse and stringify Handlebars syntax within Markdown documents. The recommended approach involves a two-stage process:
Initial Conversion by HbsmdProcessor: The HbsmdProcessor will traverse the XHTML DOM, converting elements to Markdown strings and supported macros to Handlebars helper call strings. Text nodes containing raw Handlebars expressions will be outputted as-is.
Final Pass with remark and remark-hbs: The resulting string from HbsmdProcessor (which is Markdown with embedded Handlebars template tags) will then be processed by a unified pipeline configured with remark-parse, remark-hbs, remark-gfm (for GitHub Flavored Markdown features), and remark-stringify.
The remark-hbs plugin will ensure that Handlebars syntax is recognized as distinct from standard Markdown content and is preserved correctly during the parsing and subsequent stringification phases. This approach decouples the initial XHTML-to-Markdown/Handlebars conversion from the final stage of ensuring Markdown integrity and correct Handlebars syntax preservation. This also provides a degree of validation, as remark-hbs might flag malformed Handlebars syntax generated by the processor.4. Detailed Implementation PlanThe implementation will proceed in phases, starting with CLI and factory setup, followed by the core processor logic, and concluding with robust testing. The following files are anticipated to be affected or created:
src/cli.ts: Modifications will be needed to update the fetch command's --process option to include hbsmd as a valid choice and to ensure this choice is correctly passed to the underlying fetch logic.1
src/fetch.ts: The fetchPageAndChildren function (or a similar function responsible for page processing) will be updated to instantiate and utilize the HbsmdProcessor when options.processor === 'hbsmd'.1
src/post-processor/processor-factory.ts: The ProcessorFactory's createProcessor method will be extended to include a case for instantiating HbsmdProcessor when the requested processor name is hbsmd.1
src/post-processor/index.ts: This barrel file will need to import HbsmdProcessor from its new file. The initializePostProcessors function will be updated to register HbsmdProcessor with the ProcessorFactory. HbsmdProcessor will also be exported from this module.1
src/post-processor/hbsmd-processor.ts (New File): This new file will contain the definition of the HbsmdProcessor class, which will extend BasePostProcessor and implement the primary conversion logic.
src/types.ts (Potentially): While initially unlikely, updates to PostProcessorOptions or related types might become necessary if the HbsmdProcessor requires unique configuration options not covered by existing types.1
4.1. Phase 1: Setup and CLI Integration

4.1.1. Modify src/cli.ts 1:

The fetch command definition within src/cli.ts uses program.command('fetch').option(...) to define its options. The --process <processor> option's description string will be updated to list hbsmd as an available processor, for example: 'Post-process and convert fetched content format (available: handlebars, markdown, hbsmd). Changes file extensions to match the output format.'.
Within the .action((cmdOptions) => {... }) callback for the fetch command, the options.process value, derived from cmdOptions.process, is passed to the fetchPages function. No changes should be needed here beyond the option description if options.process is already correctly propagated.



4.1.2. Modify src/post-processor/index.ts 1:

A new import statement will be added at the top: import { HbsmdProcessor } from './hbsmd-processor';.
Inside the initializePostProcessors function, a new registration line will be added: ProcessorFactory.register('hbsmd', HbsmdProcessor);.
To make the class available for type checking or other potential uses (though direct instantiation outside the factory is generally discouraged), add: export * from './hbsmd-processor';.



4.1.3. Modify src/post-processor/processor-factory.ts 1:

The createProcessor(name: string): PostProcessor method likely uses a Map or a switch statement to look up and instantiate processor classes. A new case for 'hbsmd' will be added:
TypeScript// Example modification if using a Map
// private static readonly processors: Map<string, new () => PostProcessor> = new Map();
//...
// In initializePostProcessors (or wherever registration happens):
// ProcessorFactory.register('hbsmd', HbsmdProcessor);

// In createProcessor:
const processorClass = ProcessorFactory.processors.get(name.toLowerCase());
if (processorClass) {
    return new processorClass();
}
//... existing error handling...


The error message thrown by createProcessor when an unknown processor name is provided should be updated to include hbsmd in the list of available processors.


4.2. Phase 2: HbsmdProcessor Core Logic (src/post-processor/hbsmd-processor.ts)

4.2.1. Create src/post-processor/hbsmd-processor.ts:

The file will start with necessary imports, including BasePostProcessor, PostProcessor, PostProcessorOptions, and ProcessorResult from relevant local modules.
The class will be defined as:
TypeScriptimport { BasePostProcessor } from './base-processor';
import { PostProcessor, PostProcessorOptions, ProcessorResult } from './types';
import { Element } from 'xmldom'; // Or the correct type for DOM elements from xmldom
// Potentially import remark and remark-hbs for final processing
// import { unified } from 'unified';
// import remarkParse from 'remark-parse';
// import remarkHbs from 'remark-hbs';
// import remarkGfm from 'remark-gfm';
// import remarkStringify from 'remark-stringify';

export class HbsmdProcessor extends BasePostProcessor implements PostProcessor {
    public readonly name = 'hbsmd';
    public readonly outputExtension = 'md'; // Or 'hbs.md'

    // Constructor, if needed for specific initializations
    constructor() {
        super();
        // Initialize any HbsmdProcessor-specific properties
    }

    // process method override
    // processElementNode method override
    // processMacro method override
    // Helper methods
}


The BasePostProcessor 1 provides the domParser and the initial convertConfluenceMacros method which starts the DOM traversal.



4.2.2. Implement async process(content: string, options: PostProcessorOptions): Promise<ProcessorResult>:

This method serves as the main entry point for the processor.
It will invoke this.convertConfluenceMacros(content). This inherited method from BasePostProcessor parses the input content string into an XML DOM and then calls this.processNode on the root of this DOM. Because processNode is designed to call the (now overridden) processElementNode and processMacro methods of HbsmdProcessor, the specific conversion logic defined in HbsmdProcessor will be applied during this traversal.
The string returned by convertConfluenceMacros will be the initial Markdown string, potentially containing embedded Handlebars helper calls and raw Handlebars expressions.
A subsequent step will involve using the unified pipeline with remark-parse, remark-hbs, remark-gfm, and remark-stringify to normalize the Markdown and ensure correct preservation of Handlebars syntax.
TypeScript// Example snippet for remark processing within the process method:
// let processedContent = this.convertConfluenceMacros(content);
// const file = await unified()
//  .use(remarkParse)
//  .use(remarkHbs) // Ensures Handlebars syntax is understood
//  .use(remarkGfm) // For GitHub Flavored Markdown features
//  .use(remarkStringify)
//  .process(processedContent);
// processedContent = String(file);


Additional cleanup, such as normalizing excessive newlines or whitespace, similar to MarkdownProcessor.cleanupMarkdown 1, might be applied after the remark processing.
Finally, it returns an object: { content: finalProcessedContent, outputExtension: this.outputExtension, metadata: {} }.



4.2.3. Override protected processElementNode(element: Element): string:

This method is central to converting individual XHTML elements. It's called recursively by processNode (from BasePostProcessor).
Dispatching Macros: If element.nodeName === 'ac:structured-macro', it will extract the macroName from the ac:name attribute and call this.processMacro(macroName, element).
Standard XHTML Elements: For elements like <p>, <h1>-<h6>, <ul>, <ol>, <li>, <a>, <img>, <table>, <strong>, <em>, <code>, <pre>, <br>, <hr>, the logic will be adapted from MarkdownProcessor.processElementNode.1 This involves generating the Markdown equivalent (e.g., <h1>Title</h1> becomes # Title\n\n). Child nodes of these elements will be processed by recursively calling this.processNode(child).
Text Nodes: When element.nodeType === 3 (Text Node), element.nodeValue is retrieved. This text must be outputted directly to preserve any {{...}} Handlebars syntax. Markdown special characters within the text (e.g., *, _) that are not part of Handlebars expressions might need escaping if they are not intended as Markdown formatting, though remark should handle this correctly in a later pass.
Unknown Elements: A strategy for unknown elements should be defined (e.g., process their children and discard the unknown parent tag, or render the unknown tag as an HTML comment in the Markdown).



4.2.4. Override protected processMacro(macroName: string, macroElement: Element): string:

This method is responsible for converting ac:structured-macro elements into Handlebars helper strings or fallback Markdown.
Parameter Extraction: It will iterate through ac:parameter child elements of macroElement to build a key-value map of parameters, similar to HandlebarsProcessor.1
Body Extraction: It will need a method, say extractMacroBodyElement(macroElement: Element): Element | null, to get the primary body-containing child element (e.g., ac:rich-text-body or ac:plain-text-body). The content of this body element will then be processed by calling this.processNode(bodyElementContent) to convert its children to Markdown/Handlebars strings. This recursive processing is vital for handling nested structures within macro bodies.
Macro Conversion Logic (using switch(macroName)):

Supported Handlebars Macros: For each macro name listed in 1 (e.g., panel, code, info, toc), it will construct the Handlebars helper string.

The HandlebarsProcessor.formatParameters method 1 can be adapted or reused to generate the name="value" part of the helper call.
For block helpers, the recursively processed body content (now a Markdown/Handlebars string) is embedded:
TypeScript// Example for 'panel' macro
// const parameters = this.extractMacroParameters(macroElement);
// const formattedParams = this.formatParameters(parameters); // Adapted from HandlebarsProcessor
// const bodyElement = this.extractMacroBodyElement(macroElement);
// const bodyContent = bodyElement? this.processNode(bodyElement) : '';
// return `{{#confluence-panel <span class="math-inline">\{formattedParams\}\}\}\\n</span>{bodyContent}\n{{/confluence-panel}}\n\n`;




Unsupported Macros: For macro names not in the supported list, a fallback Markdown representation is generated. This could be a blockquote:
TypeScript// const bodyElement = this.extractMacroBodyElement(macroElement);
// const bodyContent = bodyElement? this.processNode(bodyElement) : '';
// return `> **Unsupported Confluence Macro: <span class="math-inline">\{macroName\}\*\*\\n\>\\n</span>{bodyContent}\n\n`;

Alternatively, an HTML comment: \n${bodyContent}\n. The blockquote approach is generally preferred for content visibility.




The BasePostProcessor's convertConfluenceMacros method serves as the entry point for the DOM traversal. When HbsmdProcessor calls this (likely via super.convertConfluenceMacros(content) or by relying on the inherited process if it calls convertConfluenceMacros), the traversal mechanism within BasePostProcessor will invoke this.processNode. Crucially, this.processNode will, in turn, call the overridden versions of processElementNode and processMacro that are defined within HbsmdProcessor, thus applying the specialized conversion logic.When processing the body of a Confluence macro (e.g., the content inside an <ac:rich-text-body> of a panel macro), it's essential that processMacro recursively calls this.processNode on the children of that body element. This ensures that any standard XHTML or further macros nested within the main macro's body are also correctly converted to their Markdown or Handlebars string representations before being embedded within the outer Handlebars helper string. A helper method like extractMacroBodyElement would be useful to get the actual DOM Element of the macro's body, which can then be passed to this.processNode.4.3. Phase 3: Handlebars Preservation and Macro Conversion

4.3.1. Strategy for Preserving Raw Handlebars Expressions:

The primary challenge in preserving raw Handlebars expressions ({{...}}) is to prevent Markdown processors or text manipulation from escaping or altering them.
Recommended Approach: remark with remark-hbs:

The HbsmdProcessor will first generate a Markdown string that includes both standard Markdown syntax and the newly generated Handlebars helper calls (e.g., ## Title\n{{myVar}}\n{{#confluence-panel}}...).
In the HbsmdProcessor.process method, after the initial DOM-to-string conversion, this intermediate string will be processed using the unified library. The pipeline will include remark-parse (to parse the Markdown), remark-hbs (to correctly identify and handle Handlebars syntax, as listed in package.json 1), remark-gfm (for GitHub Flavored Markdown features like tables and task lists), and finally remark-stringify (to serialize the abstract syntax tree back into a string).
The remark-hbs plugin is crucial as it teaches the remark parser to recognize Handlebars tokens, ensuring they are not misinterpreted as literal Markdown text and are preserved correctly during stringification. This plugin can also act as a validation step; if the HbsmdProcessor generates malformed Handlebars syntax, remark-hbs might encounter parsing errors.


Alternative (Less Robust): Custom Text Node Handling:

This would involve adding specific logic within processElementNode when handling text nodes (nodeType === 3). This logic would need to detect {{...}} patterns and ensure they are output directly, bypassing any Markdown escaping mechanisms. This approach is more prone to errors and harder to maintain compared to using a dedicated library like remark-hbs.





4.3.2. Mechanism for Converting Confluence Macros to Handlebars Helpers:


This conversion is the core responsibility of the overridden HbsmdProcessor.processMacro method.


A definitive mapping, likely implemented as a switch statement or an object lookup, will be used to translate Confluence macro ac:name attributes to their corresponding publish-confluence Handlebars helper names.1


Parameter Mapping: For each supported Confluence macro, its parameters are extracted from its <ac:parameter> child elements. The ac:name of the Confluence parameter needs to be mapped to the named argument of the target Handlebars helper. For instance, in a Confluence code macro, <ac:parameter ac:name="language">javascript</ac:parameter> maps to the language="javascript" argument in the {{#confluence-code language="javascript"}} helper.


Block vs. Inline Helpers:

Block Helpers (e.g., {{#confluence-panel}}...{{/confluence-panel}}): The content of the Confluence macro's body (typically from ac:rich-text-body) is recursively processed by HbsmdProcessor into a Markdown/Handlebars string. This resulting string is then placed between the opening ({{#helper...}}) and closing ({{/helper}}) Handlebars tags.
Inline Helpers (e.g., {{confluence-toc minLevel=2}}): These helpers are self-contained and do not have a body. Their string representation is generated directly with their parameters.



Nested Contexts: A common scenario involves Confluence macros containing text that itself includes raw Handlebars expressions (e.g., a panel macro whose description includes {{pageTitle}}). The HbsmdProcessor must handle this as follows:

The outer panel macro is converted to {{#confluence-panel...}}.
The panel's body content (e.g., <p>Details for {{pageTitle}}</p>) is recursively processed. The <p> tag becomes Markdown paragraph syntax, and the text node Details for {{pageTitle}} is processed such that {{pageTitle}} is preserved literally.
The final output would be structured like:
Handlebars{{#confluence-panel title="Details"}}
Details for {{pageTitle}}
{{/confluence-panel}}



The subsequent remark-hbs pass ensures the {{pageTitle}} expression remains intact within the Markdown.


Table 2: Confluence Macro to Handlebars Helper Mapping for hbsmdThis table outlines the direct conversion rules for supported Confluence macros to their publish-confluence Handlebars helper equivalents, based on the information from 1.



Confluence Macro (ac:name)Handlebars Helper (publish-confluence)Parameters to Map (Confluence ac:name -> Handlebars argument)Body Handling (for hbsmd)html{{#confluence-html}}... {{/confluence-html}}NoneContent of ac:plain-text-body (CDATA) processed; becomes body of HBS helper. {{{scripts}}} and {{{styles}}} should be preserved if present.panel{{#confluence-panel}}... {{/confluence-panel}}title, borderStyle, borderColor, borderWidth, bgColor, titleBGColor, titleColor, comment (all optional, direct map)Content of ac:rich-text-body processed to Markdown/HBS; becomes body of HBS helper.code{{#confluence-code}}... {{/confluence-code}}language, title, linenumbers (optional, direct map)Content of ac:plain-text-body (CDATA) processed; becomes body of HBS helper. Handlebars within code (if not lang=hbs) should be escaped by remark-hbs or prior step.toc{{confluence-toc...}}minLevel, maxLevel (optional, direct map)Inline helper, no body.status{{confluence-status...}}colour -> type, title -> textInline helper, no body.info{{#confluence-info}}... {{/confluence-info}}title (optional, direct map), comment (optional, direct map)Content of ac:rich-text-body processed to Markdown/HBS; becomes body of HBS helper.note{{#confluence-note}}... {{/confluence-note}}title (optional, direct map), comment (optional, direct map)Content of ac:rich-text-body processed to Markdown/HBS; becomes body of HBS helper.warning{{#confluence-warning}}... {{/confluence-warning}}title (optional, direct map), comment (optional, direct map)Content of ac:rich-text-body processed to Markdown/HBS; becomes body of HBS helper.tip{{#confluence-tip}}... {{/confluence-tip}}title (optional, direct map), comment (optional, direct map)Content of ac:rich-text-body processed to Markdown/HBS; becomes body of HBS helper.expand{{#confluence-expand}}... {{/confluence-expand}}title (optional, direct map)Content of ac:rich-text-body processed to Markdown/HBS; becomes body of HBS helper.children{{confluence-children...}}sort -> sortBy, reverse, labels -> includeLabels, excludeLabels, mode (all optional, map where names differ)Inline helper, no body.layout{{#confluence-layout}}... {{/confluence-layout}}NoneBody (containing layout-sections) processed to Markdown/HBS.layout-section{{#layout-section}}... {{/layout-section}}type (direct map)Body (containing layout-cells) processed to Markdown/HBS.layout-cell{{#layout-cell}}... {{/layout-cell}}NoneContent of ac:layout-cell processed to Markdown/HBS; becomes body of HBS helper.image (from ac:image){{confluence-image...}}ri:filename or ri:value -> src. Attributes ac:alt->alt, ac:title->title, ac:width->width, ac:height->height, ac:align->align, ac:border->border, ac:thumbnail->thumbnail, ac:class->class, ac:style->style.Inline helper, no body.link (from ac:link){{confluence-link...}} or {{#confluence-link}}... {{/confluence-link}}Determine type based on ri:* child. Map ri:content-title->pageTitle, ri:filename->filename, ri:value->url, ac:anchor->anchor. ac:tooltip->tooltip. Link body/text -> text or block content.Inline or block. If block, body processed to Markdown/HBS.date{{confluence-date...}}datetime attribute of <time> -> date. format parameter if present.Inline helper, no body.anchor{{confluence-anchor...}}Parameter with no name (empty ac:name) -> name.Inline helper, no body.include{{confluence-include...}}file (direct map)Inline helper, no body. Content of included file is processed by Handlebars.4.4. Phase 4: Code Reuse Implementation

4.4.1. Reusing MarkdownProcessor Logic 1:

Common Element Handling: The conversion logic for standard XHTML elements (paragraphs, headings, lists, links, images, tables, text formatting) in MarkdownProcessor.processElementNode is a strong candidate for adaptation. The HbsmdProcessor aims for identical Markdown output for these elements.
Refactoring for Reuse: To facilitate cleaner reuse, common element conversion logic could be refactored into:

Protected methods within BasePostProcessor (e.g., protected convertParagraphToMarkdown(element: Element): string).
Static utility functions, organized perhaps in a new src/post-processor/xhtml-to-markdown-utils.ts file.
This approach avoids direct dependencies between sibling classes (MarkdownProcessor and HbsmdProcessor) and promotes a more modular design.


Whitespace and Cleanup: MarkdownProcessor.normalizeText (for text node processing) and aspects of MarkdownProcessor.cleanupMarkdown (for final Markdown output refinement) are likely reusable. However, HbsmdProcessor will require its own final cleanup pass, especially after remark processing, to ensure Handlebars syntax is well-integrated with the Markdown.



4.4.2. Reusing/Adapting HandlebarsProcessor Logic 1:

Parameter Extraction & Formatting: The HandlebarsProcessor.formatParameters method, which constructs the name="value" string for Handlebars helper arguments, is directly reusable by HbsmdProcessor.
Macro Identification Logic: The switch statement or mapping structure within HandlebarsProcessor.processMacro that identifies Confluence macros by their ac:name and extracts their parameters provides the foundational logic. HbsmdProcessor will adapt this: instead of returning the executed Handlebars helper's final XHTML output, it will return the Handlebars helper invocation string.
Body Extraction Adaptation: HandlebarsProcessor.extractMacroBody extracts and processes the macro body into a string. HbsmdProcessor will need a similar mechanism, but crucially, it must obtain the raw body element (e.g., the ac:rich-text-body DOM element). This raw element is then passed to HbsmdProcessor's own processNode method for recursive conversion into a Markdown/Handlebars string. This distinction is vital because the "context" of processing differs: HandlebarsProcessor's body ultimately becomes XHTML, while HbsmdProcessor's body becomes a Markdown/Handlebars string.



4.4.3. Avoiding Tight Coupling:

The preferred methods for code reuse are through shared functionalities in the BasePostProcessor, dedicated utility modules, or by adapting logical patterns rather than creating direct instance-to-instance calls between MarkdownProcessor and HbsmdProcessor if such calls would introduce unwanted dependencies or complexity. Refactoring BasePostProcessor to include more granular, protected helper methods for common tasks like XML node manipulation or Confluence parameter extraction could be highly beneficial. For instance, a method like protected extractMacroParameters(macroElement: Element): Record<string, string> in BasePostProcessor would be useful for all processors that deal with Confluence macros.


4.5. Phase 5: Testing

4.5.1. Unit Tests for HbsmdProcessor:

XHTML Element Conversion: Test cases for each standard XHTML element (e.g., <p>text</p> to text\n\n, <h1>Title</h1> to # Title\n\n).
Supported Macro Conversion: For every supported Confluence macro (from Table 2), create tests to verify its correct transformation into the corresponding Handlebars helper string, including accurate parameter mapping and body content processing.
Handlebars Preservation: Test scenarios where raw Handlebars expressions ({{variable}}, {{#blockHelper}}...{{/blockHelper}}) exist within standard text content and within the bodies of Confluence macros. Ensure these are preserved verbatim in the output Markdown.
Unsupported Macro Handling: Test the defined fallback behavior for Confluence macros not in the supported list (e.g., conversion to a Markdown blockquote or HTML comment).
Nested Structures: Crucially, test nested scenarios:

Supported macros within other supported macros.
Raw Handlebars expressions inside the bodies of macros that are converted to Handlebars helpers.
Standard XHTML elements inside macros that are converted to Handlebars helpers.


Edge Cases: Test with empty input, empty macro bodies, macros with missing optional parameters, and XHTML that is parsable but might have unusual structures.
Whitespace and Formatting: Verify that the output Markdown adheres to expected whitespace and newline conventions, especially around block elements and Handlebars helper calls.



4.5.2. Integration Tests:

Test the end-to-end functionality of the publish-confluence fetch --process hbsmd... command.
Prepare sample Confluence pages 1 that include a diverse mix of standard XHTML content, supported Confluence macros, unsupported macros, and raw Handlebars expressions.
Execute the fetch command with the hbsmd processor against these sample files.
Verify that the output .md files are generated with the correct file extension.
Inspect the content of the output files to ensure:

Correct Markdown syntax.
Accurate Handlebars helper syntax for supported macros.
Preservation of raw Handlebars expressions.
Appropriate handling of unsupported macros.


Conceptual Round-Trip Validation: Although not a direct function of the fetch command, a valuable test involves taking the .hbsmd output and conceptually (or actually, if tooling allows) processing it with a Handlebars engine (using the project's registered helpers from src/macro-helpers.ts). The result of this Handlebars processing should yield content that, if it were then converted from Markdown to Confluence Storage Format, would be valid for publishing back to Confluence. This validates the semantic integrity of the hbsmd transformation.



4.5.3. Test Data:

Develop a comprehensive suite of Confluence Storage Format (XHTML) snippets and full-page examples. These should cover:

All macros listed in Table 2, with various parameter combinations.
Examples of unsupported macros.
Content with embedded raw Handlebars expressions.
Complex nested structures (e.g., layouts containing panels, which in turn contain lists and code blocks).
Various text formatting elements.
The Confluence storage format examples provided in Confluence.md 1 can serve as a valuable resource for creating this test data.




The output of the hbsmd processor needs to be validated in two distinct ways: first, as a syntactically correct Markdown document (which tools like remark-lint could assist with, keeping in mind the presence of Handlebars tags), and second, the embedded Handlebars snippets themselves should be syntactically valid Handlebars. Testing strategies should account for both these aspects.5. Key Considerations and Potential Challenges5.1. Parsing RobustnessThe underlying xmldom parser, utilized by BasePostProcessor 1, must robustly handle the full spectrum of valid Confluence Storage Format XHTML, including potentially malformed but still parsable variations that Confluence itself might produce or accept. The existing error handling within BasePostProcessor for parser errors should be leveraged.5.2. Complexity of processElementNodeThe processElementNode method in HbsmdProcessor will inherently be complex due to its multi-faceted dispatching logic: determining if an element is a standard XHTML tag (requiring Markdown conversion), a supported Confluence macro (requiring Handlebars helper string generation), an unsupported macro (requiring fallback Markdown or comment generation), or a text node that might contain raw Handlebars expressions (requiring careful preservation). Maintaining clarity and modularity within this method will be crucial for long-term maintainability.5.3. Handling of Whitespace and NewlinesGenerating Markdown that renders predictably across different platforms and tools necessitates meticulous management of whitespace and newlines. For example, Markdown typically requires blank lines to separate block-level elements. While Handlebars syntax is generally robust regarding whitespace, the interplay between generated Handlebars tags and the surrounding Markdown needs careful attention to ensure both readability of the .hbsmd file and correct rendering. The MarkdownProcessor's normalizeText and cleanupMarkdown methods 1 provide a foundation, but HbsmdProcessor will likely need specific adjustments, especially after the remark-hbs processing pass. Consideration should be given to whether Handlebars block helper calls (e.g., {{#confluence-panel}}) should be on their own lines, potentially surrounded by newlines, to ensure they are treated as block elements by Markdown processors and are visually distinct in the source file.5.4. Nested Structures and Recursive ProcessingThe accurate conversion of nested structures—such as Confluence macros embedded within other macros, or standard XHTML elements and raw Handlebars expressions contained within the body of a macro that itself is being converted to a Handlebars helper—depends on flawless recursive processing. When processMacro handles a block-level Confluence macro, its body content (e.g., from ac:rich-text-body) must be passed back through this.processNode to ensure all its constituent parts are also converted to the appropriate Markdown or Handlebars string representation before being embedded within the outer Handlebars helper string.5.5. PerformanceFor extremely large or complex Confluence pages, the DOM traversal, numerous string manipulations, and potentially multiple parsing/stringification passes (e.g., initial XHTML parsing, then remark processing) could introduce performance overhead. While fetch operations are not typically as performance-critical as real-time rendering, efficiency should be a consideration. The existing processors appear to manage this adequately, and leveraging efficient libraries like unified and remark is beneficial.5.6. remark-hbs IntegrationThe successful integration of remark-hbs is key to reliably preserving raw Handlebars expressions. It's important to ensure that remark-hbs correctly identifies all intended Handlebars syntax, especially if the Handlebars helper strings generated by HbsmdProcessor for Confluence macros become complex (e.g., containing nested parameters or unusual characters). Understanding the interaction of remark-hbs with other remark plugins in the pipeline, particularly remark-gfm, will be necessary to avoid conflicts or unexpected behavior.A broader consideration is the conceptual idempotency of the hbsmd format. While not a strict requirement for the fetch command, the usefulness of the format is enhanced if the information loss during conversion is minimized. For example, if unsupported Confluence macros are converted to HTML comments, their content is effectively lost for any subsequent re-publishing or automated processing. A strategy that preserves the content of unsupported macros (e.g., as Markdown blockquotes) might be more aligned with potential future use cases where the .hbsmd file serves as an editable source.6. Conclusion and Recommendations6.1. Summary of PlanThe implementation of the hbsmd post-processor involves creating a new HbsmdProcessor class that extends BasePostProcessor. This new processor will intelligently convert Confluence Storage Format (XHTML) into GitHub Flavored Markdown. Standard XHTML elements will be translated to their Markdown equivalents, while specific Confluence macros, as defined by the project's existing Handlebars helper library 1, will be transformed into their corresponding Handlebars helper invocation strings. Crucially, any raw Handlebars expressions present in the input will be preserved. This will be achieved by leveraging the XML parsing capabilities of BasePostProcessor, adapting conversion logic from MarkdownProcessor and macro-to-helper mapping logic from HandlebarsProcessor, and utilizing the remark ecosystem with remark-hbs for final output generation and Handlebars syntax preservation. The new processor will be integrated into the publish-confluence CLI via updates to the fetch command and the ProcessorFactory.6.2. Key Next Steps for Implementation
Phase 1 (Setup): Begin by implementing the CLI modifications in src/cli.ts and updating src/post-processor/index.ts and src/post-processor/processor-factory.ts to recognize and prepare for the HbsmdProcessor. Create the placeholder HbsmdProcessor.ts file.
Core Logic Development: Implement the HbsmdProcessor class. Start with overriding processElementNode to handle basic XHTML-to-Markdown conversions, drawing inspiration from MarkdownProcessor.
Macro Conversion: Incrementally implement the processMacro method, focusing on one supported Confluence macro at a time.1 Adapt parameter extraction from HandlebarsProcessor.
Handlebars Preservation: Integrate the remark pipeline with remark-hbs into the HbsmdProcessor.process method early in the development of content generation to ensure Handlebars syntax is correctly handled throughout.
Code Reuse Refinement: As common patterns emerge, refactor shared logic into BasePostProcessor or utility functions to maximize reuse from MarkdownProcessor and HandlebarsProcessor.
Testing: Develop unit tests concurrently with feature implementation. Create integration tests using sample XHTML files once the basic processor is functional.
6.3. Recommendation on Unsupported MacrosFor Confluence macros (ac:structured-macro) that do not have a corresponding publish-confluence Handlebars helper, it is recommended to convert them into a Markdown blockquote. This blockquote should clearly indicate the original macro's name and include its body content, processed recursively by HbsmdProcessor. This approach preserves the macro's content for user visibility and potential manual conversion, unlike using HTML comments which would hide the content. Example:
Unsupported Confluence Macro: custom-macro-name
Converted body content of the custom macro appears here as Markdown.
6.4. Emphasis on TestingComprehensive testing is paramount for the success of the hbsmd processor due to the complexity of converting between three syntaxes (XHTML, Markdown, and Handlebars). Testing should cover:
Individual element and macro conversions.
Accurate preservation of raw Handlebars syntax.
Robust handling of nested structures (e.g., macros within macros, HTML within macros that become Handlebars helpers).
Various whitespace and formatting edge cases.
End-to-end functionality via the fetch --process hbsmd command.
A thorough test suite will ensure the hbsmd processor is reliable and produces the expected output across a wide range of Confluence content structures.