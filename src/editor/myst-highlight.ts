import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { Tag } from "@lezer/highlight";

/**
 * Custom Lezer highlight tags for MyST syntax.
 * Using Tag.define() for custom tags.
 */
export const mystTags = {
	directiveFence: Tag.define("mystDirectiveFence"),
	directiveName: Tag.define("mystDirectiveName"),
	directiveOption: Tag.define("mystDirectiveOption"),
	directiveBody: Tag.define("mystDirectiveBody"),
	role: Tag.define("mystRole"),
	roleName: Tag.define("mystRoleName"),
	roleContent: Tag.define("mystRoleContent"),
	dollarMath: Tag.define("mystDollarMath"),
	mathContent: Tag.define("mystMathContent"),
	citation: Tag.define("mystCitation"),
};

/**
 * Syntax highlighting style for MyST tokens.
 */
export function mystHighlightStyle() {
	return syntaxHighlighting(
		HighlightStyle.define([
			// Directive fences (:::)
			{
				tag: mystTags.directiveFence,
				color: "#c678dd",       // purple
				fontWeight: "bold",
			},
			// Directive name ({name})
			{
				tag: mystTags.directiveName,
				color: "#e06c75",       // red
				fontWeight: "bold",
			},
			// Directive options (:key: value)
			{
				tag: mystTags.directiveOption,
				color: "#61afef",       // blue
			},
			// Directive body
			{
				tag: mystTags.directiveBody,
				color: "#abb2bf",       // default text
			},
			// Role syntax
			{
				tag: mystTags.role,
				color: "#56b6c2",       // cyan
			},
			// Role name
			{
				tag: mystTags.roleName,
				color: "#e5c07b",       // yellow
				fontWeight: "bold",
			},
			// Role content
			{
				tag: mystTags.roleContent,
				color: "#98c379",       // green
			},
			// Dollar math delimiters
			{
				tag: mystTags.dollarMath,
				color: "#d19a66",       // orange
			},
			// Math content
			{
				tag: mystTags.mathContent,
				color: "#d19a66",       // orange
				fontStyle: "italic",
			},
			// Citations
			{
				tag: mystTags.citation,
				color: "#e06c75",       // red
				fontStyle: "italic",
			},
		]),
	);
}
