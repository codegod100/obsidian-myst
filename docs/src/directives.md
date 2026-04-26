# Directives

Directives are MyST's block-level extension mechanism. They're the equivalent of reStructuredText directives or Markdown extensions — structured blocks with a name, optional argument, options, and body.

## Syntax

A directive is enclosed in `:::` fences with the directive name in braces:

```markdown
:::{directive-name} Argument text
:option-key: option value
:another-key: another value

Body content starts after a blank line.
:::
```

### Parts

| Part | Syntax | Required |
|------|--------|----------|
| **Fence** | `:::{name}` to open, `:::` to close | Yes |
| **Name** | Inside `{braces}` after the opening fence | Yes |
| **Argument** | First line after the fence, before any options | No |
| **Options** | `:key: value` lines before the blank line | No |
| **Body** | Everything after the blank line | No |

### Fenced code block form

Because Obsidian's internal parser (remark/unified) treats `:::` as a code fence, directives also work in the code-block form:

````markdown
```{note}
This is a note admonition.
```
````

The plugin registers code block processors for known directive names (`{note}`, `{warning}`, `{admonition}`, `{figure}`, `{code-block}`, `{math}`, `{dropdown}`, `{tab-set}`, `{tab-item}`, `{mermaid}`).

## Admonition directives

Admonitions are the most common directive type. They render as styled callout-like blocks:

```markdown
:::{note}
A note with useful information.
:::

:::{warning} Watch out
This is a warning with a title.
:::

:::{danger}
This is dangerous.
:::
```

Supported admonition types: `note`, `warning`, `danger`, `attention`, `caution`, `important`, `hint`, `tip`, `seealso`, `todo`, `topic`, `sidebar`, `margin`, `error`, `dropdown`.

Each gets a distinct left-border color in reading mode.

## Content directives

### Figure

```markdown
:::{figure} image.png
:alt: A diagram
:width: 80%

Caption text below the figure.
:::
```

### Code block

```markdown
:::{code-block} python
:caption: hello.py

print("Hello, world!")
:::
```

### Math

```markdown
:::{math}
:label: euler

e^{i\pi} + 1 = 0
:::
```

## Layout directives

### Dropdown

```markdown
:::{dropdown} Click to expand
Hidden content here.
:::
```

### Tab set

```markdown
:::{tab-set}

:::{tab-item} Tab 1
Content for tab 1.
:::

:::{tab-item} Tab 2
Content for tab 2.
:::

:::
```

### Grid / Card

```markdown
:::{grid} 1 2 3 3

:::{card} Card Title
Card content.
:::

:::{card} Another Card
More content.
:::

:::
```

## Options

Options use the `:key: value` syntax, one per line, before the blank line that separates them from the body:

```markdown
:::{figure} photo.jpg
:alt: A sunset
:width: 600px
:align: center

A beautiful sunset over the coast.
:::
```

Options are displayed in a muted key-value list in reading mode.
