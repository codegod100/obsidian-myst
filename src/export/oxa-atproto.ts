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
	OxaLink,
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
		const code = node as OxaInlineCode;
		const byteStart = getCurrentByteOffset(richText);
		richText.text += code.value;
		const byteEnd = getCurrentByteOffset(richText);
		const facet = createFacet("InlineCode", byteStart, byteEnd);
		// Carry language through the facet for round-trip fidelity
		if (code.language !== undefined) {
			for (const feature of facet.features) {
				if (feature.$type === "pub.oxa.richtext.facet#inlineCode") {
					feature.language = code.language;
				}
			}
		}
		richText.facets.push(facet);
		return;
	}

	if (node.type === "Link") {
		const link = node as OxaLink;
		const byteStart = getCurrentByteOffset(richText);
		// Flatten link text children
		if (link.children) {
			for (const child of link.children) {
				flattenNode(child, richText);
			}
		}
		const byteEnd = getCurrentByteOffset(richText);
		// Add link facet with uri
		const facet: Facet = {
			index: { byteStart, byteEnd },
			features: [{ $type: "pub.oxa.richtext.facet#link", uri: link.target }],
		};
		richText.facets.push(facet);
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

// ---------------------------------------------------------------------------
// Inverse: ATProto flat record → OXA tree-model
// ---------------------------------------------------------------------------

/**
 * Reverse mapping from facet $type to OXA inline node type.
 * Strips OXA and Leaflet compatible features to their canonical form.
 */
const facetTypeToInline: Record<string, string> = {
	"pub.oxa.richtext.facet#strong": "Strong",
	"pub.oxa.richtext.facet#emphasis": "Emphasis",
	"pub.oxa.richtext.facet#superscript": "Superscript",
	"pub.oxa.richtext.facet#subscript": "Subscript",
	"pub.oxa.richtext.facet#inlineCode": "InlineCode",
	"pub.oxa.richtext.facet#link": "Link",
	// Leaflet compat
	"pub.leaflet.richtext.facet#bold": "Strong",
	"pub.leaflet.richtext.facet#italic": "Emphasis",
	"pub.leaflet.richtext.facet#code": "InlineCode",
};

/**
 * An annotated segment of text, used as an intermediate during
 * inline tree reconstruction.
 */
interface Segment {
	byteStart: number;
	byteEnd: number;
	text: string;
	types: string[]; // OXA inline types that apply to this segment
	language?: string; // language for InlineCode segments
	linkTarget?: string; // uri for Link segments
}

/**
 * Convert byte offsets to character offsets in a string.
 * Returns an array where index i gives the byte offset of character i.
 */
function charToByteOffsets(text: string): number[] {
	const offsets: number[] = [];
	let bytePos = 0;
	for (let i = 0; i < text.length; i++) {
		offsets.push(bytePos);
		bytePos += encoder.encode(text[i]).byteLength;
	}
	offsets.push(bytePos); // one past the end
	return offsets;
}

/**
 * Extract text between two byte offsets.
 */
function textBetweenBytes(text: string, byteStart: number, byteEnd: number): string {
	const charOffsets = charToByteOffsets(text);
	let charStart = 0;
	let charEnd = text.length;

	for (let i = 0; i < charOffsets.length; i++) {
		if (charOffsets[i] <= byteStart) charStart = i;
		if (charOffsets[i] >= byteEnd) {
			charEnd = i;
			break;
		}
	}

	return text.slice(charStart, charEnd);
}

/**
 * Reconstruct an OXA inline tree from flat text + facets.
 *
 * Algorithm:
 * 1. Collect all facet boundaries (byteStart, byteEnd) and the types they apply.
 * 2. Sort boundaries and split the text into segments at each boundary.
 * 3. Each segment has a set of active types (from facets that cover it).
 * 4. Build the tree bottom-up: innermost types first, then wrapping.
 *
 * This is a retraction: overlapping facets with different types
 * may lose their nesting order on round-trip.
 */
function unflattenInlines(richText: RichText): OxaInline[] {
	if (richText.facets.length === 0) {
		return richText.text.length > 0 ? [{ type: "Text", value: richText.text } as OxaText] : [];
	}

	// Collect all boundary points and the types that start/end at each
	const boundaries = new Map<number, { starts: string[]; ends: string[] }>();
	let facetLanguages: Map<number, string> | undefined;
	let facetLinkTargets: Map<number, string> | undefined;

	for (const facet of richText.facets) {
		const { byteStart, byteEnd } = facet.index;
		// Collect unique inline types from this facet (deduplicate compat features)
		const seenTypes = new Set<string>();
		for (const feature of facet.features) {
			const inlineType = facetTypeToInline[feature.$type];
			if (!inlineType || seenTypes.has(inlineType)) continue;
			seenTypes.add(inlineType);

			if (!boundaries.has(byteStart)) boundaries.set(byteStart, { starts: [], ends: [] });
			boundaries.get(byteStart)!.starts.push(inlineType);

			if (!boundaries.has(byteEnd)) boundaries.set(byteEnd, { starts: [], ends: [] });
			boundaries.get(byteEnd)!.ends.push(inlineType);

			// Carry language from inlineCode facet features
			if (inlineType === "InlineCode" && "language" in feature) {
				if (!facetLanguages) facetLanguages = new Map();
				facetLanguages.set(byteStart, feature.language as string);
			}

			// Carry uri from link facet features
			if (inlineType === "Link" && "uri" in feature) {
				if (!facetLinkTargets) facetLinkTargets = new Map();
				facetLinkTargets.set(byteStart, feature.uri as string);
			}
		}
	}

	// Sort boundary positions
	const sortedBoundaries = [...boundaries.entries()].sort((a, b) => a[0] - b[0]);

	// Build segments between boundaries
	const segments: Segment[] = [];
	const activeTypes: string[] = [];
	let prevByte = 0;

	for (const [bytePos, events] of sortedBoundaries) {
		// Text segment from prevByte to bytePos
		if (bytePos > prevByte) {
			const text = textBetweenBytes(richText.text, prevByte, bytePos);
			if (text.length > 0) {
				const seg: Segment = {
					byteStart: prevByte,
					byteEnd: bytePos,
					text,
					types: [...activeTypes],
				};
				// Carry language from InlineCode facet that starts at this segment's start
				if (facetLanguages && facetLanguages.has(prevByte)) {
					seg.language = facetLanguages.get(prevByte);
				}
				// Carry link target from Link facet that starts at this segment's start
				if (facetLinkTargets && facetLinkTargets.has(prevByte)) {
					seg.linkTarget = facetLinkTargets.get(prevByte);
				}
				segments.push(seg);
			}
		}

		// Process ends before starts (so nesting works correctly)
		for (const t of events.ends) {
			const idx = activeTypes.lastIndexOf(t);
			if (idx !== -1) activeTypes.splice(idx, 1);
		}
		for (const t of events.starts) {
			activeTypes.push(t);
		}

		prevByte = bytePos;
	}

	// Remaining text after last boundary
	if (prevByte < encoder.encode(richText.text).byteLength) {
		const text = textBetweenBytes(richText.text, prevByte, encoder.encode(richText.text).byteLength);
		if (text.length > 0) {
			segments.push({
				byteStart: prevByte,
				byteEnd: encoder.encode(richText.text).byteLength,
				text,
				types: [],
			});
		}
	}

	// Build tree from segments
	return buildInlineTree(segments);
}

/**
 * Build an OXA inline tree from segments with active types.
 *
 * Strategy: group consecutive segments that share the same outermost type,
 * wrap them in that type, and recurse for the inner types.
 */
function buildInlineTree(segments: Segment[]): OxaInline[] {
	if (segments.length === 0) return [];

	// Find the outermost type across all segments (the one that appears
	// in the most segments and is outermost in the original tree)
	// For simplicity, we use the type that starts earliest and ends latest.

	// Group segments into runs where the outermost type is the same
	const result: OxaInline[] = [];
	let i = 0;

	while (i < segments.length) {
		const seg = segments[i];

		if (seg.types.length === 0) {
			// Plain text segment
			result.push({ type: "Text", value: seg.text } as OxaText);
			i++;
			continue;
		}

		// The outermost type is the first one in the types list
		// (which corresponds to the earliest-starting facet)
		const outerType = seg.types[0];

		// Collect all consecutive segments that share this outermost type
		const innerSegments: Segment[] = [];
		let j = i;

		while (j < segments.length && segments[j].types.length > 0 && segments[j].types[0] === outerType) {
			innerSegments.push({
				...segments[j],
				types: segments[j].types.slice(1), // remove outermost type
			});
			j++;
		}

		// Build inner tree from the inner types
		const innerChildren = buildInlineTree(innerSegments);

		// Create the wrapping node
		if (outerType === "InlineCode") {
			// InlineCode is a leaf — concatenate all inner text
			const value = innerChildren.map(extractOxaText).join("");
			const code: OxaInlineCode = { type: "InlineCode", value };
			// Carry language from the first segment that has one
			const lang = innerSegments.find((s) => s.language !== undefined)?.language;
			if (lang !== undefined) code.language = lang;
			result.push(code);
		} else if (outerType === "Link") {
			// Link has children and a target URI
			const link: OxaLink = { type: "Link", target: "" };
			// Carry target from the first segment that has one
			const target = innerSegments.find((s) => s.linkTarget !== undefined)?.linkTarget;
			if (target !== undefined) link.target = target;
			if (innerChildren.length > 0) link.children = innerChildren;
			result.push(link);
		} else {
			// Formatting node with children
			result.push({
				type: outerType,
				children: innerChildren,
			} as OxaInline);
		}

		i = j;
	}

	return result;
}

function extractOxaText(node: OxaInline): string {
	if (node.type === "Text") return (node as OxaText).value;
	if ("children" in node) {
		return ((node as { children: OxaInline[] }).children as OxaInline[]).map(extractOxaText).join("");
	}
	if ("value" in node) return (node as { value: string }).value;
	return "";
}

// ---------------------------------------------------------------------------
// Block mapping (ATProto → OXA)
// ---------------------------------------------------------------------------

function copyAtprotoBlockBase(block: { id?: string; classes?: string[]; data?: Record<string, unknown> }): OxaBlockBase {
	const base: OxaBlockBase = {};
	if (block.id !== undefined) base.id = block.id;
	if (block.classes !== undefined) base.classes = block.classes;
	if (block.data !== undefined) base.data = block.data;
	return base;
}

function invertBlocks(blocks: AtprotoBlock[]): OxaBlock[] {
	const result: OxaBlock[] = [];
	for (const block of blocks) {
		const inverted = invertBlock(block);
		if (inverted !== undefined) {
			result.push(inverted);
		}
	}
	return result;
}

function invertBlock(block: AtprotoBlock): OxaBlock | undefined {
	switch (block.$type) {
		case "pub.oxa.blocks.defs#paragraph": {
			const rt = block as AtprotoParagraph;
			return {
				...copyAtprotoBlockBase(rt),
				type: "Paragraph",
				children: unflattenInlines({ text: rt.text, facets: rt.facets }),
			};
		}
		case "pub.oxa.blocks.defs#heading": {
			const hd = block as AtprotoHeading;
			return {
				...copyAtprotoBlockBase(hd),
				type: "Heading",
				level: hd.level,
				children: unflattenInlines({ text: hd.text, facets: hd.facets }),
			};
		}
		case "pub.oxa.blocks.defs#code": {
			const code = block as AtprotoCode;
			const result: OxaBlock = {
				...copyAtprotoBlockBase(code),
				type: "Code",
				value: code.value,
			};
			if (code.language !== undefined) result.language = code.language;
			return result;
		}
		case "pub.oxa.blocks.defs#thematicBreak":
			return { ...copyAtprotoBlockBase(block), type: "ThematicBreak" };
		case "pub.oxa.blocks.defs#blockquote": {
			const bq = block as AtprotoBlockquote;
			return {
				...copyAtprotoBlockBase(bq),
				type: "Blockquote",
				children: invertBlocks(bq.children),
			};
		}
		case "pub.oxa.blocks.defs#image": {
			const img = block as AtprotoImage;
			const result: OxaBlock = {
				...copyAtprotoBlockBase(img),
				type: "Image",
				src: img.src,
			};
			if (img.alt !== undefined) result.alt = img.alt;
			return result;
		}
		case "pub.oxa.blocks.defs#math": {
			const math = block as AtprotoMath;
			return {
				...copyAtprotoBlockBase(math),
				type: "Math",
				value: math.value,
			};
		}
		case "pub.oxa.blocks.defs#list": {
			const list = block as AtprotoList;
			const result: OxaBlock = {
				...copyAtprotoBlockBase(list),
				type: "List",
				ordered: list.ordered,
				children: list.children.map((item) => ({
					...copyAtprotoBlockBase(item),
					type: "ListItem" as const,
					children: invertBlocks(item.children),
				})),
			};
			if (list.startIndex !== undefined) result.startIndex = list.startIndex;
			return result;
		}
		case "pub.oxa.blocks.defs#admonition": {
			const adm = block as AtprotoAdmonition;
			const result: OxaBlock = {
				...copyAtprotoBlockBase(adm),
				type: "Admonition",
				kind: adm.kind,
				children: invertBlocks(adm.children),
			};
			if (adm.title !== undefined) result.title = adm.title;
			return result;
		}
		default:
			return undefined;
	}
}

// ---------------------------------------------------------------------------
// Inverse public API
// ---------------------------------------------------------------------------

/**
 * Convert an ATProto flat record back to an OXA tree-model document.
 *
 * This is the inverse of `oxaToAtproto`. The richtext flattening
 * (inline tree → flat text + byte-offset facets) is inverted by
 * reconstructing the tree from facet boundaries.
 *
 * Round-trip guarantee: for non-overlapping facets, the round-trip
 * OXA → ATProto → OXA preserves the inline tree structure exactly.
 * For overlapping facets, the nesting order may differ (retraction).
 *
 * @param record - ATProto flat record.
 * @returns OXA tree-model document.
 */
export function atprotoToOxa(record: AtprotoDocument): OxaDocument {
	const children = invertBlocks(record.children);

	const result: OxaDocument = {
		type: "Document",
		children,
	};

	if (record.title !== undefined) {
		result.title = unflattenInlines(record.title);
	}

	if (record.metadata !== undefined) {
		result.metadata = record.metadata;
	}

	return result;
}
