# Settings

All settings are toggles, accessible under **Settings → Community plugins → MyST Markdown**.

| Setting | Default | Description |
|---------|---------|-------------|
| **Directives** | On | Parse and render MyST directives (`:::{name} ... :::`) |
| **Roles** | On | Parse and render MyST inline roles (`{name}`content``) |
| **Dollar math** | On | Render `$...$` inline and `$$...$$` display math |
| **Callout bridge** | On | Map Obsidian callouts (`> [!type]`) to MyST admonitions |
| **Editor highlighting** | On | Highlight MyST syntax in the editor |
| **Conceal directive fences** | Off | Hide `:::` fences in live preview mode |

## When settings take effect

Settings take effect immediately — no reload required. Toggling a feature off unregisters its processors or extensions on the next render cycle.

## Recommended configurations

### Minimal (reading mode only)

Disable editor highlighting and fence concealment. You get rendered MyST in reading mode but a plain editor.

### Full (default)

All settings on. Syntax highlighting in the editor, rendered output in reading mode, callout bridge active.

### Writer-focused

Enable directives, roles, and callout bridge. Disable dollar-math (if you use another math plugin) and conceal directive fences for a cleaner editing experience.
