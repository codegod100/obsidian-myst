# Dollar Math

MyST uses dollar-sign delimiters for math, consistent with LaTeX and most markdown math extensions.

## Inline math

Single `$` delimiters for inline expressions:

```markdown
The energy is $E = mc^2$ where $m$ is mass.
```

Renders with monospace italic styling in reading mode.

## Display math

Double `$$` delimiters for block-level equations:

```markdown
$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$
```

Display math is handled by Obsidian's built-in MathJax renderer. The plugin adds MyST-specific CSS classes for consistent styling.

## Currency detection

The plugin skips dollar signs that look like currency:

```markdown
That costs $5.00 and $12.50.
```

These are **not** treated as math — the regex rejects patterns that match `digits.optional-decimal`.

## Interaction with Obsidian's math

Obsidian already renders `$$...$$` display math via MathJax. The plugin's dollar-math post-processor handles cases where Obsidian's remark parser doesn't render the math — specifically `$...$` inline math that might slip through.

If you have another math plugin installed, you may want to disable the dollar-math toggle in settings to avoid conflicts.

## Math via roles

As an alternative to dollar-math, you can use the `{math}` or `{m}` roles:

```markdown
The value is {math}`x^2 + y^2`.
```

See [Roles](./roles.md) for details.
