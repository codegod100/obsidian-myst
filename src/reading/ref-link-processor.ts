/**
 * Post-processor for CommonMark reference-style links.
 *
 * Obsidian's remark pipeline doesn't resolve `[foo][bar]` references
 * when the `[bar]: /url` definition is in a different section (or
 * sometimes at all). This post-processor:
 *
 * 1. Scans the raw markdown source for reference definitions
 * 2. Finds unresolved `[text][ref]` patterns in text nodes
 * 3. Replaces them with proper `<a>` elements
 *
 * Also handles the collapsed form `[foo][]` and the shortcut form `[foo]`.
 */

import type { MarkdownPostProcessor, MarkdownPostProcessorContext } from "obsidian";
import type { App, Vault } from "obsidian";

// Reference definition in raw markdown: [label]: url "optional title"
const REF_DEF_RAW_RE = /^\[([^\]]+)\]:\s+<(\S+)>(?:\s+"([^"]*)")?$/;
const REF_DEF_RAW_RE2 = /^\[([^\]]+)\]:\s+(\S+)(?:\s+"([^"]*)")?$/;

/**
 * Cached reference definitions per file path.
 * Key: lowercase label, Value: { url, title? }
 */
const refDefsCache: Map<string, Map<string, { url: string; title?: string }>> = new Map();

/** App reference for vault access */
let refLinkApp: App | null = null;

export function setRefLinkApp(app: App): void {
	refLinkApp = app;
}

/**
 * Scan raw markdown for reference definitions and cache them per file path.
 */
async function scanRawMarkdown(sourcePath: string): Promise<void> {
	// Return cached if available
	if (refDefsCache.has(sourcePath)) return;

	const defs = new Map<string, { url: string; title?: string }>();

	if (refLinkApp) {
		try {
			const file = refLinkApp.vault.getAbstractFileByPath(sourcePath);
			if (file) {
				const content = await refLinkApp.vault.read(file);
				for (const line of content.split("\n")) {
					let match = line.match(REF_DEF_RAW_RE);
					if (!match) match = line.match(REF_DEF_RAW_RE2);
					if (!match) continue;

					const label = match[1].toLowerCase();
					const url = match[2];
					const title = match[3];
					defs.set(label, { url, title });
				}
			}
		} catch {
			// File might not be readable, use empty map
		}
	}

	refDefsCache.set(sourcePath, defs);
}

/**
 * Get reference definitions for a file path.
 * Scans the raw markdown if not cached yet.
 */
function getRefDefs(sourcePath: string): Map<string, { url: string; title?: string }> {
	return refDefsCache.get(sourcePath) ?? new Map();
}

/**
 * Resolve reference-style links at the innerHTML level.
 *
 * Working at the innerHTML level handles cases where the link text
 * contains HTML elements (e.g. inline math spans from $...$),
 * which break the pattern across multiple DOM nodes.
 */
function resolveRefLinks(el: HTMLElement, defs: Map<string, { url: string; title?: string }>): void {
	if (defs.size === 0) return;

	// Process leaf containers that might contain inline text
	const containers = el.querySelectorAll("p, li, dd, td, th, h1, h2, h3, h4, h5, h6");
	for (const container of [el, ...Array.from(containers)]) {
		if (!(container instanceof HTMLElement)) continue;
		resolveRefLinksInContainer(container, defs);
	}
}

// Pattern for [text][ref] where text may contain HTML tags (e.g. <span class="math inline">...)
// Matches: [ (non-] chars or HTML tags)+ ][ optional ref label ]
const FULL_REF_HTML_RE = /\[((?:[^\]]|<[^>]*>)+)\]\[([^\]]*)\]/g;

// Shortcut form: [text] not followed by [
const SHORTCUT_REF_HTML_RE = /(?<!\[)\[([^\]<>]+)\](?!\[)/g;

function resolveRefLinksInContainer(container: HTMLElement, defs: Map<string, { url: string; title?: string }>): void {
	// Skip containers that are inside <code> or <a>
	if (container.closest("code, a, pre")) return;

	const html = container.innerHTML;
	let result = html;
	let changed = false;

	// Full form: [text][ref] — link text may contain HTML (inline math, etc.)
	result = result.replace(FULL_REF_HTML_RE, (match, linkTextHtml, refLabel) => {
		const label = refLabel ? refLabel.toLowerCase() : stripHtml(linkTextHtml).toLowerCase();
		const def = defs.get(label);
		if (!def) return match;

		changed = true;
		return buildLinkHtml(def, linkTextHtml);
	});

	// Shortcut form: [text] — only plain text (no HTML inside)
	if (!changed) {
		result = result.replace(SHORTCUT_REF_HTML_RE, (match, linkText) => {
			if (linkText.startsWith("!") || linkText.startsWith("[")) return match;
			const label = linkText.toLowerCase();
			const def = defs.get(label);
			if (!def) return match;

			changed = true;
			return buildLinkHtml(def, escapeHtml(linkText));
		});
	}

	if (changed) {
		container.innerHTML = result;
		// Wire up anchor link click handlers
		for (const a of Array.from(container.querySelectorAll<HTMLAnchorElement>("a.myst-ref-link"))) {
			if (a.href.startsWith("#") || a.getAttribute("href")?.startsWith("#")) {
				const href = a.getAttribute("href") ?? "";
				a.addEventListener("click", (e) => {
					e.preventDefault();
					const target = document.getElementById(href.slice(1));
					if (target) target.scrollIntoView({ behavior: "smooth" });
				});
			}
		}
	}
}

/**
 * Build an <a> element HTML string from a resolved reference.
 */
function buildLinkHtml(def: { url: string; title?: string }, linkTextHtml: string): string {
	const href = escapeAttr(def.url);
	const title = def.title ? ` title="${escapeAttr(def.title)}"` : "";
	const target = def.url.startsWith("#") ? "" : ` target="_blank" rel="noopener"`;
	return `<a href="${href}"${target}${title} class="myst-ref-link">${linkTextHtml}</a>`;
}

/**
 * Strip HTML tags to get plain text content.
 */
function stripHtml(html: string): string {
	return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
}

/**
 * Escape a string for use in an HTML attribute value.
 */
function escapeAttr(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Escape a string for use in HTML text content.
 */
function escapeHtml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Post-processor: scan raw markdown for ref defs, then resolve links.
 */
export const refLinkPostProcessor: MarkdownPostProcessor = async (
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext,
) => {
	const sourcePath = ctx.sourcePath;

	// Ensure definitions are cached for this file
	await scanRawMarkdown(sourcePath);

	const defs = getRefDefs(sourcePath);
	resolveRefLinks(el, defs);

	// Also remove any rendered reference definitions from the DOM
	// (Obsidian sometimes renders them as visible paragraphs)
	removeRenderedRefDefs(el);
};

/**
 * Remove rendered reference definition paragraphs from the DOM.
 * These look like <p>[label]: url</p> and shouldn't be visible.
 */
function removeRenderedRefDefs(el: HTMLElement): void {
	const paragraphs = el.querySelectorAll("p");

	for (const p of Array.from(paragraphs)) {
		const text = p.textContent?.trim() ?? "";
		let match = text.match(REF_DEF_RAW_RE);
		if (!match) match = text.match(REF_DEF_RAW_RE2);
		if (!match) continue;

		p.remove();
	}
}

/**
 * Invalidate cached definitions for a file path.
 * Call when a file is modified.
 */
export function invalidateRefDefs(sourcePath: string): void {
	refDefsCache.delete(sourcePath);
}

/**
 * Clear all cached reference definitions.
 */
export function clearRefDefs(): void {
	refDefsCache.clear();
}
