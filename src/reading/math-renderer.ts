import type { MarkdownPostProcessor } from "obsidian";

/**
 * Post-processor for dollar-math ($...$ and $$...$$).
 *
 * Obsidian already handles $$...$$ display math via MathJax.
 * This processor handles:
 * - $...$ inline math (if Obsidian doesn't already render it)
 * - Dollar-math that survived the remark parse but wasn't rendered
 */
export const dollarMathPostProcessor: MarkdownPostProcessor = (el: HTMLElement) => {
	// Check if Obsidian already rendered this as math
	// Obsidian wraps math in <span class="math"> or <div class="math-block">
	// We only process unrendered dollar-math in text nodes

	walkTextNodes(el, (textNode) => {
		const text = textNode.text;
		if (!text.includes("$")) return;

		// Inline math: $...$ (not $$)
		// Avoid matching currency like $5.00
		const inlineMathPattern = /(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g;

		const result = text.replace(inlineMathPattern, (_match, content: string) => {
			// Skip if content looks like currency (digits + optional decimal)
			if (/^\d+\.?\d*$/.test(content.trim())) return _match;
			return `\x00MATH:${content}\x00`;
		});

		if (result === text) return;

		const fragment = document.createDocumentFragment();
		const parts = result.split(/(\x00MATH:([^\x00]+)\x00)/g);

		for (let i = 0; i < parts.length; i++) {
			if (i % 3 === 0) {
				if (parts[i]) fragment.appendChild(document.createTextNode(parts[i]));
			} else if (i % 3 === 1) {
				// Skip full match
			} else if (i % 3 === 2) {
				const mathContent = parts[i];
				const span = document.createElement("span");
				span.addClass("math", "myst-dollar-math");
				span.textContent = mathContent;
				fragment.appendChild(span);
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
