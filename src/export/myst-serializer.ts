/**
 * Serialize a MystDocument AST back to MyST-flavored markdown.
 *
 * This is the final step of the import pipeline:
 *   ATProto record → OXA tree → MystDocument → markdown string
 */

import type {
	MystDocument,
	MystBlock,
	MystInline,
	MystHeading,
	MystParagraph,
	MystCodeBlock,
	MystThematicBreak,
	MystBlockquote,
	MystImage,
	MystMathBlock,
	MystOrderedList,
	MystUnorderedList,
	MystListItem,
	MystDirective,
	MystRole,
	MystText,
	MystStrong,
	MystEmphasis,
	MystInlineCode,
	MystLink,
} from "../../lenses/myst-to-oxa/src/types";

// ---------------------------------------------------------------------------
// Inline serialization
// ---------------------------------------------------------------------------

function serializeInline(node: MystInline): string {
	switch (node.type) {
		case "text":
			return (node as MystText).value;
		case "strong":
			return `**${serializeInlines((node as MystStrong).children)}**`;
		case "emphasis":
			return `*${serializeInlines((node as MystEmphasis).children)}*`;
		case "inline_code": {
			const value = (node as MystInlineCode).value;
			// Use backticks, escaping internal backticks
			if (!value.includes("`")) return `\`${value}\``;
			if (!value.includes("``")) return `\`\` ${value} \`\``;
			return `\`\`\` ${value} \`\`\``;
		}
		case "role": {
			const role = node as MystRole;
			return `{${role.name}}\`${role.content}\``;
		}
		case "link": {
			const link = node as MystLink;
			const text = link.children ? serializeInlines(link.children) : "";
			if (text && text !== link.target) {
				return `[${text}](${link.target})`;
			}
			return `[${link.target}](${link.target})`;
		}
		default:
			return "";
	}
}

function serializeInlines(nodes: MystInline[]): string {
	return nodes.map(serializeInline).join("");
}

// ---------------------------------------------------------------------------
// Block serialization
// ---------------------------------------------------------------------------

function serializeHeading(node: MystHeading): string {
	const prefix = "#".repeat(node.level);
	return `${prefix} ${serializeInlines(node.children)}`;
}

function serializeParagraph(node: MystParagraph): string {
	return serializeInlines(node.children);
}

function serializeCodeBlock(node: MystCodeBlock): string {
	const lang = node.language ?? "";
	return `\`\`\`${lang}\n${node.value}\n\`\`\``;
}

function serializeThematicBreak(_node: MystThematicBreak): string {
	return "---";
}

function serializeBlockquote(node: MystBlockquote, indent: string): string {
	const inner = serializeBlocks(node.children, indent);
	return inner
		.split("\n")
		.map((line) => `${indent}> ${line}`)
		.join("\n");
}

function serializeImage(node: MystImage): string {
	const alt = node.alt ?? "";
	return `![${alt}](${node.src})`;
}

function serializeMathBlock(node: MystMathBlock): string {
	return `$$\n${node.value}\n$$`;
}

function serializeOrderedList(node: MystOrderedList, indent: string): string {
	const start = node.startIndex ?? 1;
	return node.children
		.map((item, i) => serializeListItem(item, `${indent}${start + i}. `, indent))
		.join("\n");
}

function serializeUnorderedList(node: MystUnorderedList, indent: string): string {
	return node.children
		.map((item) => serializeListItem(item, `${indent}- `, indent))
		.join("\n");
}

function serializeListItem(item: MystListItem, prefix: string, parentIndent: string): string {
	const contentIndent = " ".repeat(prefix.length);
	const blocks = item.children;
	if (blocks.length === 0) return prefix.trimEnd();

	// First block gets the prefix directly
	const first = serializeBlock(blocks[0], parentIndent);
	const rest = blocks.slice(1).map((b) => serializeBlock(b, parentIndent + contentIndent));

	return [prefix + first, ...rest].join("\n");
}

function serializeDirective(node: MystDirective): string {
	const lines: string[] = [];

	// Opening fence
	lines.push(`:::{${node.name}}${node.argument ? " " + node.argument : ""}`);

	// Options
	for (const [key, value] of Object.entries(node.options)) {
		lines.push(`:${key}: ${value}`);
	}

	// Body or children
	if (node.children && node.children.length > 0) {
		// Parsed-body directive: serialize children between markers
		lines.push("");
		lines.push(serializeBlocks(node.children, ""));
		lines.push("");
	} else if (node.body) {
		lines.push("");
		lines.push(node.body);
		lines.push("");
	}

	lines.push(":::");
	return lines.join("\n");
}

function serializeBlock(node: MystBlock, indent: string = ""): string {
	switch (node.type) {
		case "heading":
			return serializeHeading(node as MystHeading);
		case "paragraph":
			return serializeParagraph(node as MystParagraph);
		case "code_block":
			return serializeCodeBlock(node as MystCodeBlock);
		case "thematic_break":
			return serializeThematicBreak(node as MystThematicBreak);
		case "blockquote":
			return serializeBlockquote(node as MystBlockquote, indent);
		case "image":
			return serializeImage(node as MystImage);
		case "math_block":
			return serializeMathBlock(node as MystMathBlock);
		case "ordered_list":
			return serializeOrderedList(node as MystOrderedList, indent);
		case "unordered_list":
			return serializeUnorderedList(node as MystUnorderedList, indent);
		case "directive":
			return serializeDirective(node as MystDirective);
		default:
			return "";
	}
}

function serializeBlocks(nodes: MystBlock[], indent: string = ""): string {
	return nodes
		.map((node) => serializeBlock(node, indent))
		.filter((s) => s !== "")
		.join("\n\n");
}

// ---------------------------------------------------------------------------
// YAML frontmatter
// ---------------------------------------------------------------------------

function serializeFrontmatter(metadata: Record<string, unknown>): string {
	const lines: string[] = ["---"];
	for (const [key, value] of Object.entries(metadata)) {
		if (typeof value === "string") {
			// Quote values that could be parsed as other types
			if (/^\d+$/.test(value) || value === "true" || value === "false" || value.includes(":")) {
				lines.push(`${key}: "${value}"`);
			} else {
				lines.push(`${key}: ${value}`);
			}
		} else if (Array.isArray(value)) {
			lines.push(`${key}:`);
			for (const item of value) {
				lines.push(`  - ${item}`);
			}
		} else if (typeof value === "object" && value !== null) {
			lines.push(`${key}:`);
			for (const [k, v] of Object.entries(value as Record<string, string>)) {
				lines.push(`  ${k}: ${v}`);
			}
		} else {
			lines.push(`${key}: ${value}`);
		}
	}
	lines.push("---");
	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Serialize a MystDocument to a MyST-flavored markdown string.
 *
 * @param doc - MystDocument AST.
 * @returns Markdown string with optional YAML frontmatter.
 */
export function serializeMystToMarkdown(doc: MystDocument): string {
	const parts: string[] = [];

	// Build frontmatter from title + metadata
	const frontmatter: Record<string, unknown> = {};
	if (doc.title !== undefined) {
		frontmatter.title = doc.title;
	}
	if (doc.metadata !== undefined) {
		Object.assign(frontmatter, doc.metadata);
	}
	if (Object.keys(frontmatter).length > 0) {
		parts.push(serializeFrontmatter(frontmatter));
	}

	// Serialize blocks
	const body = serializeBlocks(doc.children);
	if (body) {
		parts.push(body);
	}

	return parts.join("\n\n") + "\n";
}
