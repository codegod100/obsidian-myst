/** Shared type definitions for MyST plugin */

export interface DirectiveNode {
	type: "directive";
	name: string;
	argument: string;
	options: Record<string, string>;
	body: string;
	start: number;
	end: number;
}

export interface RoleNode {
	type: "role";
	name: string;
	content: string;
	start: number;
	end: number;
}

export type MystNode = DirectiveNode | RoleNode;

/** Callout type → MyST admonition class mapping */
export const CALLOUT_ADMONITION_MAP: Record<string, string> = {
	note: "note",
	info: "info",
	tip: "tip",
	success: "success",
	question: "question",
	warning: "warning",
	failure: "failure",
	danger: "danger",
	bug: "bug",
	example: "example",
	quote: "quote",
	abstract: "abstract",
	todo: "todo",
	important: "important",
	caution: "caution",
};

/** Known MyST directive names (for autocomplete / validation) */
export const KNOWN_DIRECTIVES = new Set([
	"admonition",
	"note",
	"warning",
	"danger",
	"attention",
	"caution",
	"important",
	"hint",
	"tip",
	"figure",
	"image",
	"table",
	"list-table",
	"code-block",
	"code-cell",
	"math",
	"dropdown",
	"tab-set",
	"tab-item",
	"margin",
	"sidebar",
	"seealso",
	"todo",
	"ifconfig",
	"csv-table",
	"card",
	"grid",
	"mermaid",
	"iframe",
	"embed",
	"include",
	"pull-quote",
	"epigraph",
	"highlights",
	"topic",
	"sidebar",
]);

/** Known MyST role names */
export const KNOWN_ROLES = new Set([
	"ref",
	"doc",
	"eq",
	"numref",
	"label",
	"cite",
	"cite:ps",
	"cite:t",
	"cite:p",
	"sub",
	"sup",
	"abbr",
	"code",
	"command",
	"file",
	"guilabel",
	"kbd",
	"math",
	"m",
	"menuselection",
	"meth",
	"attr",
	"class",
	"func",
	"mod",
	"data",
	"const",
	"var",
	"exc",
	"obj",
	"term",
	"envvar",
	"token",
	"keyword",
	"option",
	"prog",
	"dfn",
	"any",
	"download",
	"pep",
	"rfc",
	"strike",
	"underline",
	"small",
	"big",
	"raw",
	"html",
	"eval-rst",
	"md",
	"latex",
]);
