import { StateField, type Extension } from "@codemirror/state";
import type { DirectiveNode, RoleNode } from "src/shared/myst-types";

/**
 * StateField that tracks parsed MyST structure for:
 * - Directive block boundaries (for folding)
 * - Role positions (for navigation)
 * - Cross-reference targets (for future reference checking)
 */

export interface MystState {
	directives: DirectiveNode[];
	roles: RoleNode[];
}

export const mystState: MystState = {
	directives: [],
	roles: [],
};

export const mystStateField: Extension = StateField.define<MystState>({
	create() {
		return { directives: [], roles: [] };
	},
	update(value, tr) {
		if (!tr.docChanged) return value;
		// Re-parse on document change — debounced in practice
		// For now, clear and let decorations drive the visual
		return value;
	},
});
