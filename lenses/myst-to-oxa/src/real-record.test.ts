import { describe, it, expect } from "vitest";
import { atprotoToOxa } from "../../../src/export/oxa-atproto";
import { convertOxaToMyst } from "./inverse.js";
import type { AtprotoDocument } from "../../../src/export/oxa-atproto";

// Real record from nandi's PDS
const record = {
	$type: "pub.oxa.document" as const,
	children: [
		{ kind: "note", $type: "pub.oxa.blocks.defs#admonition", children: [{ text: "This is a MyST note admonition.", $type: "pub.oxa.blocks.defs#paragraph", facets: [] }] },
		{ text: "The Pythagorean theorem is a^2 + b^2 = c^2 hello", $type: "pub.oxa.blocks.defs#paragraph", facets: [{ index: { byteEnd: 42, byteStart: 27 }, features: [{ $type: "pub.oxa.richtext.facet#inlineCode" }, { $type: "pub.leaflet.richtext.facet#code" }] }] },
		{ text: "Inline math: E = mc^2", $type: "pub.oxa.blocks.defs#paragraph", facets: [{ index: { byteEnd: 21, byteStart: 13 }, features: [{ $type: "pub.oxa.richtext.facet#inlineCode" }, { $type: "pub.leaflet.richtext.facet#code" }] }] },
		{ text: "Display math:\n$\n\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}\n$", $type: "pub.oxa.blocks.defs#paragraph", facets: [{ index: { byteEnd: 65, byteStart: 15 }, features: [{ $type: "pub.oxa.richtext.facet#inlineCode" }, { $type: "pub.leaflet.richtext.facet#code" }] }] },
		{ text: "test", $type: "pub.oxa.blocks.defs#paragraph", facets: [] },
		{ $type: "pub.oxa.blocks.defs#blockquote", children: [{ text: "[!warning] Deprecation Notice\nThis API will be removed in v2.", $type: "pub.oxa.blocks.defs#paragraph", facets: [] }] },
		{ kind: "warning", $type: "pub.oxa.blocks.defs#admonition", title: "Deprecation Notice", children: [{ text: "This API will be removed in v2.", $type: "pub.oxa.blocks.defs#paragraph", facets: [] }] },
		{ kind: "note", $type: "pub.oxa.blocks.defs#admonition", children: [{ text: "A note with useful information.", $type: "pub.oxa.blocks.defs#paragraph", facets: [] }] },
		{ kind: "warning", $type: "pub.oxa.blocks.defs#admonition", title: "Watch out", children: [{ text: "This is a warning with a title.", $type: "pub.oxa.blocks.defs#paragraph", facets: [] }] },
		{ kind: "danger", $type: "pub.oxa.blocks.defs#admonition", children: [{ text: "This is dangerous.", $type: "pub.oxa.blocks.defs#paragraph", facets: [] }] },
		{ alt: "A diagram", src: "image.png", data: { alt: "A diagram", width: "80%", caption: "Caption text below the figure." }, $type: "pub.oxa.blocks.defs#image" },
		{ $type: "pub.oxa.blocks.defs#code", value: 'print("Hello, world!")', language: "python" },
		{ $type: "pub.oxa.blocks.defs#math", value: "e^{i\\pi} + 1 = 0" },
		{ kind: "tab-set", $type: "pub.oxa.blocks.defs#admonition", children: [
			{ kind: "tab-item", $type: "pub.oxa.blocks.defs#admonition", title: "Tab 1", children: [{ text: "Tab one", $type: "pub.oxa.blocks.defs#paragraph", facets: [] }] },
			{ kind: "tab-item", $type: "pub.oxa.blocks.defs#admonition", title: "Tab 2", children: [{ text: "Tab two", $type: "pub.oxa.blocks.defs#paragraph", facets: [] }] },
		] },
	],
	createdAt: "2026-04-26T09:38:05.497Z",
};

describe("real record: ATProto → OXA → MyST", () => {
	it("converts the full record to OXA", () => {
		const oxa = atprotoToOxa(record as any);
		console.log("OXA:", JSON.stringify(oxa, null, 2));

		// Verify key blocks
		expect(oxa.type).toBe("Document");
		expect(oxa.children.length).toBe(14);

		// First block: admonition (note)
		expect(oxa.children[0].type).toBe("Admonition");
		expect((oxa.children[0] as any).kind).toBe("note");

		// Second block: paragraph with inline code
		expect(oxa.children[1].type).toBe("Paragraph");

		// Code block
		expect(oxa.children[11].type).toBe("Code");
		expect((oxa.children[11] as any).value).toBe('print("Hello, world!")');
		expect((oxa.children[11] as any).language).toBe("python");

		// Math block
		expect(oxa.children[12].type).toBe("Math");
	});

	it("converts the full record to MyST", () => {
		const oxa = atprotoToOxa(record as any);
		const myst = convertOxaToMyst(oxa);
		console.log("MyST:", JSON.stringify(myst, null, 2));

		expect(myst.type).toBe("document");
		expect(myst.children.length).toBe(14);

		// First block: note directive
		expect(myst.children[0].type).toBe("directive");
		expect((myst.children[0] as any).name).toBe("note");

		// Code block
		expect(myst.children[11].type).toBe("code_block");
		expect((myst.children[11] as any).value).toBe('print("Hello, world!")');
		expect((myst.children[11] as any).language).toBe("python");

		// Math block
		expect(myst.children[12].type).toBe("math_block");

		// Figure directive (from image with caption data)
		expect(myst.children[10].type).toBe("directive");
		expect((myst.children[10] as any).name).toBe("figure");

		// Tab-set (unknown admonition kind)
		expect(myst.children[13].type).toBe("directive");
		expect((myst.children[13] as any).name).toBe("tab-set");
	});
});
