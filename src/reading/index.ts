import type MystPlugin from "src/main";
import { directivePostProcessor, setDirectiveRendererApp, setCodeExecutionEnabled, invalidateFenceDirectiveCache } from "src/reading/directive-renderer";
import { rolePostProcessor, setRoleRendererApp } from "src/reading/role-renderer";
import { dollarMathPostProcessor } from "src/reading/math-renderer";
import { calloutBridgePostProcessor } from "src/reading/callout-bridge";
import { refLinkPostProcessor, setRefLinkApp, invalidateRefDefs } from "src/reading/ref-link-processor";

/**
 * Register all reading-mode (preview) processors.
 *
 * Obsidian's reading mode uses remark/unified, not markdown-it.
 * We can't inject markdown-it-myst directly. Instead:
 * - Directives: post-processor that finds code blocks with MyST directive language classes
 * - Roles: post-processor scans for {name}`content` patterns
 * - Dollar math: post-processor for $...$ and $$...$$
 * - Callout bridge: post-processor to add MyST semantics to callouts
 *
 * NOTE: We cannot use registerMarkdownCodeBlockProcessor with `{name}` language
 * strings because the braces produce invalid CSS selectors (e.g. `code.language-{note}`),
 * which causes Obsidian's internal querySelectorAll to throw.
 */
export function registerReadingMode(plugin: MystPlugin): void {
	const { settings } = plugin;

	// Provide app reference for MarkdownRenderer.render (math roles/directives)
	setRoleRendererApp(plugin.app);
	setDirectiveRendererApp(plugin.app);
	setCodeExecutionEnabled(settings.enableCodeExecution);
	setRefLinkApp(plugin.app);

	// Invalidate caches when files change
	plugin.registerEvent(
		plugin.app.vault.on("modify", (file) => {
			invalidateRefDefs(file.path);
			invalidateFenceDirectiveCache(file.path);
		}),
	);

	if (settings.enableDirectives) {
		plugin.registerMarkdownPostProcessor(directivePostProcessor);
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

	// Reference-style links: [foo][bar] + [bar]: /url
	plugin.registerMarkdownPostProcessor(refLinkPostProcessor);
}
