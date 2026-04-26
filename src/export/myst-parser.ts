/**
 * Parse raw markdown into a MyST AST using markdown-it + markdown-it-myst.
 *
 * Walks the markdown-it token stream and builds a MystDocument tree
 * matching the types from the myst-to-oxa lens.
 */

import MarkdownIt from "markdown-it";
import { mystPlugin } from "markdown-it-myst";
import type {
	MystDocument,
	MystBlock,
	MystInline,
	MystHeading,
	MystParagraph,
	MystCodeBlock,
	MystThematicBreak,
	MystDirective,
	MystRole,
	MystText,
	MystStrong,
	MystEmphasis,
	MystInlineCode,
} from "../../lenses/myst-to-oxa/src/types";

const md = new MarkdownIt("commonmark", { html: false });
md.use(mystPlugin);

// ---------------------------------------------------------------------------
// Inline token walking
// ---------------------------------------------------------------------------

function walkInlines(tokens: any[], start: number, end: number): MystInline[] {
	const inlines: MystInline[] = [];
	let i = start;

	while (i < end) {
		const tok = tokens[i];

		if (tok.type === "text" || tok.type === "softbreak") {
			inlines.push({ type: "text", value: tok.type === "softbreak" ? "\n" : tok.content });
			i++;
			continue;
		}

		if (tok.type === "code_inline") {
			inlines.push({ type: "inline_code", value: tok.content });
			i++;
			continue;
		}

		if (tok.type === "role") {
			// markdown-it-myst role token: meta.name, content
			inlines.push({
				type: "role",
				name: tok.meta?.name ?? "unknown",
				content: tok.content,
			});
			i++;
			continue;
		}

		// strong_open / strong_close
		if (tok.type === "strong_open") {
			const closeIdx = findMatchingClose(tokens, i, "strong_close");
			const children = walkInlines(tokens, i + 1, closeIdx);
			inlines.push({ type: "strong", children });
			i = closeIdx + 1;
			continue;
		}

		// em_open / em_close
		if (tok.type === "em_open") {
			const closeIdx = findMatchingClose(tokens, i, "em_close");
			const children = walkInlines(tokens, i + 1, closeIdx);
			inlines.push({ type: "emphasis", children });
			i = closeIdx + 1;
			continue;
		}

		// Skip unknown inline tokens
		i++;
	}

	return inlines;
}

function findMatchingClose(tokens: any[], openIdx: number, closeType: string): number {
	for (let i = openIdx + 1; i < tokens.length; i++) {
		if (tokens[i].type === closeType) return i;
	}
	return tokens.length - 1;
}

// ---------------------------------------------------------------------------
// Block token walking
// ---------------------------------------------------------------------------

function extractInlineContent(tokens: any[], openIdx: number): MystInline[] {
	// The inline content is in a child token of type "inline"
	for (let i = openIdx + 1; i < tokens.length; i++) {
		if (tokens[i].type === "inline") {
			return walkInlines(tokens[i].children || [], 0, tokens[i].children?.length ?? 0);
		}
		if (tokens[i].type.endsWith("_close") && i > openIdx + 1) break;
	}
	return [];
}

function walkBlocks(tokens: any[]): MystBlock[] {
	const blocks: MystBlock[] = [];
	let i = 0;

	while (i < tokens.length) {
		const tok = tokens[i];

		// heading_open
		if (tok.type === "heading_open") {
			const level = parseInt(tok.tag.replace("h", ""), 10);
			const closeIdx = findMatchingClose(tokens, i, "heading_close");
			const children = extractInlineContent(tokens, i);
			blocks.push({ type: "heading", level, children } as MystHeading);
			i = closeIdx + 1;
			continue;
		}

		// paragraph_open
		if (tok.type === "paragraph_open") {
			const closeIdx = findMatchingClose(tokens, i, "paragraph_close");
			const children = extractInlineContent(tokens, i);
			blocks.push({ type: "paragraph", children } as MystParagraph);
			i = closeIdx + 1;
			continue;
		}

		// fence (code block)
		if (tok.type === "fence") {
			const block: MystCodeBlock = {
				type: "code_block",
				value: tok.content,
			};
			const lang = tok.info?.trim();
			if (lang) block.language = lang;
			blocks.push(block);
			i++;
			continue;
		}

		// hr (thematic break)
		if (tok.type === "hr") {
			blocks.push({ type: "thematic_break" } as MystThematicBreak);
			i++;
			continue;
		}

		// parsed_directive_open (from markdown-it-myst)
		if (tok.type === "parsed_directive_open") {
			const name = tok.info;
			const arg = tok.meta?.arg ?? "";
			const options = tok.meta?.options ?? {};
			const body = tok.content ?? "";
			blocks.push({
				type: "directive",
				name,
				argument: arg,
				options,
				body,
			} as MystDirective);
			// Skip to parsed_directive_close
			const closeIdx = findMatchingClose(tokens, i, "parsed_directive_close");
			i = closeIdx + 1;
			continue;
		}

		// Skip everything else (blockquote_open, bullet_list_open, etc.)
		i++;
	}

	return blocks;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse raw markdown into a MystDocument AST.
 *
 * @param markdown - Raw markdown source.
 * @returns MystDocument with children as MystBlock nodes.
 */
export function parseMyst(markdown: string): MystDocument {
	const tokens = md.parse(markdown, {});
	const children = walkBlocks(tokens);

	// Extract title from first heading if present
	let title: string | undefined;
	for (const block of children) {
		if (block.type === "heading" && (block as MystHeading).level === 1) {
			title = (block as MystHeading).children
				.map((c) => {
					if (c.type === "text") return (c as MystText).value;
					if (c.type === "inline_code") return (c as MystInlineCode).value;
					return "";
				})
				.join("");
			break;
		}
	}

	return {
		type: "document",
		children,
		title,
	};
}
