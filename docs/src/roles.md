# Roles

Roles are MyST's inline extension mechanism — the inline equivalent of directives. They wrap content in a named construct, similar to reStructuredText interpreted text roles.

## Syntax

```markdown
{role-name}`content`
```

The role name goes in `{braces}`, followed immediately by the content in `` `backticks` ``. No space between the closing brace and the opening backtick.

## Cross-reference roles

| Role | Syntax | Purpose |
|------|--------|---------|
| `ref` | `{ref}`section-label`` | Link to a labeled section |
| `doc` | `{doc}`other-note`` | Link to another document |
| `eq` | `{eq}`euler`` | Reference a labeled equation |
| `numref` | `{numref}`fig-1`` | Reference a numbered figure |
| `label` | `{label}`my-label`` | Define a label target |

## Citation roles

| Role | Syntax | Purpose |
|------|--------|---------|
| `cite` | `{cite}`smith2024`` | Cite a reference |
| `cite:p` | `{cite:p}`smith2024`` | Parenthetical citation |
| `cite:t` | `{cite:t}`smith2024`` | Textual citation |
| `cite:ps` | `{cite:ps}`smith2024`` | Parenthetical, short form |

## Text styling roles

| Role | Syntax | Renders as |
|------|--------|------------|
| `sub` | `{sub}`H2O`` | Subscript: H₂O |
| `sup` | `{sup}`2`` | Superscript: x² |
| `abbr` | `{abbr}`HTML (HyperText Markup Language)`` | Abbreviation with title |
| `code` | `{code}`x = 1`` | Inline code |
| `command` | `{command}`git commit`` | Command name |
| `file` | `{file}`config.yaml`` | File path |
| `kbd` | `{kbd}`Ctrl+S`` | Keyboard shortcut |
| `guilabel` | `{guilabel}`Save`` | GUI label |
| `menuselection` | `{menuselection}`File → Save`` | Menu path |

## Domain roles

For technical documentation (Python, C, etc.):

| Role | Syntax | Purpose |
|------|--------|---------|
| `meth` | `{meth}`MyClass.method`` | Method reference |
| `attr` | `{attr}`MyClass.field`` | Attribute reference |
| `class` | `{class}`MyClass`` | Class reference |
| `func` | `{func}`my_function`` | Function reference |
| `mod` | `{mod}`my_module`` | Module reference |
| `data` | `{data}`MY_CONSTANT`` | Data constant |
| `const` | `{const}`MAX_SIZE`` | Constant |
| `var` | `{var}`counter`` | Variable |
| `exc` | `{exc}`ValueError`` | Exception |
| `obj` | `{obj}`some_object`` | Generic object |

## Math roles

| Role | Syntax | Purpose |
|------|--------|---------|
| `math` | `{math}`x^2`` | Inline math |
| `m` | `{m}`\alpha`` | Short inline math |

## Style roles

| Role | Syntax | Purpose |
|------|--------|---------|
| `strike` | `{strike}`deleted`` | Strikethrough |
| `underline` | `{underline}`important`` | Underlined |
| `small` | `{small}`fine print`` | Small text |
| `big` | `{big}`heading`` | Large text |
| `raw` | `{raw}`<br>`` | Raw HTML passthrough |
| `html` | `{html}`<em>`` | HTML fragment |

## Standard roles

| Role | Syntax | Purpose |
|------|--------|---------|
| `dfn` | `{dfn}`term`` | Definition |
| `term` | `{term}`vocabulary`` | Glossary term |
| `any` | `{any}`target`` | Any reference type |
| `download` | `{download}`file.zip`` | Download link |
| `pep` | `{pep}`8`` | Python PEP reference |
| `rfc` | `{rfc}`2119`` | IETF RFC reference |
| `envvar` | `{envvar}`PATH`` | Environment variable |
| `token` | `{token}`operator`` | Grammar token |
| `keyword` | `{keyword}`if`` | Language keyword |
| `option` | `{option}`--verbose`` | Command-line option |
| `prog` | `{prog}`python`` | Program name |

## Rendering in reading mode

Roles render as inline spans with a muted label and styled content:

```
:math: a^2 + b^2 = c^2
```

The label (`:math:`) appears in small monospace, the content in the normal text color. The whole span gets a subtle background pill.
