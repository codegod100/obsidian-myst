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
import { dollarmathPlugin } from "markdown-it-dollarmath";
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
	MystLink,
} from "../../lenses/myst-to-oxa/src/types";

// ---------------------------------------------------------------------------
// Directive classification
// ---------------------------------------------------------------------------

/**
 * Directives whose body is raw literal content, not parsed markdown.
 * For these, `tok.content` is the body and should NOT be parsed into blocks.
 */
const RAW_BODY_DIRECTIVES = new Set([
	"code-block",
	"code-cell",
	"math",
	"list-table",
	"csv-table",
]);

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
// Initialize markdown-it with all MyST plugins
// ---------------------------------------------------------------------------

const md = new MarkdownIt("commonmark", { html: false });
md.use(colonFencePlugin);
md.use(dollarmathPlugin);
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

		// Display math in inline context (e.g. $$...$$ on a single line)
		if (tok.type === "math_inline_double") {
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

		// link_open / link_close
		if (tok.type === "link_open") {
			const href = tok.attrGet("href") ?? "";
			const closeIdx = findMatchingClose(tokens, i, "link_close");
			const children = walkInlines(tokens, i + 1, closeIdx);
			const link: MystLink = { type: "link", target: href };
			if (children.length > 0) {
				link.children = children;
			}
			inlines.push(link);
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

		// fence (code block or backtick-fenced directive)
		if (tok.type === "fence") {
			const info = tok.info?.trim() ?? "";

			// Backtick-fenced directive: ```{name} arg
			const directiveMatch = info.match(/^\{(\w[\w-]*)\}\s*(.*)$/);
			if (directiveMatch) {
				const dirName = directiveMatch[1];
				const dirArg = directiveMatch[2].trim();
				const dir: MystDirective = {
					type: "directive",
					name: dirName,
					argument: dirArg,
					options: {},
					body: tok.content ?? "",
				};
				blocks.push(dir);
				i++;
				continue;
			}

			// Regular code block
			const block: MystCodeBlock = {
				type: "code_block",
				value: tok.content,
			};
			if (info) block.language = info;
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
		if (tok.type === "math_block" || tok.type === "math_block_label") {
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
			const body = tok.content ?? "";

			// Raw-body directives: body is literal content, not parsed markdown
			if (RAW_BODY_DIRECTIVES.has(name)) {
				blocks.push({
					type: "directive",
					name,
					argument: arg,
					options,
					body,
				} as MystDirective);
			} else {
				// Parsed-body directives: walk body tokens for nested blocks
				const bodyBlocks = walkDirectiveBody(tokens, i + 1, closeIdx);
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
			const body = tok.content ?? "";

			// Raw-body directives: body is literal content
			if (RAW_BODY_DIRECTIVES.has(name)) {
				blocks.push({
					type: "directive",
					name,
					argument: arg,
					options,
					body,
				} as MystDirective);
			} else {
				const bodyBlocks = walkDirectiveBody(tokens, i + 1, closeIdx);
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
// YAML frontmatter extraction
// ---------------------------------------------------------------------------

/**
 * Extract YAML frontmatter from the start of a markdown document.
 *
 * MyST frontmatter is a simple `---`-delimited YAML block at the top.
 * We parse a limited subset: string values, arrays of strings, and
 * nested objects one level deep. This covers the common MyST fields
 * (title, subtitle, authors, license, etc.) without requiring a YAML dep.
 *
 * @returns `{ markdown, frontmatter }` — the markdown with frontmatter
 *   stripped, and the parsed key-value map.
 */
function extractFrontmatter(markdown: string): { markdown: string; frontmatter: Record<string, unknown> } {
	// Must start with --- on its own line
	if (!markdown.startsWith("---\n") && !markdown.startsWith("---\r\n")) {
		return { markdown, frontmatter: {} };
	}

	// Find closing ---
	const afterFirst = markdown.indexOf("\n") + 1;
	const closeIdx = markdown.indexOf("\n---", afterFirst);
	if (closeIdx === -1) {
		return { markdown, frontmatter: {} };
	}

	const yamlText = markdown.slice(afterFirst, closeIdx);
	const restOfMarkdown = markdown.slice(closeIdx + 4).replace(/^\r?\n/, "");

	const frontmatter = parseSimpleYaml(yamlText);
	return { markdown: restOfMarkdown, frontmatter };
}

/**
 * Parse a limited YAML subset: top-level string/number values,
 * arrays of strings, and one-level-deep objects.
 */
function parseSimpleYaml(yamlText: string): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	const lines = yamlText.split(/\r?\n/);
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		// Skip blank lines and comments
		if (!line.trim() || line.trimStart().startsWith("#")) {
			i++;
			continue;
		}

		// Key: value
		const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);
		if (!kvMatch) {
			i++;
			continue;
		}

		const key = kvMatch[1];
		const value = kvMatch[2].trim();

		if (value === "" || value === "|" || value === ">") {
			// Multiline or block — look for indented lines or array items
			i++;
			const nested: string[] = [];
			const nestedObj: Record<string, string> = {};

			while (i < lines.length) {
				const nextLine = lines[i];
				// List item: "  - value"
				const listMatch = nextLine.match(/^\s+-\s+(.+)$/);
				if (listMatch) {
					nested.push(listMatch[1].trim());
					i++;
					continue;
				}
				// Nested key: "  key: value"
				const nestedKvMatch = nextLine.match(/^\s+(\w[\w-]*):\s*(.*)$/);
				if (nestedKvMatch) {
					nestedObj[nestedKvMatch[1]] = nestedKvMatch[2].trim();
					i++;
					continue;
				}
				// No longer indented — done with this block
				if (nextLine.trim() && !nextLine.startsWith(" ")) break;
				i++;
			}

			if (nested.length > 0) {
				result[key] = nested;
			} else if (Object.keys(nestedObj).length > 0) {
				result[key] = nestedObj;
			} else {
				result[key] = "";
			}
		} else {
			// Inline value — strip quotes
			result[key] = value.replace(/^["']|["']$/g, "");
			i++;
		}
	}

	return result;
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
	// Extract YAML frontmatter before parsing
	const { markdown: mdSource, frontmatter } = extractFrontmatter(markdown);

	const tokens = md.parse(mdSource, {});
	const children = walkBlocks(tokens);

	// Extract title: prefer frontmatter title, then first h1
	let title: string | undefined;
	if (typeof frontmatter.title === "string") {
		title = frontmatter.title;
	} else {
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
	}

	const result: MystDocument = {
		type: "document",
		children,
		title,
	};

	// Preserve frontmatter as metadata (excluding title which has its own field)
	const metadata: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(frontmatter)) {
		if (key !== "title") {
			metadata[key] = value;
		}
	}
	if (Object.keys(metadata).length > 0) {
		result.metadata = metadata;
	}

	return result;
}
