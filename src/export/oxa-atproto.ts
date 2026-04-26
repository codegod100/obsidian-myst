/**
 * Convert OXA tree-model document to ATProto flat record format.
 *
 * Inlined from @oxa/core's convert.ts to avoid pulling in ajv, js-yaml,
 * and workspace deps that complicate esbuild bundling.
 *
 * The output is a `pub.oxa.document` record with flat richtext blocks
 * (text + facets with byte offsets) instead of nested inline trees.
 */

import type {
	OxaDocument,
	OxaBlock,
	OxaInline,
	OxaText,
	OxaStrong,
	OxaEmphasis,
	OxaInlineCode,
	OxaSuperscript,
	OxaSubscript,
	OxaBlockBase,
} from "../../lenses/myst-to-oxa/src/types";

// ---------------------------------------------------------------------------
// ATProto flat-model types
// ---------------------------------------------------------------------------

interface FacetFeature {
	$type: string;
	[key: string]: unknown;
}

interface Facet {
	index: {
		byteStart: number;
		byteEnd: number;
	};
	features: FacetFeature[];
}

interface RichText {
	text: string;
	facets: Facet[];
}

type AtprotoParagraph = RichText &
	OxaBlockBase & {
		$type: "pub.oxa.blocks.defs#paragraph";
	};

type AtprotoHeading = RichText &
	OxaBlockBase & {
		$type: "pub.oxa.blocks.defs#heading";
		level: number;
	};

type AtprotoCode = OxaBlockBase & {
	$type: "pub.oxa.blocks.defs#code";
	value: string;
	language?: string;
};

type AtprotoThematicBreak = OxaBlockBase & {
	$type: "pub.oxa.blocks.defs#thematicBreak";
};

type AtprotoBlock = AtprotoParagraph | AtprotoHeading | AtprotoCode | AtprotoThematicBreak;

export interface AtprotoDocument {
	$type: "pub.oxa.document";
	title?: RichText;
	metadata?: Record<string, unknown>;
	children: AtprotoBlock[];
	createdAt: string;
}

// ---------------------------------------------------------------------------
// Facet feature mapping
// ---------------------------------------------------------------------------

const facetFeatureTypes: Record<string, string> = {
	Strong: "pub.oxa.richtext.facet#strong",
	Emphasis: "pub.oxa.richtext.facet#emphasis",
	Superscript: "pub.oxa.richtext.facet#superscript",
	Subscript: "pub.oxa.richtext.facet#subscript",
	InlineCode: "pub.oxa.richtext.facet#inlineCode",
};

/**
 * Compatible facet features from other AT Protocol namespaces.
 * Emits both OXA and Leaflet features for interoperability.
 */
const compatibleFeatures: Record<string, Array<() => FacetFeature | null>> = {
	"pub.oxa.richtext.facet#strong": [() => ({ $type: "pub.leaflet.richtext.facet#bold" })],
	"pub.oxa.richtext.facet#emphasis": [() => ({ $type: "pub.leaflet.richtext.facet#italic" })],
	"pub.oxa.richtext.facet#inlineCode": [() => ({ $type: "pub.leaflet.richtext.facet#code" })],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

function byteLength(text: string): number {
	return encoder.encode(text).byteLength;
}

function getCurrentByteOffset(richText: RichText): number {
	return byteLength(richText.text);
}

function createFacet(
	nodeType: string,
	byteStart: number,
	byteEnd: number,
): Facet {
	const oxaType = facetFeatureTypes[nodeType];
	if (!oxaType) return { index: { byteStart, byteEnd }, features: [] };

	const features: FacetFeature[] = [{ $type: oxaType }];
	const compat = compatibleFeatures[oxaType];
	if (compat) {
		for (const toFeature of compat) {
			const extra = toFeature();
			if (extra) features.push(extra);
		}
	}

	return { index: { byteStart, byteEnd }, features };
}

function copyBlockProps(block: OxaBlockBase): OxaBlockBase {
	const result: OxaBlockBase = {};
	if (block.id !== undefined) result.id = block.id;
	if (block.classes !== undefined) result.classes = block.classes;
	if (block.data !== undefined) result.data = block.data;
	return result;
}

// ---------------------------------------------------------------------------
// Inline flattening (OXA tree → flat richtext)
// ---------------------------------------------------------------------------

type FormattingNode = OxaStrong | OxaEmphasis | OxaSuperscript | OxaSubscript;

function flattenNode(node: OxaInline, richText: RichText): void {
	if (node.type === "Text") {
		richText.text += (node as OxaText).value;
		return;
	}

	if (node.type === "InlineCode") {
		const byteStart = getCurrentByteOffset(richText);
		richText.text += (node as OxaInlineCode).value;
		const byteEnd = getCurrentByteOffset(richText);
		richText.facets.push(createFacet("InlineCode", byteStart, byteEnd));
		return;
	}

	// Formatting nodes (Strong, Emphasis, Superscript, Subscript)
	const fmt = node as FormattingNode;
	const byteStart = getCurrentByteOffset(richText);

	for (const child of fmt.children) {
		flattenNode(child, richText);
	}

	const byteEnd = getCurrentByteOffset(richText);
	richText.facets.push(createFacet(fmt.type, byteStart, byteEnd));
}

function flattenInlines(inlines: OxaInline[]): RichText {
	const richText: RichText = { text: "", facets: [] };
	for (const inline of inlines) {
		flattenNode(inline, richText);
	}
	return richText;
}

// ---------------------------------------------------------------------------
// Block mapping
// ---------------------------------------------------------------------------

function mapBlockRichText(block: { children: OxaInline[] } & OxaBlockBase): OxaBlockBase & RichText {
	return {
		...copyBlockProps(block),
		...flattenInlines(block.children),
	};
}

function mapCodeBlock(block: OxaBlock & { value: string; language?: string }): AtprotoCode {
	const result: AtprotoCode = {
		$type: "pub.oxa.blocks.defs#code",
		...copyBlockProps(block),
		value: block.value,
	};
	if (block.language !== undefined) {
		result.language = block.language;
	}
	return result;
}

function mapBlock(block: OxaBlock): AtprotoBlock | undefined {
	switch (block.type) {
		case "Paragraph": {
			const richText = mapBlockRichText(block as OxaBlock & { children: OxaInline[] });
			return { $type: "pub.oxa.blocks.defs#paragraph", ...richText };
		}
		case "Heading": {
			const richText = mapBlockRichText(block as OxaBlock & { children: OxaInline[] });
			return {
				$type: "pub.oxa.blocks.defs#heading",
				...richText,
				level: (block as OxaBlock & { level: number }).level,
			};
		}
		case "Code":
			return mapCodeBlock(block as OxaBlock & { value: string; language?: string });
		case "ThematicBreak":
			return { $type: "pub.oxa.blocks.defs#thematicBreak", ...copyBlockProps(block) };
		default:
			return undefined;
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface OxaToAtprotoOptions {
	createdAt?: string;
}

/**
 * Convert an OXA tree-model document to an ATProto flat record.
 *
 * @param document - OXA tree-model document.
 * @param options - Optional createdAt timestamp.
 * @returns ATProto flat record ready for `com.atproto.repo.putRecord`.
 */
export function oxaToAtproto(
	document: OxaDocument,
	options: OxaToAtprotoOptions = {},
): AtprotoDocument {
	const children: AtprotoBlock[] = [];

	for (const block of document.children) {
		const mapped = mapBlock(block);
		if (mapped !== undefined) {
			children.push(mapped);
		}
	}

	const result: AtprotoDocument = {
		$type: "pub.oxa.document",
		children,
		createdAt: options.createdAt ?? new Date().toISOString(),
	};

	if (document.title !== undefined) {
		result.title = flattenInlines(document.title);
	}

	if (document.metadata !== undefined) {
		result.metadata = document.metadata;
	}

	return result;
}
