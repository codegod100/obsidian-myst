import {
	Decoration,
	type DecorationSet,
	type EditorView,
	ViewPlugin,
	type ViewUpdate,
	WidgetType,
} from "@codemirror/view";
import { type Extension, Range as StateRange } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import type MystPlugin from "src/main";

/**
 * ViewPlugin that adds visual decorations for MyST syntax in the editor.
 *
 * Decorations:
 * - Directive blocks: styled containers with header
 * - Role names: subtle pill labels
 * - Directive fence concealment (optional)
 */

export function mystViewPlugin(plugin: MystPlugin): Extension {
	return ViewPlugin.define(
		(view) => new MystDecorations(view, plugin),
		{
			decorations: (v) => v.decorations,
		},
	);
}

class MystDecorations {
	decorations: DecorationSet;
	view: EditorView;
	plugin: MystPlugin;

	constructor(view: EditorView, plugin: MystPlugin) {
		this.view = view;
		this.plugin = plugin;
		this.decorations = this.buildDecorations(view);
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			this.decorations = this.buildDecorations(update.view);
		}
	}

	buildDecorations(view: EditorView): DecorationSet {
		const builder: StateRange<Decoration>[] = [];
		const conceal = this.plugin.settings.concealDirectiveFences;

		for (const { from, to } of view.visibleRanges) {
			syntaxTree(view.state).iterate({
				from,
				to,
				enter(node) {
					switch (node.name) {
						case "mystDirectiveFence":
							if (conceal) {
								builder.push(
									Decoration.replace({}).range(node.from, node.to),
								);
							} else {
								builder.push(
									Decoration.mark({
										class: "cm-myst-directive-fence",
									}).range(node.from, node.to),
								);
							}
							break;

						case "mystDirectiveOption":
							builder.push(
								Decoration.mark({
									class: "cm-myst-directive-option",
								}).range(node.from, node.to),
							);
							break;

						case "mystRole":
							builder.push(
								Decoration.mark({
									class: "cm-myst-role",
								}).range(node.from, node.to),
							);
							break;

						case "mystDollarMath":
							builder.push(
								Decoration.mark({
									class: "cm-myst-dollar-math",
								}).range(node.from, node.to),
							);
							break;
					}
				},
			});
		}

		return Decoration.set(builder, true);
	}
}

/**
 * Widget for rendering a directive block header.
 */
class DirectiveHeaderWidget extends WidgetType {
	readonly name: string;
	readonly argument: string;

	constructor(name: string, argument: string) {
		super();
		this.name = name;
		this.argument = argument;
	}

	toDOM() {
		const container = document.createElement("div");
		container.className = "cm-myst-directive-header-widget";
		const label = container.createSpan({ cls: "cm-myst-directive-label" });
		label.textContent = this.name;
		if (this.argument) {
			const title = container.createSpan({ cls: "cm-myst-directive-title" });
			title.textContent = this.argument;
		}
		return container;
	}
}
