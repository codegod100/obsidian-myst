import type { MarkdownPostProcessor } from "obsidian";

/**
 * Post-processor for MyST inline roles.
 *
 * Scans rendered HTML for raw role syntax: {name}`content`
 * and replaces it with styled spans.
 *
 * Note: Obsidian's remark parser may mangle the backtick content.
 * If the role syntax survives the remark parse intact, we render it.
 * If not, this processor will be a no-op for those cases.
 */
export const rolePostProcessor: MarkdownPostProcessor = (el: HTMLElement) => {
	// Role pattern: {name}`content` or {name}`content <target>`
	// The remark parser may or may not preserve these in the output.
	// We search text nodes for the raw pattern.
	const rolePattern = /\{([a-zA-Z][a-zA-Z0-9_:.-]*)\}`([^`]+)`/g;

	walkTextNodes(el, (textNode) => {
		const text = textNode.text;
		if (!text.includes("{") || !text.includes("`")) return;

		const result = text.replace(rolePattern, (_match, name: string, content: string) => {
			// Return a placeholder that we'll replace with a real element
			return `\x00ROLE:${name}:${content}\x00`;
		});

		if (result === text) return;

		// Split on placeholders and build a fragment
		const fragment = document.createDocumentFragment();
		const parts = result.split(/(\x00ROLE:([^:]+):([^\x00]+)\x00)/g);

		for (let i = 0; i < parts.length; i++) {
			if (i % 4 === 0) {
				// Plain text
				if (parts[i]) fragment.appendChild(document.createTextNode(parts[i]));
			} else if (i % 4 === 1) {
				// Skip the full match (we use the captured groups)
			} else if (i % 4 === 2) {
				// Role name
				const roleName = parts[i];
				const roleContent = parts[i + 1];
				const span = document.createElement("span");
				span.addClass("myst-role");
				span.addClass(`myst-role-${roleName}`);
				const label = span.createSpan({ cls: "myst-role-label" });
				label.textContent = `:${roleName}:`;
				const body = span.createSpan({ cls: "myst-role-content" });
				body.textContent = roleContent;
				fragment.appendChild(span);
				i++; // Skip the content part (already consumed)
			}
		}

		textNode.node?.parentNode?.replaceChild(fragment, textNode.node);
	});
};

interface TextNodeInfo {
	node: Text;
	text: string;
}

function walkTextNodes(root: HTMLElement, callback: (info: TextNodeInfo) => void): void {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const nodes: Text[] = [];

	let current: Text | null;
	while ((current = walker.nextNode() as Text | null)) {
		nodes.push(current);
	}

	for (const node of nodes) {
		callback({ node, text: node.textContent ?? "" });
	}
}
