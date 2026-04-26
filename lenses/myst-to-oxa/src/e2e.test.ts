import { describe, it, expect } from "vitest";
import { parseMyst } from "../../../src/export/myst-parser";
import { convertMystToOxa } from "./converter.js";
import { oxaToAtproto, atprotoToOxa } from "../../../src/export/oxa-atproto";
import { convertOxaToMyst } from "./inverse.js";

function roundTrip(markdown: string) {
	const myst = parseMyst(markdown);
	const oxa = convertMystToOxa(myst);
	const atproto = oxaToAtproto(oxa);
	const oxa2 = atprotoToOxa(atproto);
	const myst2 = convertOxaToMyst(oxa2);
	return { myst, oxa, atproto, oxa2, myst2 };
}

describe("end-to-end: markdown → MyST → OXA → ATProto → OXA → MyST", () => {
	it("round-trips dollar math with language tag", () => {
		const markdown = `The Pythagorean theorem is $a^2 + b^2 = c^2$ hello

Inline math: $E = mc^2$`;

		const { myst2 } = roundTrip(markdown);

		const para1 = myst2.children[0] as any;
		expect(para1.type).toBe("paragraph");
		expect(para1.children[1].type).toBe("role");
		expect(para1.children[1].name).toBe("math");
		expect(para1.children[1].content).toBe("a^2 + b^2 = c^2");

		const para2 = myst2.children[1] as any;
		expect(para2.type).toBe("paragraph");
		expect(para2.children[1].type).toBe("role");
		expect(para2.children[1].name).toBe("math");
		expect(para2.children[1].content).toBe("E = mc^2");
	});

	it("round-trips display math as math_block", () => {
		const markdown = `$$
\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$`;

		const { myst2 } = roundTrip(markdown);

		expect(myst2.children[0].type).toBe("math_block");
		expect((myst2.children[0] as any).value).toContain("\\int_0");
	});

	it("round-trips code-block directive with options", () => {
		const markdown = `:::{code-block} python
:caption: hello.py

print("Hello, world!")
:::`;

		const { myst2 } = roundTrip(markdown);

		const dir = myst2.children[0] as any;
		expect(dir.type).toBe("directive");
		expect(dir.name).toBe("code-block");
		expect(dir.argument).toBe("python");
		expect(dir.options.caption).toBe("hello.py");
	});

	it("round-trips math directive with label", () => {
		const markdown = `:::{math}
:label: euler

e^{i\\pi} + 1 = 0
:::`;

		const { myst2 } = roundTrip(markdown);

		const dir = myst2.children[0] as any;
		expect(dir.type).toBe("directive");
		expect(dir.name).toBe("math");
		expect(dir.options.label).toBe("euler");
	});

	it("round-trips normal markdown formatting", () => {
		const markdown = `Some **bold** and *italic* and \`code\` text.

> A blockquote.

- list item`;

		const { myst2 } = roundTrip(markdown);

		const para = myst2.children[0] as any;
		expect(para.children[1].type).toBe("strong");
		expect(para.children[3].type).toBe("emphasis");
		expect(para.children[5].type).toBe("inline_code");

		expect(myst2.children[1].type).toBe("blockquote");
		expect(myst2.children[2].type).toBe("unordered_list");
	});

	it("full round-trip matches original for the real document", () => {
		const markdown = `:::{note}
This is a MyST note admonition.
:::

The Pythagorean theorem is $a^2 + b^2 = c^2$ hello

Inline math: $E = mc^2$

$$
\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

test

:::{warning} Deprecation Notice
This API will be removed in v2.
:::

:::{code-block} python
:caption: hello.py

print("Hello, world!")
:::

:::{math}
:label: euler

e^{i\\pi} + 1 = 0
:::`;

		const { myst2 } = roundTrip(markdown);

		expect(myst2.children[0].type).toBe("directive");
		expect((myst2.children[0] as any).name).toBe("note");

		const para = myst2.children[1] as any;
		expect(para.children[1].type).toBe("role");
		expect(para.children[1].name).toBe("math");

		expect(myst2.children[3].type).toBe("math_block");

		const codeDir = myst2.children.find((c: any) => c.type === "directive" && c.name === "code-block") as any;
		expect(codeDir).toBeDefined();
		expect(codeDir.options.caption).toBe("hello.py");

		const mathDir = myst2.children.find((c: any) => c.type === "directive" && c.name === "math") as any;
		expect(mathDir).toBeDefined();
		expect(mathDir.options.label).toBe("euler");
	});

	// --- New features ---

	it("round-trips YAML frontmatter (title, subtitle, metadata)", () => {
		const markdown = `---
title: Working with MyST Markdown
subtitle: A live demo
license: CC-BY-4.0
---

Some content here.`;

		const { myst, myst2 } = roundTrip(markdown);

		// Parser extracts title from frontmatter
		expect(myst.title).toBe("Working with MyST Markdown");
		expect(myst.metadata?.subtitle).toBe("A live demo");
		expect(myst.metadata?.license).toBe("CC-BY-4.0");

		// Round-trip preserves title and metadata
		expect(myst2.title).toBe("Working with MyST Markdown");
		expect(myst2.metadata?.subtitle).toBe("A live demo");
		expect(myst2.metadata?.license).toBe("CC-BY-4.0");
	});

	it("round-trips frontmatter with array values", () => {
		const markdown = `---
title: Test Document
authors:
  - Alice
  - Bob
---

Content here.`;

		const { myst, myst2 } = roundTrip(markdown);

		expect(myst.title).toBe("Test Document");
		expect(myst.metadata?.authors).toEqual(["Alice", "Bob"]);

		expect(myst2.title).toBe("Test Document");
		expect(myst2.metadata?.authors).toEqual(["Alice", "Bob"]);
	});

	it("round-trips inline links [text](url)", () => {
		const markdown = `Check out [the docs](https://example.com) for more info.`;

		const { myst, myst2 } = roundTrip(markdown);

		const para = myst.children[0] as any;
		expect(para.children[1].type).toBe("link");
		expect(para.children[1].target).toBe("https://example.com");
		expect(para.children[1].children[0].value).toBe("the docs");

		const para2 = myst2.children[0] as any;
		expect(para2.children[1].type).toBe("link");
		expect(para2.children[1].target).toBe("https://example.com");
		expect(para2.children[1].children[0].value).toBe("the docs");
	});

	it("round-trips reference-style links [text][ref]", () => {
		const markdown = `Check out [the docs][ref-id] for more info.

[ref-id]: https://example.com`;

		const { myst, myst2 } = roundTrip(markdown);

		const para = myst.children[0] as any;
		expect(para.children[1].type).toBe("link");
		expect(para.children[1].target).toBe("https://example.com");

		const para2 = myst2.children[0] as any;
		expect(para2.children[1].type).toBe("link");
		expect(para2.children[1].target).toBe("https://example.com");
	});

	it("round-trips list-table directive with body", () => {
		const markdown = `:::{list-table} This is a nice table!
:header-rows: 1
:name: example-table

* - Training
  - Validation
* - 0
  - 5
:::`;

		const { myst, myst2 } = roundTrip(markdown);

		const dir = myst.children[0] as any;
		expect(dir.type).toBe("directive");
		expect(dir.name).toBe("list-table");
		expect(dir.argument).toBe("This is a nice table!");
		expect(dir.options["header-rows"]).toBe("1");
		expect(dir.options.name).toBe("example-table");
		// Raw-body directive: body is the grid table text, no children
		expect(dir.body).toContain("* - Training");
		expect(dir.children).toBeUndefined();

		const dir2 = myst2.children[0] as any;
		expect(dir2.type).toBe("directive");
		expect(dir2.name).toBe("list-table");
		expect(dir2.argument).toBe("This is a nice table!");
		expect(dir2.options["header-rows"]).toBe("1");
		expect(dir2.options.name).toBe("example-table");
		expect(dir2.body).toContain("* - Training");
	});

	it("raw-body directives have no children", () => {
		const markdown = `:::{math}
:label: euler

e^{i\\pi} + 1 = 0
:::`;

		const { myst } = roundTrip(markdown);

		const dir = myst.children[0] as any;
		expect(dir.type).toBe("directive");
		expect(dir.name).toBe("math");
		expect(dir.body).toBe("e^{i\\pi} + 1 = 0");
		expect(dir.children).toBeUndefined();
	});

	it("parsed-body directives have children", () => {
		const markdown = `:::{note}
This is a note.
:::`;

		const { myst } = roundTrip(markdown);

		const dir = myst.children[0] as any;
		expect(dir.type).toBe("directive");
		expect(dir.name).toBe("note");
		expect(dir.children).toBeDefined();
		expect(dir.children.length).toBeGreaterThan(0);
	});

	it("round-trips note directive with :class: dropdown", () => {
		const markdown = `:::{note}
:class: dropdown
This is initially hidden.
:::`;

		const { myst2 } = roundTrip(markdown);

		const dir = myst2.children[0] as any;
		expect(dir.type).toBe("directive");
		expect(dir.name).toBe("note");
		expect(dir.options.class).toBe("dropdown");
	});
});
