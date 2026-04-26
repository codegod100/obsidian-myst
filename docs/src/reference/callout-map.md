# Callout Map

The complete mapping between Obsidian callout types and MyST admonition classes.

## Mapping table

| Obsidian callout | MyST admonition | CSS class |
|-----------------|-----------------|-----------|
| `note` | `note` | `myst-admonition-note` |
| `info` | `info` | `myst-admonition-info` |
| `tip` | `tip` | `myst-admonition-tip` |
| `success` | `success` | `myst-admonition-success` |
| `question` | `question` | `myst-admonition-question` |
| `warning` | `warning` | `myst-admonition-warning` |
| `failure` | `failure` | `myst-admonition-failure` |
| `danger` | `danger` | `myst-admonition-danger` |
| `bug` | `bug` | `myst-admonition-bug` |
| `example` | `example` | `myst-admonition-example` |
| `quote` | `quote` | `myst-admonition-quote` |
| `abstract` | `abstract` | `myst-admonition-abstract` |
| `todo` | `todo` | `myst-admonition-todo` |
| `important` | `important` | `myst-admonition-important` |
| `caution` | `caution` | `myst-admonition-caution` |

## Custom callout types

If you use a callout type not in the table (e.g., `> [!custom-type]`), it passes through as-is:

- Gets `myst-admonition` class
- Gets `myst-admonition-custom-type` class
- Gets `data-myst-directive="custom-type"` attribute
- No `{name}` label is added (since there's no known mapping)

## CSS customization

Each admonition type gets a unique CSS class. Override border colors, backgrounds, or icons:

```css
.myst-admonition-warning {
  border-left-color: #ff9800;
  background: rgba(255, 152, 0, 0.05);
}

.myst-admonition-danger {
  border-left-color: #f44336;
  background: rgba(244, 67, 54, 0.05);
}
```

## Bidirectional conversion

The `callout-map.ts` module provides two conversion functions:

- `calloutToDirective(type, title, body)` — Obsidian callout → MyST directive syntax
- `directiveToCallout(name, argument, body)` — MyST directive → Obsidian callout syntax

Both handle the mapping transparently — if a type isn't in the map, it passes through unchanged.
