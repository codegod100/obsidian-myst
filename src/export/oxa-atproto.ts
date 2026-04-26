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

type AtprotoBlockquote = OxaBlockBase & {
	$type: "pub.oxa.blocks.defs#blockquote";
	children: AtprotoBlock[];
};

type AtprotoImage = OxaBlockBase & {
	$type: "pub.oxa.blocks.defs#image";
	src: string;
	alt?: string;
};

type AtprotoMath = OxaBlockBase & {
	$type: "pub.oxa.blocks.defs#math";
	value: string;
};

type AtprotoList = OxaBlockBase & {
	$type: "pub.oxa.blocks.defs#list";
	ordered: boolean;
	startIndex?: number;
	children: AtprotoListItem[];
};

type AtprotoListItem = OxaBlockBase & {
	$type: "pub.oxa.blocks.defs#listItem";
	children: AtprotoBlock[];
};

type AtprotoAdmonition = OxaBlockBase & {
	$type: "pub.oxa.blocks.defs#admonition";
	kind: string;
	title?: string;
	children: AtprotoBlock[];
};

type AtprotoBlock =
	| AtprotoParagraph
	| AtprotoHeading
	| AtprotoCode
	| AtprotoThematicBreak
	| AtprotoBlockquote
	| AtprotoImage
	| AtprotoMath
	| AtprotoList
	| AtprotoAdmonition;

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

function mapBlocks(blocks: OxaBlock[]): AtprotoBlock[] {
	const result: AtprotoBlock[] = [];
	for (const block of blocks) {
		const mapped = mapBlock(block);
		if (mapped !== undefined) {
			result.push(mapped);
		}
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
		case "Blockquote": {
			const bq = block as OxaBlock & { children: OxaBlock[] };
			return {
				$type: "pub.oxa.blocks.defs#blockquote",
				...copyBlockProps(block),
				children: mapBlocks(bq.children),
			};
		}
		case "Image": {
			const img = block as OxaBlock & { src: string; alt?: string };
			const result: AtprotoImage = {
				$type: "pub.oxa.blocks.defs#image",
				...copyBlockProps(block),
				src: img.src,
			};
			if (img.alt !== undefined) result.alt = img.alt;
			return result;
		}
		case "Math": {
			const math = block as OxaBlock & { value: string };
			return {
				$type: "pub.oxa.blocks.defs#math",
				...copyBlockProps(block),
				value: math.value,
			};
		}
		case "List": {
			const list = block as OxaBlock & { ordered: boolean; startIndex?: number; children: any[] };
			const result: AtprotoList = {
				$type: "pub.oxa.blocks.defs#list",
				...copyBlockProps(block),
				ordered: list.ordered,
				children: list.children.map((item: any) => ({
					$type: "pub.oxa.blocks.defs#listItem",
					...copyBlockProps(item),
					children: mapBlocks(item.children),
				})),
			};
			if (list.startIndex !== undefined) result.startIndex = list.startIndex;
			return result;
		}
		case "Admonition": {
			const adm = block as OxaBlock & { kind: string; title?: string; children: OxaBlock[] };
			const result: AtprotoAdmonition = {
				$type: "pub.oxa.blocks.defs#admonition",
				...copyBlockProps(block),
				kind: adm.kind,
				children: mapBlocks(adm.children),
			};
			if (adm.title !== undefined) result.title = adm.title;
			return result;
		}
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
	const children = mapBlocks(document.children);

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
