# Quick Start

Enable the plugin and try each feature in a note. Switch to **Reading mode** to see rendered output.

## 1. Write a directive

```markdown
:::{note}
This is a MyST note admonition.
:::
```

In reading mode, this renders as a styled admonition block with a "note" label.

## 2. Write a role

```markdown
The Pythagorean theorem is {math}`a^2 + b^2 = c^2`.
```

In reading mode, `{math}` renders as a labeled inline element with the content styled.

## 3. Write dollar-math

```markdown
Inline math: $E = mc^2$

Display math:
$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$
```

Inline `$...$` renders with monospace italic styling. Display `$$...$$` is handled by Obsidian's existing MathJax.

## 4. See the callout bridge

```markdown
> [!warning] Deprecation Notice
> This API will be removed in v2.
```

With the callout bridge enabled, this callout gets MyST admonition classes and a `{warning}` label, making it semantically equivalent to:

```markdown
:::{warning} Deprecation Notice
This API will be removed in v2.
:::
```

## 5. Check the editor

In **Editing mode** or **Live Preview**, the same syntax gets color-coded:

- Directive fences (`:::`) — purple, bold
- Directive options (`:key: value`) — blue
- Role syntax (`{name}`content``) — cyan
- Dollar-math delimiters (`$`) — orange

All features are enabled by default. Toggle any of them off in **Settings → MyST Markdown**.
