# Editor Mode

The plugin adds CodeMirror 6 extensions for MyST syntax in the editor and live preview modes.

## StreamLanguage parser

A custom StreamLanguage parser recognizes MyST constructs as you type:

| Construct | Pattern | Token class |
|-----------|---------|-------------|
| Directive fence (open) | `:::{name}` | `mystDirectiveFence` |
| Directive fence (close) | `:::` | `mystDirectiveFence` |
| Directive options | `:key: value` | `mystDirectiveOption` |
| Directive body | Content inside directive | `mystDirectiveBody` |
| Role syntax | `{name}`content`` | `mystRole` |
| Dollar math | `$...$` / `$$...$$` | `mystDollarMath` |
| Math content | Text inside dollar delimiters | `mystMathContent` |

The parser tracks state across lines — it knows when you're inside a directive block or inside dollar-math, and applies the correct token class accordingly.

## Syntax highlighting

Tokens are colored using a One Dark-inspired palette:

| Token | Color | Style |
|-------|-------|-------|
| Directive fences | `#c678dd` (purple) | Bold |
| Directive name | `#e06c75` (red) | Bold |
| Directive options | `#61afef` (blue) | Normal |
| Directive body | `#abb2bf` (default) | Normal |
| Role syntax | `#56b6c2` (cyan) | Normal |
| Role name | `#e5c07b` (yellow) | Bold |
| Role content | `#98c379` (green) | Normal |
| Dollar math delimiters | `#d19a66` (orange) | Normal |
| Math content | `#d19a66` (orange) | Italic |
| Citations | `#e06c75` (red) | Italic |

## Decorations

A ViewPlugin adds visual decorations on top of the syntax highlighting:

- **Directive fences**: Marked with `cm-myst-directive-fence` class (or concealed if the setting is enabled)
- **Directive options**: Marked with `cm-myst-directive-option` class
- **Roles**: Marked with `cm-myst-role` class
- **Dollar math**: Marked with `cm-myst-dollar-math` class

## Fence concealment

When **Conceal directive fences** is enabled in settings, the `:::` fences are replaced with a zero-width decoration — they're invisible in the editor but still present in the file. This gives a cleaner editing experience similar to Obsidian's built-in math rendering.

## Commands

The plugin provides editor commands (accessible via the command palette):

- **Insert directive template** — Inserts `:::{name}\n\n:::` at the cursor
- **Insert role** — Wraps selection in `{name}`content``

These are helper functions in the plugin module. Future versions will add a suggester for choosing from known directive and role names.
