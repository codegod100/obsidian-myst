# Directive Catalog

All known directive names recognized by the plugin.

## Admonitions

| Name | Argument | Options | Body | CSS class |
|------|----------|---------|------|-----------|
| `admonition` | Title | `class` | Yes | `myst-admonition` |
| `note` | Title | — | Yes | `myst-admonition-note` |
| `warning` | Title | — | Yes | `myst-admonition-warning` |
| `danger` | Title | — | Yes | `myst-admonition-danger` |
| `attention` | Title | — | Yes | `myst-admonition-attention` |
| `caution` | Title | — | Yes | `myst-admonition-caution` |
| `important` | Title | — | Yes | `myst-admonition-important` |
| `hint` | Title | — | Yes | `myst-admonition-hint` |
| `tip` | Title | — | Yes | `myst-admonition-tip` |
| `seealso` | Title | — | Yes | `myst-admonition-seealso` |
| `todo` | Title | — | Yes | `myst-admonition-todo` |
| `topic` | Title | — | Yes | `myst-admonition-topic` |
| `sidebar` | Title | — | Yes | `myst-admonition-sidebar` |
| `margin` | Title | — | Yes | `myst-admonition-margin` |
| `error` | Title | — | Yes | `myst-admonition-error` |
| `dropdown` | Title | `open` | Yes | `myst-admonition-dropdown` |

## Content

| Name | Argument | Options | Body | Notes |
|------|----------|---------|------|-------|
| `figure` | Image path | `alt`, `width`, `height`, `align` | Caption | Image with caption |
| `image` | Image path | `alt`, `width`, `height` | No | Inline image |
| `table` | — | `align`, `widths` | Table data | RST-style table |
| `list-table` | — | `header-rows`, `widths` | List items | List-based table |
| `csv-table` | — | `header`, `delim`, `quotechar` | CSV data | CSV table |
| `code-block` | Language | `caption`, `linenos`, `emphasize-lines` | Code | Syntax-highlighted code |
| `code-cell` | Language | `tags` | Code | Executable code cell |
| `math` | — | `label` | LaTeX | Display math with label |
| `mermaid` | — | — | Mermaid code | Mermaid diagram |

## Layout

| Name | Argument | Options | Body | Notes |
|------|----------|---------|------|-------|
| `tab-set` | — | — | Tab items | Container for tabs |
| `tab-item` | Tab label | `sync` | Tab content | Individual tab |
| `grid` | Column spec | `gutter` | Cards/items | Grid layout |
| `card` | Title | `link`, `img` | Card content | Card component |
| `dropdown` | Title | `open` | Content | Collapsible section |

## Misc

| Name | Argument | Options | Body | Notes |
|------|----------|---------|------|-------|
| `include` | File path | `start-line`, `end-line` | No | Include external file |
| `iframe` | URL | `width`, `height` | No | Embedded iframe |
| `embed` | URL | — | No | Embedded content |
| `pull-quote` | — | — | Quote text | Pull quote |
| `epigraph` | — | `attribution` | Quote | Epigraph |
| `highlights` | — | — | Content | Highlights block |
| `ifconfig` | — | `expr` | Content | Conditional content |
