import { Component, MarkdownRenderer, type App, type MarkdownPostProcessor, type MarkdownPostProcessorContext } from "obsidian";
import { KNOWN_ROLES } from "src/shared/myst-types";
import type MystPlugin from "src/main";

/**
 * Post-processor for MyST inline roles.
 *
 * Obsidian's remark parser splits the role syntax:
 *   {math}`content`
 * into two separate DOM elements:
 *   - A text node containing "{math}"
 *   - A <code> element containing "content"
 *
 * So we look for text nodes that end with `{name}` and check if the
 * next sibling is a <code> element. If so, we combine them into a
 * rendered role span.
 *
 * For math roles (math, m), the content is rendered using
 * MarkdownRenderer.render() which invokes Obsidian's built-in
 * MathJax pipeline.
 */
let pluginApp: App | null = null;

export function setRoleRendererApp(app: App): void {
	pluginApp = app;
}

export const rolePostProcessor: MarkdownPostProcessor = async (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
	// Pattern for a text node ending with {role-name}
	const roleTextPattern = /\{([a-zA-Z][a-zA-Z0-9_:.-]*)\}$/;

	// Walk all text nodes looking for role name patterns
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	const textNodes: Text[] = [];

	let current: Text | null;
	while ((current = walker.nextNode() as Text | null)) {
		textNodes.push(current);
	}

	for (const textNode of textNodes) {
		const text = textNode.textContent ?? "";
		const match = text.match(roleTextPattern);
		if (!match) continue;

		const roleName = match[1];
		if (!KNOWN_ROLES.has(roleName)) continue;

		// Check if the next sibling is a <code> element
		const codeEl = textNode.nextElementSibling;
		if (!codeEl || codeEl.tagName !== "CODE") continue;

		// Get the content from the <code> element (excluding Obsidian's copy icon)
		const codeContent = getCodeTextContent(codeEl);
		if (!codeContent) continue;

		// Build the rendered role span
		const span = document.createElement("span");
		span.addClass("myst-role");
		span.addClass(`myst-role-${roleName}`);

		// Math roles: render via MarkdownRenderer (uses Obsidian's MathJax)
		// No label — the rendered math is the output
		if (roleName === "math" || roleName === "m") {
			const mathContainer = span.createSpan({ cls: "myst-role-math" });
			if (pluginApp) {
				// Render $content$ as markdown — Obsidian will invoke MathJax.
				// MarkdownRenderer.render() wraps output in a block div,
				// which causes a line break for inline math. We render into
				// a temporary container, then move only the math element out.
				const tempDiv = document.body.createDiv({ cls: "myst-math-temp" });
				tempDiv.style.display = "none";
				await MarkdownRenderer.render(
					pluginApp,
					`$${codeContent}$`,
					tempDiv,
					ctx.sourcePath,
					new Component(),
				);
				// Find the rendered math element and move it into the span
				const mathEl = tempDiv.querySelector(".math") ?? tempDiv.querySelector("span.math-inline");
				if (mathEl) {
					mathContainer.appendChild(mathEl.cloneNode(true));
				} else {
					// Fallback: use whatever was rendered
					mathContainer.innerHTML = tempDiv.innerHTML;
				}
				tempDiv.remove();
			} else {
				// Fallback: plain text
				mathContainer.textContent = codeContent;
			}
		} else {
			const label = span.createSpan({ cls: "myst-role-label" });
			label.textContent = `:${roleName}:`;
			const body = span.createSpan({ cls: "myst-role-content" });
			body.textContent = codeContent;
		}

		// Replace the <code> element with the role span
		codeEl.replaceWith(span);

		// Remove the {name} from the text node
		const textBefore = text.slice(0, match.index);
		if (textBefore) {
			textNode.textContent = textBefore;
		} else {
			textNode.remove();
		}
	}
};

/**
 * Extract text content from a <code> element, excluding
 * Obsidian's injected copy-to-clipboard icon.
 */
function getCodeTextContent(codeEl: Element): string | null {
	// Get only direct text nodes (not the copy icon span)
	let content = "";
	for (const child of Array.from(codeEl.childNodes)) {
		if (child.nodeType === Node.TEXT_NODE) {
			content += child.textContent ?? "";
		}
	}
	return content || null;
}
