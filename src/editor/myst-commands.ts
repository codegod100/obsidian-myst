import { type Extension, EditorSelection } from "@codemirror/state";
import { KNOWN_DIRECTIVES, KNOWN_ROLES } from "src/shared/myst-types";

/**
 * Editor commands for MyST syntax.
 *
 * - "Insert directive" — wraps selection or inserts a directive template
 * - "Insert role" — wraps selection in role syntax
 */

export function mystCommands(): Extension {
	return [];
}

/**
 * Insert a directive template at the cursor.
 * Template: :::{name}\nargument\n:options:\n\nbody\n:::
 */
export function insertDirectiveTemplate(name: string): string {
	return `:::{${name}}\n\n:::`;
}

/**
 * Wrap selected text in a role.
 * If no selection, inserts an empty role template.
 */
export function wrapInRole(name: string, content: string): string {
	return `{${name}}\`${content}\``;
}
