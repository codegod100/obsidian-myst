import {
	App,
	Component,
	MarkdownRenderer,
	MarkdownView,
	Notice,
	TFile,
	arrayBufferToBase64,
} from "obsidian";
import type MystPlugin from "src/main";

/**
 * Exports a rendered note to a self-contained HTML file.
 *
 * Uses MarkdownRenderer.render() into an attached div so that
 * all post-processors (directives, roles, math) run with full
 * DOM access — unlike Obsidian's built-in PDF export which
 * processes detached sections.
 */
export class HtmlExporter {
	private app: App;
	private plugin: MystPlugin;

	constructor(app: App, plugin: MystPlugin) {
		this.app = app;
		this.plugin = plugin;
	}

	/**
	 * Render the current note and copy the HTML to the clipboard.
	 */
	async copyToClipboard(): Promise<void> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view || !view.file) {
			new Notice("No active markdown file to export.");
			return;
		}

		const html = await this.renderToHtml(view.data, view.file.path);

		const textBlob = new Blob([html], { type: "text/plain" });
		const htmlBlob = new Blob([html], { type: "text/html" });

		const clipboardItem = new ClipboardItem({
			[textBlob.type]: textBlob,
			[htmlBlob.type]: htmlBlob,
		});

		try {
			await navigator.clipboard.write([clipboardItem]);
			new Notice("HTML copied to clipboard!");
		} catch (err) {
			new Notice(`Failed to copy: ${err.message}`);
		}
	}

	/**
	 * Render the current note and download it as an HTML file.
	 */
	async downloadAsFile(): Promise<void> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view || !view.file) {
			new Notice("No active markdown file to export.");
			return;
		}

		const html = await this.renderToHtml(view.data, view.file.path);
		const blob = new Blob([html], { type: "text/html" });
		const filename = `${view.file.basename}.html`;

		downloadBlob(blob, filename);
		new Notice(`Exported as ${filename}`);
	}

	/**
	 * Core render: markdown → HTML string wrapped in a standalone document.
	 */
	async renderToHtml(markdown: string, sourcePath: string): Promise<string> {
		const component = new Component();
		component.load();

		// Create a hidden div attached to the document so post-processors
		// can access the full DOM (placeholders, querySelector, etc.)
		const wrapper = document.body.createDiv();
		wrapper.style.display = "none";

		await MarkdownRenderer.render(
			this.app,
			markdown,
			wrapper,
			sourcePath,
			component,
		);

		// Wait for async post-processors to settle
		await this.untilRendered(wrapper);

		// Clean up Obsidian-internal elements
		this.cleanRenderedOutput(wrapper);

		// Embed vault images as base64
		await this.embedImages(wrapper);

		const bodyHtml = wrapper.innerHTML;
		wrapper.remove();
		component.unload();

		// Build standalone HTML document
		return await this.wrapInHtmlDocument(bodyHtml);
	}

	/**
	 * Wait for async rendering to settle, including MathJax.
	 *
	 * Use a MutationObserver to detect when the DOM stops changing.
	 * After 300ms with no mutations, consider rendering complete.
	 * Then do an extra wait for MathJax which renders on its own schedule.
	 */
	private async untilRendered(el: HTMLElement): Promise<void> {
		await new Promise<void>((resolve) => {
			let timeoutId: ReturnType<typeof setTimeout>;

			const observer = new MutationObserver(() => {
				clearTimeout(timeoutId);
				timeoutId = setTimeout(() => {
					observer.disconnect();
					resolve();
				}, 300);
			});

			observer.observe(el, {
				childList: true,
				subtree: true,
				characterData: true,
				attributes: true,
			});

			// Initial timeout in case no mutations happen at all
			timeoutId = setTimeout(() => {
				observer.disconnect();
				resolve();
			}, 1000);
		});

		// MathJax renders asynchronously after the DOM is built.
		// Wait for any .math elements to be processed by MathJax.
		await this.waitForMathJax(el);
	}

	/**
	 * Wait for MathJax to finish processing math elements.
	 *
	 * MathJax replaces <span class="math"> with rendered output.
	 * We poll until no unprocessed math elements remain, or timeout.
	 */
	private async waitForMathJax(el: HTMLElement): Promise<void> {
		const maxWait = 5000;
		const pollInterval = 200;
		let waited = 0;

		while (waited < maxWait) {
			const unprocessed = el.querySelectorAll(".math:not(.MathJax)");
			if (unprocessed.length === 0) {
				// All math elements have been processed
				break;
			}
			await delay(pollInterval);
			waited += pollInterval;
		}

		// Extra settle time after MathJax finishes
		await delay(300);
	}

	/**
	 * Remove Obsidian-internal elements that shouldn't appear in export.
	 */
	private cleanRenderedOutput(el: HTMLElement): void {
		el.querySelectorAll(".copy-code-button").forEach((e) => e.remove());
		el.querySelectorAll(".collapse-indicator").forEach((e) => e.remove());
		el.querySelectorAll(".frontmatter, .frontmatter-container").forEach((e) => e.remove());
	}

	/**
	 * Convert vault-local image references to base64 data URIs
	 * so the exported HTML is self-contained.
	 */
	private async embedImages(el: HTMLElement): Promise<void> {
		const images = Array.from(el.querySelectorAll("img"));
		const promises = images.map(async (img) => {
			const src = img.src;
			if (!src) return;

			// Skip already-embedded data URIs
			if (src.startsWith("data:")) return;

			// Skip external URLs
			if (src.startsWith("http://") || src.startsWith("https://")) return;

			try {
				const dataUri = await this.resolveImageToDataUri(src);
				if (dataUri) {
					img.src = dataUri;
				}
			} catch {
				// Leave the original src if we can't resolve it
			}
		});

		await Promise.all(promises);
	}

	/**
	 * Resolve an Obsidian-internal image URI to a base64 data URI.
	 *
	 * Obsidian renders images with URIs like:
	 *   app://obsidian.md/relative/path/image.png?timestamp
	 * or
	 *   app://local/absolute/path/image.png?timestamp
	 */
	private async resolveImageToDataUri(src: string): Promise<string | null> {
		const vault = this.app.vault;

		// Try to extract a vault-relative path from the URI
		let relativePath: string | null = null;

		// Handle app://obsidian.md/path?timestamp
		const obsidianMatch = src.match(/app:\/\/[^/]+\/(.+?)(?:\?|$)/);
		if (obsidianMatch) {
			relativePath = decodeURIComponent(obsidianMatch[1]);
		}

		// Handle app://local/path?timestamp
		const localMatch = src.match(/app:\/\/local\/(.+?)(?:\?|$)/);
		if (localMatch) {
			// Try to match against vault files by basename
			const fullPath = decodeURIComponent(localMatch[1]);
			const filename = fullPath.split("/").pop();
			if (filename) {
				const file = vault.getFiles().find((f) => f.name === filename);
				if (file) {
					relativePath = file.path;
				}
			}
		}

		if (!relativePath) return null;

		const file = vault.getAbstractFileByPath(relativePath);
		if (!(file instanceof TFile)) return null;

		const buffer = await vault.adapter.readBinary(file.path);
		const mimeType = this.guessMimeType(file.extension);
		return `data:${mimeType};base64,${arrayBufferToBase64(buffer)}`;
	}

	/**
	 * Guess MIME type from file extension.
	 */
	private guessMimeType(extension: string): string {
		const mimeMap: Record<string, string> = {
			svg: "image/svg+xml",
			jpg: "image/jpeg",
			jpeg: "image/jpeg",
			png: "image/png",
			gif: "image/gif",
			webp: "image/webp",
			bmp: "image/bmp",
			ico: "image/x-icon",
		};
		return mimeMap[extension.toLowerCase()] ?? `image/${extension.toLowerCase()}`;
	}

	/**
	 * Wrap rendered HTML in a standalone document with inlined CSS.
	 */
	private async wrapInHtmlDocument(bodyHtml: string): Promise<string> {
		const css = await this.collectCss();

		return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
${css}
  </style>
</head>
<body class="markdown-body">
${bodyHtml}
</body>
</html>`;
	}

	/**
	 * Collect CSS for the exported document:
	 * 1. Obsidian theme CSS variables for correct colors
	 * 2. MathJax CSS injected into the document head
	 * 3. The plugin's own styles (myst-directive, myst-role, etc.)
	 * 4. Basic markdown-body styling for readability
	 */
	private async collectCss(): Promise<string> {
		// Snapshot Obsidian's CSS custom properties for theming
		const computedStyle = getComputedStyle(document.body);
		const cssVars: string[] = [];

		// Collect all --custom properties from the body
		for (let i = 0; i < computedStyle.length; i++) {
			const prop = computedStyle[i];
			if (prop.startsWith("--")) {
				const value = computedStyle.getPropertyValue(prop).trim();
				if (value) {
					cssVars.push(`  ${prop}: ${value};`);
				}
			}
		}

		const variablesBlock = cssVars.length
			? `:root {\n${cssVars.join("\n")}\n}`
			: "";

		// Capture MathJax CSS from the document head
		const mathJaxCss = this.collectMathJaxCss();

		// Read the plugin's styles.css from the vault
		const pluginStyles = await this.readPluginStyles();

		// Basic markdown-body styling
		const baseCss = `
body {
  font-family: var(--font-text, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif);
  font-size: var(--font-text-size, 16px);
  line-height: 1.6;
  color: var(--text-normal, #222);
  background: var(--background-primary, #fff);
  max-width: 800px;
  margin: 0 auto;
  padding: 2em;
}

.markdown-body img {
  max-width: 100%;
}

.markdown-body pre {
  overflow-x: auto;
  padding: 1em;
  background: var(--background-secondary, #f6f8fa);
  border-radius: 6px;
}

.markdown-body code {
  font-family: var(--font-monospace, monospace);
  font-size: 0.9em;
}

.markdown-body .math {
  font-family: var(--font-monospace, monospace);
  font-style: italic;
}

.markdown-body .math.math-block {
  display: block;
  text-align: center;
  margin: 1em 0;
}
`;

		return `${variablesBlock}\n${mathJaxCss}\n${pluginStyles}\n${baseCss}`;
	}

	/**
	 * Capture MathJax CSS injected into the document head.
	 * MathJax adds <style> elements with ids like "MJX-CHTML-styles".
	 */
	private collectMathJaxCss(): string {
		const styles: string[] = [];
		const styleElements = document.head.querySelectorAll("style");

		for (const style of Array.from(styleElements)) {
			const id = style.id ?? "";
			// MathJax styles have IDs starting with MJX
			if (id.startsWith("MJX") || id.toLowerCase().includes("mathjax")) {
				styles.push(style.textContent ?? "");
			}
		}

		return styles.join("\n");
	}

	/**
	 * Read the plugin's styles.css from the vault filesystem.
	 */
	private async readPluginStyles(): Promise<string> {
		try {
			const manifest = this.plugin.manifest;
			const cssPath = `.obsidian/plugins/${manifest.id}/styles.css`;
			return await this.app.vault.adapter.read(cssPath);
		} catch {
			return "";
		}
	}
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Trigger a browser download of a Blob as a file.
 */
function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
