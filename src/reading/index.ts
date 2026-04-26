import type MystPlugin from "src/main";
import { directiveCodeBlockProcessor } from "src/reading/directive-renderer";
import { rolePostProcessor } from "src/reading/role-renderer";
import { dollarMathPostProcessor } from "src/reading/math-renderer";
import { calloutBridgePostProcessor } from "src/reading/callout-bridge";

/**
 * Register all reading-mode (preview) processors.
 *
 * Obsidian's reading mode uses remark/unified, not markdown-it.
 * We can't inject markdown-it-myst directly. Instead:
 * - Directives: registerMarkdownCodeBlockProcessor for ````md```{name}` syntax
 * - Roles: registerMarkdownPostProcessor scans for {name}`content` patterns
 * - Dollar math: registerMarkdownPostProcessor for $...$ and $$...$$
 * - Callout bridge: registerMarkdownPostProcessor to add MyST semantics to callouts
 */
export function registerReadingMode(plugin: MystPlugin): void {
	const { settings } = plugin;

	if (settings.enableDirectives) {
		// Register directive code block processor for ```{directive-name} syntax
		plugin.registerMarkdownCodeBlockProcessor(
			"myst-directive",
			directiveCodeBlockProcessor,
		);

		// Also catch ```{name} where name is a known directive
		plugin.registerMarkdownCodeBlockProcessor(
			"{admonition}",
			directiveCodeBlockProcessor,
		);
		plugin.registerMarkdownCodeBlockProcessor(
			"{note}",
			directiveCodeBlockProcessor,
		);
		plugin.registerMarkdownCodeBlockProcessor(
			"{warning}",
			directiveCodeBlockProcessor,
		);
		plugin.registerMarkdownCodeBlockProcessor(
			"{tip}",
			directiveCodeBlockProcessor,
		);
		plugin.registerMarkdownCodeBlockProcessor(
			"{danger}",
			directiveCodeBlockProcessor,
		);
		plugin.registerMarkdownCodeBlockProcessor(
			"{figure}",
			directiveCodeBlockProcessor,
		);
		plugin.registerMarkdownCodeBlockProcessor(
			"{code-block}",
			directiveCodeBlockProcessor,
		);
		plugin.registerMarkdownCodeBlockProcessor(
			"{math}",
			directiveCodeBlockProcessor,
		);
		plugin.registerMarkdownCodeBlockProcessor(
			"{dropdown}",
			directiveCodeBlockProcessor,
		);
		plugin.registerMarkdownCodeBlockProcessor(
			"{tab-set}",
			directiveCodeBlockProcessor,
		);
		plugin.registerMarkdownCodeBlockProcessor(
			"{tab-item}",
			directiveCodeBlockProcessor,
		);
		plugin.registerMarkdownCodeBlockProcessor(
			"{mermaid}",
			directiveCodeBlockProcessor,
		);
	}

	if (settings.enableRoles) {
		plugin.registerMarkdownPostProcessor(rolePostProcessor);
	}

	if (settings.enableDollarMath) {
		plugin.registerMarkdownPostProcessor(dollarMathPostProcessor);
	}

	if (settings.enableCalloutBridge) {
		plugin.registerMarkdownPostProcessor(calloutBridgePostProcessor);
	}
}
