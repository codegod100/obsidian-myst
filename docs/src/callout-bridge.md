# Callout Bridge

The callout bridge connects Obsidian's native callout syntax to MyST admonitions. When enabled, existing callouts get MyST semantic classes and labels, making them equivalent to MyST directive admonitions.

## How it works

Obsidian callouts use this syntax:

```markdown
> [!note] Important Information
> This is a note callout.
```

With the bridge enabled, the rendered callout gets:

1. **MyST admonition classes**: `myst-admonition`, `myst-admonition-note`
2. **A data attribute**: `data-myst-directive="note"`
3. **A label**: `{note}` appears next to the callout icon

This means the callout is semantically identical to:

```markdown
:::{note} Important Information
This is a note callout.
:::
```

## Mapping table

The bridge maps 15 Obsidian callout types to MyST admonition classes:

| Obsidian Callout | MyST Admonition |
|-----------------|-----------------|
| `note` | `note` |
| `info` | `info` |
| `tip` | `tip` |
| `success` | `success` |
| `question` | `question` |
| `warning` | `warning` |
| `failure` | `failure` |
| `danger` | `danger` |
| `bug` | `bug` |
| `example` | `example` |
| `quote` | `quote` |
| `abstract` | `abstract` |
| `todo` | `todo` |
| `important` | `important` |
| `caution` | `caution` |

Custom callout types (not in the table) pass through as-is — they still get `myst-admonition` and `myst-admonition-{type}` classes, just without a known mapping.

## Bidirectional conversion

The plugin provides utility functions for converting between the two formats:

### Callout → Directive

```typescript
calloutToDirective("warning", "Deprecation", "This API is deprecated.")
// → ":::{warning} Deprecation\nThis API is deprecated.\n:::"
```

### Directive → Callout

```typescript
directiveToCallout("warning", "Deprecation", "This API is deprecated.")
// → "> [!warning] Deprecation\n> This API is deprecated."
```

These are available as exported functions from the plugin's shared module for use in scripts or other plugins.

## Styling

The bridge adds CSS classes that you can target for custom styling:

```css
/* Style all MyST-adorned callouts */
.myst-admonition {
  border-left-width: 4px;
}

/* Style a specific admonition type */
.myst-admonition-warning {
  border-left-color: #ff9800;
}

/* Hide the MyST label if you don't want it */
.myst-admonition-label {
  display: none;
}
```

## When to use callouts vs directives

- **Use callouts** when you want Obsidian-native folding, collapsibility, and consistent callout styling
- **Use directives** when you want full MyST compatibility, options, and structured rendering
- **The bridge** lets you use either syntax and get MyST semantics on both
