import { describe, it, expect } from "vitest";
import { parseMyst } from "../../../src/export/myst-parser";
import { convertMystToOxa } from "./converter.js";
import { oxaToAtproto, atprotoToOxa } from "../../../src/export/oxa-atproto";
import { convertOxaToMyst } from "./inverse.js";

const sandboxMarkdown = `---
title: Working with MyST Markdown
subtitle: A live demo
authors:
  - Rowan Cockett
license: CC-BY-4.0
---

MyST makes Markdown more _extensible_ & **powerful**.

:::{important} Our Values
We believe in a community-driven approach.
:::

Inline $\LaTeX$ and a figure below.

:::{figure} https://picsum.photos/id/640/400/200
:name: my-fig
:alt: Random image

Relaxing at the beach
:::

\`\`\`{math}
:label: maxwell
\\begin{aligned}
\\nabla \\times \\vec{e}+\\frac{\\partial \\vec{b}}{\\partial t}&=0
\\end{aligned}
\`\`\`

:::{list-table} This is a nice table!
:header-rows: 1
:name: example-table

* - Training
  - Validation
* - 0
  - 5
:::

:::{note}
:class: dropdown
This is initially hidden.
:::

[link text][ref-id]

[ref-id]: https://example.com
`;

describe("sandbox document tracing", () => {
	it("parses the sandbox document", () => {
		const myst = parseMyst(sandboxMarkdown);
		expect(myst.type).toBe("document");
		expect(myst.children.length).toBeGreaterThan(0);
		// Frontmatter title
		expect(myst.title).toBe("Working with MyST Markdown");
		// Frontmatter metadata
		expect(myst.metadata?.subtitle).toBe("A live demo");
		expect(myst.metadata?.license).toBe("CC-BY-4.0");
	});

	it("round-trips the sandbox document through ATProto", () => {
		const myst = parseMyst(sandboxMarkdown);
		const oxa = convertMystToOxa(myst);
		const atproto = oxaToAtproto(oxa);
		const oxa2 = atprotoToOxa(atproto);
		const myst2 = convertOxaToMyst(oxa2);

		expect(myst2.type).toBe("document");
		expect(myst2.children.length).toBeGreaterThan(0);

		// Frontmatter round-trips
		expect(myst2.title).toBe("Working with MyST Markdown");
		expect(myst2.metadata?.subtitle).toBe("A live demo");
		expect(myst2.metadata?.license).toBe("CC-BY-4.0");

		// Important admonition with title
		const important = myst2.children.find((c: any) => c.type === "directive" && c.name === "important") as any;
		expect(important).toBeDefined();
		expect(important.argument).toBe("Our Values");

		// Dollar math → {math} role
		const mathPara = myst2.children.find((c: any) =>
			c.type === "paragraph" && c.children?.some((ch: any) => ch.type === "role" && ch.name === "math")
		) as any;
		expect(mathPara).toBeDefined();

		// Figure directive with options
		const figure = myst2.children.find((c: any) => c.type === "directive" && c.name === "figure") as any;
		expect(figure).toBeDefined();
		expect(figure.argument).toBe("https://picsum.photos/id/640/400/200");
		expect(figure.options.name).toBe("my-fig");
		expect(figure.options.alt).toBe("Random image");

		// Math directive with label
		const math = myst2.children.find((c: any) => c.type === "directive" && c.name === "math") as any;
		expect(math).toBeDefined();
		expect(math.options.label).toBe("maxwell");
		expect(math.body).toContain("\\nabla");

		// List-table with body
		const listTable = myst2.children.find((c: any) => c.type === "directive" && c.name === "list-table") as any;
		expect(listTable).toBeDefined();
		expect(listTable.argument).toBe("This is a nice table!");
		expect(listTable.options["header-rows"]).toBe("1");
		expect(listTable.body).toContain("* - Training");

		// Note with :class: dropdown
		const note = myst2.children.find((c: any) => c.type === "directive" && c.name === "note") as any;
		expect(note).toBeDefined();
		expect(note.options.class).toBe("dropdown");

		// Link round-trips
		const linkPara = myst2.children.find((c: any) =>
			c.type === "paragraph" && c.children?.some((ch: any) => ch.type === "link")
		) as any;
		expect(linkPara).toBeDefined();
		const link = linkPara.children.find((ch: any) => ch.type === "link");
		expect(link.target).toBe("https://example.com");
	});
});
