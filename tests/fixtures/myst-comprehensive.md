---
title: Comprehensive MyST Test
subtitle: Round-trip fixture
license: CC-BY-4.0
authors:
  - Alice
  - Bob
---

# H1

## H2

### H3

#### H4

##### H5

###### H6

## A **bold** heading

Plain paragraph.

**strong text**

*emphasis text*

`inline code`

[link text](https://example.com)

The Pythagorean theorem is $a^2 + b^2 = c^2$ hello

Inline math: $E = mc^2$

x{sup}`2` and H{sub}`n`

{code}`x + y`

Unknown role: {ref}`some-label`

Normal **bold** *italic* `code` [link](https://example.com) end.

***bold italic*** and **bold with `code` inside**

[**bold link**](https://example.com) and [`code link`](https://example.com)

```python
x = 1
```

```
plain text code
```

---

> Simple quote

> >
> Nested quote

> 1. List in quote
> 2. Second item

![alt text](https://example.com/img.png)

![](https://example.com/photo.png)

$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$

3. Third
4. Fourth

- bullet one
- bullet two

:::{note}
A note.
:::

:::{warning} Watch out
A warning with a title.
:::

:::{tip}
A tip.
:::

:::{important}
Important info.
:::

:::{caution}
Be cautious.
:::

:::{attention}
Pay attention.
:::

:::{hint}
A hint.
:::

:::{error}
An error.
:::

:::{danger}
Danger!
:::

:::{seealso}
See also.
:::

:::{admonition} Custom Title
Generic admonition.
:::

:::{note} Details
First paragraph.

Second paragraph.
:::

:::{warning} Requirements
- item one
- item two
:::

:::{note}
:class: dropdown
Initially hidden.
:::

:::{code-block} python
:caption: hello.py

print("Hello, world!")
:::

:::{code-cell} python
x = 1
:::

:::{code-cell} python
:tags: ["hide-input"]

print('hello')
:::

:::{math}
:label: euler

e^{i\pi} + 1 = 0
:::

:::{figure} image.png
:alt: A diagram
:width: 80%

Caption text below the figure.
:::

::::{tab-set}
:::{tab-item} Tab 1
:sync: tab1
Tab one.
:::
:::{tab-item} Tab 2
:sync: tab2
Tab two.
:::
::::

:::{list-table} A nice table
:header-rows: 1
:name: example-table

* - Col A
  - Col B
* - 1
  - 2
:::

:::{custom-directive} Custom Arg
Some custom content.
:::
