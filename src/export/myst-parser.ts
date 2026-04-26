/**
 * Parse raw markdown into a MyST AST using markdown-it + markdown-it-myst.
 *
 * Walks the markdown-it token stream and builds a MystDocument tree
 * matching the types from the myst-to-oxa lens.
 *
 * Includes a colon-fence rule (``:::``) so that MyST directive syntax
 * is tokenized before the directive plugin processes it.
 */

import MarkdownIt from "markdown-it";
import { directivePlugin, rolePlugin } from "markdown-it-myst";
import type {
	MystDocument,
	MystBlock,
	MystInline,
	MystHeading,
	MystParagraph,
	MystCodeBlock,
	MystThematicBreak,
	MystBlockquote,
	MystOrderedList,
	MystUnorderedList,
	MystListItem,
	MystImage,
	MystMathBlock,
	MystDirective,
	MystRole,
	MystText,
	MystStrong,
	MystEmphasis,
	MystInlineCode,
} from "../../lenses/myst-to-oxa/src/types";

// ---------------------------------------------------------------------------
// Colon-fence rule for markdown-it
// ---------------------------------------------------------------------------

/**
 * Adds a ``colon_fence`` block rule to markdown-it, matching ``:::`` fences
 * (with 3+ colons). This is required for MyST directive syntax before the
 * directive plugin processes the tokens.
 */
function colonFencePlugin(md: MarkdownIt): void {
	md.block.ruler.before(
		"fence",
		"colon_fence",
		function colon_fence(state, startLine, endLine, silent) {
			const pos = state.bMarks[startLine] + state.tShift[startLine];
			const max = state.eMarks[startLine];

			// Must start with at least 3 colons
			if (pos + 3 > max) return false;

			let colonCount = 0;
			let p = pos;
			while (p < max && state.src.charCodeAt(p) === 0x3a /* : */) {
				colonCount++;
				p++;
			}
			if (colonCount < 3) return false;

			// After colons, rest of line is info string (e.g. ``{note}`` or ``{warning} Title``)
			const info = state.src.slice(p, max).trim();

			// Look for closing fence
			let nextLine = startLine + 1;
			let foundEnd = false;
			const colonClose = ":".repeat(colonCount);

			while (nextLine < endLine) {
				const npos = state.bMarks[nextLine] + state.tShift[nextLine];
				const nmax = state.eMarks[nextLine];
				if (npos + colonCount <= nmax) {
					let nc = 0;
					let np = npos;
					while (np < nmax && state.src.charCodeAt(np) === 0x3a) {
						nc++;
						np++;
					}
					// Closing fence: same or more colons, nothing else on line
					if (nc >= colonCount && state.src.slice(np, nmax).trim() === "") {
						foundEnd = true;
						break;
					}
				}
				nextLine++;
			}

			if (!foundEnd) return false;

			if (silent) return true;

			// Extract content between fences
			const contentStart = state.bMarks[startLine + 1] + state.tShift[startLine + 1];
			const contentEnd = state.bMarks[nextLine];
			const content = state.src.slice(contentStart, contentEnd).trimEnd();

			const token = state.push("colon_fence", "code", 0);
			token.info = info;
			token.content = content;
			token.map = [startLine, nextLine + 1];
			token.markup = colonClose;

			state.line = nextLine + 1;
			return true;
		},
	);
}

// ---------------------------------------------------------------------------
// Dollar-math rule for markdown-it
// ---------------------------------------------------------------------------

/**
 * Adds inline and block math rules for ``$...$`` and ``$$...$$`` syntax.
 * Produces ``math_inline`` and ``math_block`` tokens.
 */
function dollarMathPlugin(md: MarkdownIt): void {
	// Block math: $$...$$
	md.block.ruler.before("paragraph", "math_block", function math_block(state, startLine, endLine, silent) {
		const pos = state.bMarks[startLine] + state.tShift[startLine];
		const max = state.eMarks[startLine];

		if (pos + 1 > max) return false;
		if (state.src.charCodeAt(pos) !== 0x24 /* $ */) return false;
		if (state.src.charCodeAt(pos + 1) !== 0x24) return false;

		// Check if it's a standalone $$ line (opening fence)
		const afterDollar = pos + 2;
		const restOfLine = state.src.slice(afterDollar, max).trim();

		// Single-line display math: $$ E = mc^2 $$
		if (restOfLine !== "") {
			// Check if it ends with $$
			if (restOfLine.endsWith("$$") && restOfLine.length > 2) {
				if (silent) return true;
				const content = restOfLine.slice(0, -2).trim();
				const token = state.push("math_block", "math", 0);
				token.content = content;
				token.map = [startLine, startLine + 1];
				token.markup = "$$";
				state.line = startLine + 1;
				return true;
			}
			// Not a display math block
			return false;
		}

		// Multi-line: look for closing $$
		let nextLine = startLine + 1;
		let foundEnd = false;

		while (nextLine < endLine) {
			const npos = state.bMarks[nextLine] + state.tShift[nextLine];
			const nmax = state.eMarks[nextLine];
			if (npos + 1 <= nmax && state.src.charCodeAt(npos) === 0x24 && state.src.charCodeAt(npos + 1) === 0x24) {
				const afterClose = npos + 2;
				if (afterClose >= nmax || state.src.slice(afterClose, nmax).trim() === "") {
					foundEnd = true;
					break;
				}
			}
			nextLine++;
		}

		if (!foundEnd) return false;

		if (silent) return true;

		const contentStart = state.bMarks[startLine + 1] + state.tShift[startLine + 1];
		const contentEnd = state.bMarks[nextLine];
		const content = state.src.slice(contentStart, contentEnd).trim();

		const token = state.push("math_block", "math", 0);
		token.content = content;
		token.map = [startLine, nextLine + 1];
		token.markup = "$$";

		state.line = nextLine + 1;
		return true;
	});

	// Inline math: $...$
	md.inline.ruler.after("escape", "math_inline", function math_inline(state, silent) {
		const pos = state.pos;
		if (pos + 1 >= state.posMax) return false;
		if (state.src.charCodeAt(pos) !== 0x24) return false;

		// Don't match $$ (that's display math)
		if (state.src.charCodeAt(pos + 1) === 0x24) return false;

		// Find closing $
		let matchPos = pos + 1;
		while (matchPos < state.posMax) {
			if (state.src.charCodeAt(matchPos) === 0x24) {
				// Check it's not escaped
				let backslashCount = 0;
				let checkPos = matchPos - 1;
				while (checkPos > pos && state.src.charCodeAt(checkPos) === 0x5c) {
					backslashCount++;
					checkPos--;
				}
				if (backslashCount % 2 === 0) {
					// Found closing $
					if (silent) return true;
					const content = state.src.slice(pos + 1, matchPos);
					const token = state.push("math_inline", "math", 0);
					token.content = content;
					token.markup = "$";
					state.pos = matchPos + 1;
					return true;
				}
			}
			matchPos++;
		}

		return false;
	});
}

// ---------------------------------------------------------------------------
// Initialize markdown-it with all MyST plugins
// ---------------------------------------------------------------------------

const md = new MarkdownIt("commonmark", { html: false });
md.use(colonFencePlugin);
md.use(dollarMathPlugin);
md.use(directivePlugin);
md.use(rolePlugin);

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

		if (tok.type === "math_inline") {
			inlines.push({
				type: "role",
				name: "math",
				content: tok.content,
			});
			i++;
			continue;
		}

		// parsed_role_open (from markdown-it-myst, appears as inline child)
		if (tok.type === "parsed_role_open") {
			const name = tok.info;
			// Extract content from the role body tokens
			let content = tok.content ?? "";
			if (!content) {
				// Walk forward to find role_body content
				for (let j = i + 1; j < end; j++) {
					if (tokens[j].type === "role_body_open" || tokens[j].type === "inline") {
						if (tokens[j].content) content = tokens[j].content;
					}
					if (tokens[j].type === "parsed_role_close") break;
				}
			}
			inlines.push({
				type: "role",
				name,
				content,
			});
			// Skip to parsed_role_close
			const closeIdx = findMatchingClose(tokens, i, "parsed_role_close");
			i = closeIdx + 1;
			continue;
		}

		if (tok.type === "role") {
			inlines.push({
				type: "role",
				name: tok.meta?.name ?? tok.info ?? "unknown",
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
	// Track nesting depth for paired tokens like parsed_directive_open/close
	const openType = closeType.replace("_close", "_open");
	let depth = 1;

	for (let i = openIdx + 1; i < tokens.length; i++) {
		if (tokens[i].type === openType) depth++;
		if (tokens[i].type === closeType) {
			depth--;
			if (depth === 0) return i;
		}
	}
	return tokens.length - 1;
}

// ---------------------------------------------------------------------------
// Block token walking
// ---------------------------------------------------------------------------

function extractInlineContent(tokens: any[], openIdx: number): MystInline[] {
	for (let i = openIdx + 1; i < tokens.length; i++) {
		if (tokens[i].type === "inline") {
			return walkInlines(tokens[i].children || [], 0, tokens[i].children?.length ?? 0);
		}
		if (tokens[i].type.endsWith("_close") && i > openIdx + 1) break;
	}
	return [];
}

function collectBlocksUntil(tokens: any[], startIdx: number, endType: string): MystBlock[] {
	const blocks: MystBlock[] = [];
	let i = startIdx;
	const endIdx = findMatchingClose(tokens, startIdx - 1, endType);

	while (i < endIdx) {
		const tok = tokens[i];

		if (tok.type === "paragraph_open") {
			const closeIdx = findMatchingClose(tokens, i, "paragraph_close");
			const children = extractInlineContent(tokens, i);
			blocks.push({ type: "paragraph", children } as MystParagraph);
			i = closeIdx + 1;
			continue;
		}

		if (tok.type === "directive_body_open") {
			// Skip body markers, they're structural
			i++;
			continue;
		}

		if (tok.type === "directive_body_close") {
			i++;
			continue;
		}

		// Skip other tokens inside directive body
		i++;
	}

	return blocks;
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

		// blockquote_open
		if (tok.type === "blockquote_open") {
			const closeIdx = findMatchingClose(tokens, i, "blockquote_close");
			const innerStart = i + 1;
			// Collect inner blocks by recursing on the tokens between open/close
			const innerBlocks = walkBlocks(tokens.slice(innerStart, closeIdx));
			blocks.push({ type: "blockquote", children: innerBlocks } as MystBlockquote);
			i = closeIdx + 1;
			continue;
		}

		// ordered_list_open
		if (tok.type === "ordered_list_open") {
			const closeIdx = findMatchingClose(tokens, i, "ordered_list_close");
			const items = collectListItems(tokens, i + 1, closeIdx);
			const list: MystOrderedList = { type: "ordered_list", children: items };
			if (tok.attrGet("start")) {
				const start = parseInt(tok.attrGet("start")!, 10);
				if (!isNaN(start)) list.startIndex = start;
			}
			blocks.push(list);
			i = closeIdx + 1;
			continue;
		}

		// bullet_list_open
		if (tok.type === "bullet_list_open") {
			const closeIdx = findMatchingClose(tokens, i, "bullet_list_close");
			const items = collectListItems(tokens, i + 1, closeIdx);
			blocks.push({ type: "unordered_list", children: items } as MystUnorderedList);
			i = closeIdx + 1;
			continue;
		}

		// image
		if (tok.type === "image") {
			blocks.push({
				type: "image",
				src: tok.attrGet("src") ?? "",
				alt: tok.content || undefined,
			} as MystImage);
			i++;
			continue;
		}

		// math_block (from dollar-math plugin)
		if (tok.type === "math_block") {
			blocks.push({
				type: "math_block",
				value: tok.content,
			} as MystMathBlock);
			i++;
			continue;
		}

		// parsed_directive_open (from markdown-it-myst)
		if (tok.type === "parsed_directive_open") {
			const name = tok.info;
			const arg = tok.meta?.arg ?? "";
			const options = tok.meta?.options ?? {};
			const closeIdx = findMatchingClose(tokens, i, "parsed_directive_close");

			// Walk the body tokens between open and close to find nested directives/blocks
			const bodyBlocks = walkDirectiveBody(tokens, i + 1, closeIdx);

			// If there are nested blocks, use them as children; otherwise use raw body string
			const body = tok.content ?? "";
			if (bodyBlocks.length > 0) {
				blocks.push({
					type: "directive",
					name,
					argument: arg,
					options,
					body,
					children: bodyBlocks,
				} as MystDirective & { children: MystBlock[] });
			} else {
				blocks.push({
					type: "directive",
					name,
					argument: arg,
					options,
					body,
				} as MystDirective);
			}

			i = closeIdx + 1;
			continue;
		}

		// parsed_role_open (from markdown-it-myst, at block level)
		if (tok.type === "parsed_role_open") {
			const name = tok.info;
			const content = tok.content ?? "";
			blocks.push({
				type: "directive",
				name: "role",
				argument: name,
				options: {},
				body: content,
			} as MystDirective);
			const closeIdx = findMatchingClose(tokens, i, "parsed_role_close");
			i = closeIdx + 1;
			continue;
		}

		// Skip everything else
		i++;
	}

	return blocks;
}

/**
 * Walk tokens inside a directive body (between parsed_directive_open and _close).
 * Skips structural markers (directive_body_open/close, directive_arg_open/close,
 * myst_option_open/close) and recurses into nested directives/blocks.
 */
function walkDirectiveBody(tokens: any[], startIdx: number, endIdx: number): MystBlock[] {
	const blocks: MystBlock[] = [];
	let i = startIdx;

	while (i < endIdx) {
		const tok = tokens[i];

		// Skip structural markers
		if (
			tok.type === "directive_body_open" ||
			tok.type === "directive_body_close" ||
			tok.type === "directive_arg_open" ||
			tok.type === "directive_arg_close" ||
			tok.type === "myst_option_open" ||
			tok.type === "myst_option_close"
		) {
			i++;
			continue;
		}

		// Nested directive
		if (tok.type === "parsed_directive_open") {
			const name = tok.info;
			const arg = tok.meta?.arg ?? "";
			const options = tok.meta?.options ?? {};
			const closeIdx = findMatchingClose(tokens, i, "parsed_directive_close");
			const bodyBlocks = walkDirectiveBody(tokens, i + 1, closeIdx);
			const body = tok.content ?? "";

			if (bodyBlocks.length > 0) {
				blocks.push({
					type: "directive",
					name,
					argument: arg,
					options,
					body,
					children: bodyBlocks,
				} as MystDirective & { children: MystBlock[] });
			} else {
				blocks.push({
					type: "directive",
					name,
					argument: arg,
					options,
					body,
				} as MystDirective);
			}

			i = closeIdx + 1;
			continue;
		}

		// Paragraph inside directive body
		if (tok.type === "paragraph_open") {
			const closeIdx = findMatchingClose(tokens, i, "paragraph_close");
			const children = extractInlineContent(tokens, i);
			blocks.push({ type: "paragraph", children } as MystParagraph);
			i = closeIdx + 1;
			continue;
		}

		i++;
	}

	return blocks;
}

function collectListItems(tokens: any[], startIdx: number, endIdx: number): MystListItem[] {
	const items: MystListItem[] = [];
	let i = startIdx;

	while (i < endIdx) {
		if (tokens[i].type === "list_item_open") {
			const closeIdx = findMatchingClose(tokens, i, "list_item_close");
			const innerBlocks = walkBlocks(tokens.slice(i + 1, closeIdx));
			items.push({ type: "list_item", children: innerBlocks } as MystListItem);
			i = closeIdx + 1;
			continue;
		}
		i++;
	}

	return items;
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
