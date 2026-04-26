import type { Extension } from "@codemirror/state";
import type MystPlugin from "src/main";
import { mystStreamLanguage } from "src/editor/myst-stream";
import { mystHighlightStyle } from "src/editor/myst-highlight";
import { mystViewPlugin } from "src/editor/myst-decorations";
import { mystStateField } from "src/editor/myst-state";
import { mystCommands } from "src/editor/myst-commands";

/**
 * Register all CM6 editor extensions for MyST syntax support.
 */
export function registerEditorExtensions(plugin: MystPlugin): void {
	if (!plugin.settings.enableEditorHighlighting) return;

	const extensions = buildExtensions(plugin);
	plugin.registerEditorExtension(extensions);
}

function buildExtensions(plugin: MystPlugin): Extension[] {
	return [
		mystStreamLanguage(),
		mystHighlightStyle(),
		mystStateField,
		mystViewPlugin(plugin),
		mystCommands(),
	];
}
