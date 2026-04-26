import type { MarkdownPostProcessor } from "obsidian";
import { calloutToAdmonition } from "src/shared/callout-map";

/**
 * Post-processor that adds MyST admonition semantics to Obsidian callouts.
 *
 * Obsidian renders callouts as:
 *   <div class="callout" data-callout="note">
 *     <div class="callout-title">...</div>
 *     <div class="callout-content">...</div>
 *   </div>
 *
 * This processor adds MyST classes and data attributes so that
 * callouts are recognized as MyST admonitions.
 */
export const calloutBridgePostProcessor: MarkdownPostProcessor = (el: HTMLElement) => {
	const callouts = el.querySelectorAll(".callout");

	for (const callout of Array.from(callouts)) {
		const calloutType = callout.getAttribute("data-callout");
		if (!calloutType) continue;

		const admonitionType = calloutToAdmonition(calloutType);

		// Add MyST admonition classes
		callout.addClass("myst-admonition");
		callout.addClass(`myst-admonition-${admonitionType}`);

		// Add data attribute for MyST directive name
		callout.setAttribute("data-myst-directive", admonitionType);

		// Mark the callout title with the MyST role label
		const title = callout.querySelector(".callout-title");
		if (title) {
			const icon = title.querySelector(".callout-icon");
			if (icon) {
				// Add a small label after the icon showing the MyST directive name
				const label = document.createElement("span");
				label.addClass("myst-admonition-label");
				label.textContent = `{${admonitionType}}`;
				icon.after(label);
			}
		}
	}
};
