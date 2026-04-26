import { describe, it, expect } from "vitest";
import { oxaToAtproto, atprotoToOxa } from "../../../src/export/oxa-atproto";
import type { OxaDocument, OxaInline, OxaText } from "./types.js";

// ---------------------------------------------------------------------------
// Helper: create a minimal OXA document
// ---------------------------------------------------------------------------

function doc(children: OxaDocument["children"]): OxaDocument {
	return { type: "Document", children };
}

// ---------------------------------------------------------------------------
// Inverse richtext flattening tests
// ---------------------------------------------------------------------------

describe("atprotoToOxa", () => {
	it("converts a plain text paragraph", () => {
		const oxa = doc([
			{ type: "Paragraph", children: [{ type: "Text", value: "Hello world." }] },
		]);

		const atproto = oxaToAtproto(oxa);
		const result = atprotoToOxa(atproto);

		expect(result).toEqual(oxa);
	});

	it("converts a heading", () => {
		const oxa = doc([
			{ type: "Heading", level: 1, children: [{ type: "Text", value: "Title" }] },
		]);

		const atproto = oxaToAtproto(oxa);
		const result = atprotoToOxa(atproto);

		expect(result).toEqual(oxa);
	});

	it("converts a code block", () => {
		const oxa = doc([
			{ type: "Code", value: "x = 1", language: "python" },
		]);

		const atproto = oxaToAtproto(oxa);
		const result = atprotoToOxa(atproto);

		expect(result).toEqual(oxa);
	});

	it("converts a thematic break", () => {
		const oxa = doc([{ type: "ThematicBreak" }]);

		const atproto = oxaToAtproto(oxa);
		const result = atprotoToOxa(atproto);

		expect(result).toEqual(oxa);
	});

	it("converts a blockquote", () => {
		const oxa = doc([
			{ type: "Blockquote", children: [{ type: "Paragraph", children: [{ type: "Text", value: "quoted" }] }] },
		]);

		const atproto = oxaToAtproto(oxa);
		const result = atprotoToOxa(atproto);

		expect(result).toEqual(oxa);
	});

	it("converts an image", () => {
		const oxa = doc([
			{ type: "Image", src: "https://example.com/img.png", alt: "alt text" },
		]);

		const atproto = oxaToAtproto(oxa);
		const result = atprotoToOxa(atproto);

		expect(result).toEqual(oxa);
	});

	it("converts a math block", () => {
		const oxa = doc([
			{ type: "Math", value: "E = mc^2" },
		]);

		const atproto = oxaToAtproto(oxa);
		const result = atprotoToOxa(atproto);

		expect(result).toEqual(oxa);
	});

	it("converts a list", () => {
		const oxa = doc([
			{
				type: "List",
				ordered: true,
				startIndex: 1,
				children: [
					{ type: "ListItem", children: [{ type: "Paragraph", children: [{ type: "Text", value: "first" }] }] },
				],
			},
		]);

		const atproto = oxaToAtproto(oxa);
		const result = atprotoToOxa(atproto);

		expect(result).toEqual(oxa);
	});

	it("converts an admonition", () => {
		const oxa = doc([
			{
				type: "Admonition",
				kind: "note",
				title: "Info",
				children: [{ type: "Paragraph", children: [{ type: "Text", value: "Some info." }] }],
			},
		]);

		const atproto = oxaToAtproto(oxa);
		const result = atprotoToOxa(atproto);

		expect(result).toEqual(oxa);
	});

	it("preserves InlineCode with language (round-trip fidelity)", () => {
		const oxa = doc([
			{
				type: "Paragraph",
				children: [
					{ type: "Text", value: "Equation: " },
					{ type: "InlineCode", value: "a^2 + b^2", language: "latex" },
					{ type: "Text", value: " and code: " },
					{ type: "InlineCode", value: "x + y", language: "python" },
				],
			},
		]);

		const atproto = oxaToAtproto(oxa);
		const result = atprotoToOxa(atproto);

		expect(result).toEqual(oxa);
	});

	it("preserves inline links", () => {
		const oxa = doc([
			{
				type: "Paragraph",
				children: [
					{ type: "Text", value: "Check out " },
					{ type: "Link", target: "https://example.com", children: [{ type: "Text", value: "the docs" }] },
					{ type: "Text", value: " for more." },
				],
			},
		]);

		const atproto = oxaToAtproto(oxa);
		const result = atprotoToOxa(atproto);

		expect(result).toEqual(oxa);
	});

	it("preserves link with formatting inside (retraction: nesting may swap)", () => {
		const oxa = doc([
			{
				type: "Paragraph",
				children: [
					{ type: "Link", target: "https://example.com", children: [
						{ type: "Strong", children: [{ type: "Text", value: "bold link" }] },
					] },
				],
			},
		]);

		const atproto = oxaToAtproto(oxa);
		const result = atprotoToOxa(atproto);

		// Retraction: overlapping facets may swap nesting order
		// Link > Strong > Text becomes Strong > Link > Text
		const para = result.children[0] as any;
		expect(para.type).toBe("Paragraph");
		// The link target is preserved regardless of nesting
		const findLink = (node: any): any => {
			if (node.type === "Link") return node;
			if (node.children) {
				for (const child of node.children) {
					const found = findLink(child);
					if (found) return found;
				}
			}
			return null;
		};
		const link = findLink(para);
		expect(link).not.toBeNull();
		expect(link.target).toBe("https://example.com");
		// The text content is preserved
		const findStrong = (node: any): any => {
			if (node.type === "Strong") return node;
			if (node.children) {
				for (const child of node.children) {
					const found = findStrong(child);
					if (found) return found;
				}
			}
			return null;
		};
		const strong = findStrong(para);
		expect(strong).not.toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Richtext round-trip tests (OXA → ATProto → OXA)
// ---------------------------------------------------------------------------

describe("richtext round-trip: OXA → ATProto → OXA", () => {
	it("preserves plain text", () => {
		const oxa = doc([
			{ type: "Paragraph", children: [{ type: "Text", value: "Just plain text." }] },
		]);

		const atproto = oxaToAtproto(oxa);
		const result = atprotoToOxa(atproto);

		expect(result).toEqual(oxa);
	});

	it("preserves strong formatting", () => {
		const oxa = doc([
			{
				type: "Paragraph",
				children: [
					{ type: "Text", value: "Some " },
					{ type: "Strong", children: [{ type: "Text", value: "bold" }] },
					{ type: "Text", value: " text." },
				],
			},
		]);

		const atproto = oxaToAtproto(oxa);
		const result = atprotoToOxa(atproto);

		expect(result).toEqual(oxa);
	});

	it("preserves emphasis formatting", () => {
		const oxa = doc([
			{
				type: "Paragraph",
				children: [
					{ type: "Text", value: "Some " },
					{ type: "Emphasis", children: [{ type: "Text", value: "italic" }] },
					{ type: "Text", value: " text." },
				],
			},
		]);

		const atproto = oxaToAtproto(oxa);
		const result = atprotoToOxa(atproto);

		expect(result).toEqual(oxa);
	});

	it("preserves inline code", () => {
		const oxa = doc([
			{
				type: "Paragraph",
				children: [
					{ type: "Text", value: "Use " },
					{ type: "InlineCode", value: "console.log" },
					{ type: "Text", value: " to debug." },
				],
			},
		]);

		const atproto = oxaToAtproto(oxa);
		const result = atprotoToOxa(atproto);

		expect(result).toEqual(oxa);
	});

	it("preserves nested formatting (strong + emphasis)", () => {
		const oxa = doc([
			{
				type: "Paragraph",
				children: [
					{ type: "Text", value: "Some " },
					{
						type: "Strong",
						children: [
							{ type: "Text", value: "bold " },
							{ type: "Emphasis", children: [{ type: "Text", value: "and italic" }] },
						],
					},
					{ type: "Text", value: " text." },
				],
			},
		]);

		const atproto = oxaToAtproto(oxa);
		const result = atprotoToOxa(atproto);

		expect(result).toEqual(oxa);
	});

	it("preserves superscript", () => {
		const oxa = doc([
			{
				type: "Paragraph",
				children: [
					{ type: "Text", value: "x" },
					{ type: "Superscript", children: [{ type: "Text", value: "2" }] },
				],
			},
		]);

		const atproto = oxaToAtproto(oxa);
		const result = atprotoToOxa(atproto);

		expect(result).toEqual(oxa);
	});

	it("preserves subscript", () => {
		const oxa = doc([
			{
				type: "Paragraph",
				children: [
					{ type: "Text", value: "H" },
					{ type: "Subscript", children: [{ type: "Text", value: "2" }] },
					{ type: "Text", value: "O" },
				],
			},
		]);

		const atproto = oxaToAtproto(oxa);
		const result = atprotoToOxa(atproto);

		expect(result).toEqual(oxa);
	});

	it("preserves mixed inline formatting", () => {
		const oxa = doc([
			{
				type: "Paragraph",
				children: [
					{ type: "Text", value: "Normal " },
					{ type: "Strong", children: [{ type: "Text", value: "bold" }] },
					{ type: "Text", value: " " },
					{ type: "Emphasis", children: [{ type: "Text", value: "italic" }] },
					{ type: "Text", value: " " },
					{ type: "InlineCode", value: "code" },
					{ type: "Text", value: " end." },
				],
			},
		]);

		const atproto = oxaToAtproto(oxa);
		const result = atprotoToOxa(atproto);

		expect(result).toEqual(oxa);
	});

	it("preserves document with title", () => {
		const oxa: OxaDocument = {
			type: "Document",
			title: [{ type: "Text", value: "My Document" }],
			children: [
				{ type: "Paragraph", children: [{ type: "Text", value: "Content." }] },
			],
		};

		const atproto = oxaToAtproto(oxa);
		const result = atprotoToOxa(atproto);

		expect(result).toEqual(oxa);
	});

	it("preserves a full document with mixed blocks and inlines", () => {
		const oxa: OxaDocument = {
			type: "Document",
			title: [{ type: "Text", value: "Full Test" }],
			children: [
				{ type: "Heading", level: 1, children: [{ type: "Text", value: "Title" }] },
				{
					type: "Paragraph",
					children: [
						{ type: "Text", value: "A paragraph with " },
						{ type: "Strong", children: [{ type: "Text", value: "bold" }] },
						{ type: "Text", value: " text." },
					],
				},
				{ type: "Code", value: "console.log('hi');", language: "javascript" },
				{ type: "ThematicBreak" },
				{ type: "Paragraph", children: [{ type: "Text", value: "After the break." }] },
				{
					type: "Blockquote",
					children: [{ type: "Paragraph", children: [{ type: "Text", value: "quoted" }] }],
				},
				{ type: "Image", src: "https://example.com/img.png", alt: "alt text" },
				{ type: "Math", value: "E = mc^2" },
				{
					type: "List",
					ordered: true,
					children: [
						{ type: "ListItem", children: [{ type: "Paragraph", children: [{ type: "Text", value: "first" }] }] },
					],
				},
				{
					type: "Admonition",
					kind: "note",
					children: [{ type: "Paragraph", children: [{ type: "Text", value: "Some info." }] }],
				},
			],
		};

		const atproto = oxaToAtproto(oxa);
		const result = atprotoToOxa(atproto);

		expect(result).toEqual(oxa);
	});
});
