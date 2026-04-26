# Introduction

MyST (Markedly Structured Text) is a markdown flavor from the [Executable Book Project](https://mystmd.org/) and [Jupyter Book](https://jupyterbook.org/). It extends standard markdown with **directives** (block-level constructs), **roles** (inline constructs), and **cross-references** — making markdown suitable for technical documentation, scientific writing, and structured knowledge bases.

This plugin brings MyST syntax support to [Obsidian](https://obsidian.md/).

## What this plugin does

- **Directives** — Parse and render `:::{name} ... :::` blocks (admonitions, figures, code blocks, math, dropdowns, tab sets, and more)
- **Roles** — Recognize and style `{name}`content`` inline syntax (references, citations, sub/superscript, code, domain-specific roles)
- **Dollar math** — Render `$...$` inline and `$$...$$` display math
- **Callout bridge** — Add MyST admonition semantics to Obsidian's native callouts (`> [!type]`)
- **Editor highlighting** — Syntax coloring for MyST constructs in the editor via CodeMirror 6

## Two rendering surfaces

Obsidian has two rendering modes, and this plugin handles both:

| Mode | Mechanism | What you see |
|------|-----------|-------------|
| **Reading mode** | Post-processors and code block processors | Rendered directives, styled roles, dollar-math |
| **Editor / Live Preview** | CM6 StreamLanguage + decorations | Syntax-highlighted tokens, optional fence concealment |

## Relationship to the MyST spec

This plugin implements a practical subset of the [MyST specification](https://mystmd.org/spec). It focuses on the syntax that makes sense inside Obsidian — directives, roles, admonitions, and dollar-math. Some MyST features (full cross-reference resolution, bibliography rendering, execution of code cells) are not yet supported.

See [Limitations](./limitations.md) for what's not yet implemented.
