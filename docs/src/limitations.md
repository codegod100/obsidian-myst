# Limitations & Known Issues

## Reading mode

- **Remark parser, not markdown-it.** Obsidian uses remark/unified internally, not markdown-it. The `markdown-it-myst` package is included as a dependency but cannot be directly injected into the rendering pipeline. Instead, the plugin uses post-processors and code block processors. This means some MyST syntax that `markdown-it-myst` would handle may not survive Obsidian's remark parse.

- **Role syntax may not survive remark.** The `{name}`content`` syntax uses backticks, which remark may interpret as inline code. If remark wraps the content in `<code>` tags before the post-processor runs, the role pattern won't match. This needs live testing to confirm.

- **Directive name extraction is incomplete.** The code block processor receives the source content but not the fence language. The directive name is currently inferred from the registered code block language string, not from the parsed source. This means the `name` field in `ParsedDirective` defaults to `"directive"` for some code block types.

## Editor mode

- **StreamLanguage re-parses from line start.** The CM6 StreamLanguage parser re-parses from the beginning of the current line on each keystroke. In very large files with many directive blocks, this could cause performance issues. A full Lezer grammar would be more efficient but is significantly more work.

- **No folding.** Directive blocks are not foldable yet. The `mystStateField` is a stub that tracks parsed structure but doesn't wire into CM6's folding mechanism.

- **No autocomplete.** Known directive and role names are tracked in `KNOWN_DIRECTIVES` and `KNOWN_ROLES` sets, but there's no autocomplete suggester yet.

## Dollar math

- **Overlap with Obsidian's MathJax.** Obsidian already renders `$$...$$` display math. The plugin's dollar-math post-processor may conflict with or duplicate Obsidian's rendering. Disable the dollar-math setting if you use another math plugin.

- **Inline math only.** The plugin's post-processor handles `$...$` inline math. Display math `$$...$$` is left to Obsidian's built-in renderer.

## Missing features

- **No cross-reference resolution.** The `{ref}` and `{doc}` roles are recognized syntactically but don't resolve to actual links yet.

- **No citation bibliography.** The `{cite}` roles are recognized but don't render a bibliography.

- **No nested MyST in directive bodies.** Directive body content is rendered as plain text. Nested roles, directives, or markdown inside a directive body are not parsed.

- **No code-cell execution.** The `code-cell` directive is recognized but not executed.

- **No Mermaid rendering.** The `{mermaid}` directive is registered as a code block processor but doesn't render Mermaid diagrams yet.
