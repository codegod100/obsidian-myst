import { CALLOUT_ADMONITION_MAP } from "src/shared/myst-types";

/**
 * Map an Obsidian callout type to a MyST admonition class.
 * Returns the mapped class or the original type if no mapping exists.
 */
export function calloutToAdmonition(calloutType: string): string {
	return CALLOUT_ADMONITION_MAP[calloutType] ?? calloutType;
}

/**
 * Map a MyST admonition type back to an Obsidian callout type.
 * For types not in the reverse map, returns the type as-is.
 */
export function admonitionToCallout(admonitionType: string): string {
	for (const [callout, admonition] of Object.entries(CALLOUT_ADMONITION_MAP)) {
		if (admonition === admonitionType) {
			return callout;
		}
	}
	return admonitionType;
}

/**
 * Convert Obsidian callout markdown to MyST directive syntax.
 * > [!note] Title   →   :::{note} Title
 * > content             content
 *                      :::
 */
export function calloutToDirective(calloutType: string, title: string, body: string): string {
	const admonitionType = calloutToAdmonition(calloutType);
	const titlePart = title ? ` ${title}` : "";
	const directive = `:::{${admonitionType}}${titlePart}\n${body}\n:::`;
	return directive;
}

/**
 * Convert MyST directive syntax to Obsidian callout markdown.
 * :::{note} Title   →   > [!note] Title
 * content                > content
 * :::
 */
export function directiveToCallout(directiveName: string, argument: string, body: string): string {
	const calloutType = admonitionToCallout(directiveName);
	const titlePart = argument ? ` ${argument}` : "";
	const lines = body.split("\n").map((line) => `> ${line}`);
	return `> [!${calloutType}]${titlePart}\n${lines.join("\n")}`;
}
