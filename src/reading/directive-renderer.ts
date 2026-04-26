import type { MarkdownPostProcessor } from "obsidian";
import { Component, MarkdownRenderer, type App } from "obsidian";
import { KNOWN_DIRECTIVES } from "src/shared/myst-types";

/**
 * Post-processor for MyST directives.
 *
 * Obsidian processes sections independently — sometimes before they're
 * attached to the DOM. PDF export may pass the entire document as one
 * element. So we:
 * - Process ALL matching children (no early return after first match)
 * - Use document-level placeholder search for cross-section directives
 * - Handle both single-element and multi-element directive blocks
 */
export const directivePostProcessor: MarkdownPostProcessor = (el: HTMLElement) => {
	processFenceDirectives(el);
	processCodeBlockDirectives(el);
};

// --- ::: fence form ---

const OPEN_FENCE_RE = /^:::+\s*\{([a-zA-Z][a-zA-Z0-9_:.-]*)\}/;
const DIRECTIVE_BLOCK_RE = /(^|[\n\r]):::+\s*\{([a-zA-Z][a-zA-Z0-9_:.-]*)\}([^\n\r]*)([\s\S]*?)\n:::+\s*$/m;
const TRAILING_CLOSE_FENCE_RE = /\n:::+\s*$/;
const STANDALONE_CLOSE_FENCE_RE = /^:::+\s*$/;

const OPEN_PLACEHOLDER_CLASS = "myst-directive-open";

/** App reference for MarkdownRenderer.render (math directives) */
let directiveApp: App | null = null;

export function setDirectiveRendererApp(app: App): void {
	directiveApp = app;
}

function processFenceDirectives(el: HTMLElement): void {
	// Check if this section contains a closing fence that completes
	// a previously opened directive from a different section.
	const placeholder = document.querySelector(`.${OPEN_PLACEHOLDER_CLASS}`);
	if (placeholder && placeholder instanceof HTMLElement) {
		tryCloseFromDocument(el, placeholder);
		// Don't return — this section might also have its own directives
	}

	// Case 1: Single elements containing the full directive block
	// Process ALL matching children, not just the first one
	for (const child of Array.from(el.children)) {
		if (!(child instanceof HTMLElement)) continue;

		const text = child.textContent ?? "";
		const match = text.match(DIRECTIVE_BLOCK_RE);
		if (!match) continue;

		const directiveName = match[2];
		if (!KNOWN_DIRECTIVES.has(directiveName)) continue;

		const restOfLine = match[3].trim();
		const body = match[4].trim();

		const parsed = parseDirectiveSource(
			restOfLine ? restOfLine + "\n" + body : body,
			directiveName,
		);

		const container = createDirectiveElement(parsed);
		child.replaceWith(container);
	}

	// Case 2: Multi-element within this section
	const children = Array.from(el.children);
	let i = 0;

	while (i < children.length) {
		const child = children[i];
		if (!(child instanceof HTMLElement)) {
			i++;
			continue;
		}

		const text = child.textContent ?? "";
		const openMatch = text.match(OPEN_FENCE_RE);

		if (openMatch) {
			const directiveName = openMatch[1];
			if (!KNOWN_DIRECTIVES.has(directiveName)) {
				i++;
				continue;
			}

			const restOfLine = text.replace(OPEN_FENCE_RE, "").trim();
			const openingParsed = parseDirectiveSource(restOfLine, directiveName);

			const bodyParts: string[] = [];
			let closed = false;
			let j = i + 1;

			while (j < children.length) {
				const sibling = children[j];
				if (!(sibling instanceof HTMLElement)) {
					j++;
					continue;
				}

				const siblingText = sibling.textContent ?? "";

				if (STANDALONE_CLOSE_FENCE_RE.test(siblingText.trim())) {
					closed = true;
					j++;
					break;
				}

				const trailingMatch = siblingText.match(TRAILING_CLOSE_FENCE_RE);
				if (trailingMatch) {
					const bodyBefore = siblingText.slice(0, trailingMatch.index).trim();
					if (bodyBefore) bodyParts.push(bodyBefore);
					closed = true;
					j++;
					break;
				}

				bodyParts.push(siblingText.trim());
				j++;
			}

			if (closed) {
				const fullBody = [...openingParsed.body.split("\n").filter((l) => l), ...bodyParts].join("\n");
				const parsed: ParsedDirective = {
					name: directiveName,
					argument: openingParsed.argument,
					options: openingParsed.options,
					body: fullBody,
				};

				const container = createDirectiveElement(parsed);
				child.remove();
				for (let k = i + 1; k < j; k++) {
					if (children[k] instanceof HTMLElement) {
						children[k].remove();
					}
				}
				el.insertBefore(container, children[Math.min(j, children.length)] ?? null);
				i = j;
			} else {
				// No closing fence in this section — place a DOM placeholder
				const placeholder = document.createElement("div");
				placeholder.addClass(OPEN_PLACEHOLDER_CLASS);
				placeholder.setAttribute("data-directive-name", directiveName);
				placeholder.setAttribute("data-directive-argument", openingParsed.argument);
				placeholder.setAttribute("data-directive-body", [openingParsed.body, ...bodyParts].filter((p) => p.trim()).join("\n"));
				for (const [key, value] of Object.entries(openingParsed.options)) {
					placeholder.setAttribute(`data-directive-opt-${key}`, value);
				}
				placeholder.style.display = "none";
				child.replaceWith(placeholder);
				for (let k = i + 1; k < j; k++) {
					if (children[k] instanceof HTMLElement) {
						children[k].remove();
					}
				}
				i = j;
			}
		} else {
			i++;
		}
	}
}

/**
 * Try to close an open directive by finding a placeholder in the document
 * and a closing fence in the current section.
 */
function tryCloseFromDocument(el: HTMLElement, placeholder: HTMLElement): boolean {
	const children = Array.from(el.children);
	const bodyParts: string[] = [];
	let closed = false;

	for (const child of children) {
		if (!(child instanceof HTMLElement)) continue;

		const text = child.textContent ?? "";

		if (STANDALONE_CLOSE_FENCE_RE.test(text.trim())) {
			closed = true;
			break;
		}

		const trailingMatch = text.match(TRAILING_CLOSE_FENCE_RE);
		if (trailingMatch) {
			const bodyBefore = text.slice(0, trailingMatch.index).trim();
			if (bodyBefore) bodyParts.push(bodyBefore);
			closed = true;
			break;
		}

		// Don't consume new opening fences as body content
		if (OPEN_FENCE_RE.test(text)) {
			break;
		}

		if (text.trim()) {
			bodyParts.push(text.trim());
		}
	}

	if (!closed) return false;

	const directiveName = placeholder.getAttribute("data-directive-name") ?? "";
	const argument = placeholder.getAttribute("data-directive-argument") ?? "";
	const existingBody = placeholder.getAttribute("data-directive-body") ?? "";

	const options: Record<string, string> = {};
	for (const attr of Array.from(placeholder.attributes)) {
		if (attr.name.startsWith("data-directive-opt-")) {
			const key = attr.name.slice("data-directive-opt-".length);
			options[key] = attr.value;
		}
	}

	const fullBody = [existingBody, ...bodyParts].filter((p) => p.trim()).join("\n");

	const parsed: ParsedDirective = {
		name: directiveName,
		argument,
		options,
		body: fullBody,
	};

	const container = createDirectiveElement(parsed);
	placeholder.replaceWith(container);

	// Remove consumed elements from this section
	for (const child of Array.from(el.children)) {
		if (!(child instanceof HTMLElement)) continue;
		const text = child.textContent ?? "";
		if (STANDALONE_CLOSE_FENCE_RE.test(text.trim())) {
			child.remove();
			break;
		}
		if (TRAILING_CLOSE_FENCE_RE.test(text)) {
			child.remove();
			break;
		}
		child.remove();
	}

	return true;
}

// --- Code-block form ---

function processCodeBlockDirectives(el: HTMLElement): void {
	const preElements = el.querySelectorAll("pre");

	for (const pre of Array.from(preElements)) {
		const code = pre.querySelector("code");
		if (!code) continue;

		const lang = extractDirectiveLanguage(code);
		if (!lang) continue;

		const source = code.textContent ?? "";
		const parsed = parseDirectiveSource(source, lang);

		const container = createDirectiveElement(parsed);
		pre.replaceWith(container);
	}
}

function extractDirectiveLanguage(code: HTMLElement): string | null {
	const classes = code.className;

	const langMatch = classes.match(/language-\{([^}]+)\}/);
	if (langMatch) {
		const name = langMatch[1];
		if (KNOWN_DIRECTIVES.has(name)) {
			return name;
		}
	}

	const plainMatch = classes.match(/language-([a-z][-a-z]*)/);
	if (plainMatch) {
		const name = plainMatch[1];
		if (KNOWN_DIRECTIVES.has(name)) {
			return name;
		}
	}

	return null;
}

// --- Shared ---

function createDirectiveElement(parsed: ParsedDirective): HTMLElement {
	const container = document.createElement("div");
	container.className = "myst-directive";
	container.addClass(`myst-directive-${parsed.name}`);

	if (parsed.name === "figure") {
		return createFigureElement(parsed, container);
	}
	if (parsed.name === "image") {
		return createImageElement(parsed, container);
	}
	if (parsed.name === "code-block") {
		return createCodeBlockElement(parsed, container);
	}
	if (parsed.name === "math") {
		return createMathElement(parsed, container);
	}

	if (parsed.argument || parsed.name) {
		const header = container.createDiv({ cls: "myst-directive-header" });
		const label = header.createSpan({ cls: "myst-directive-label" });
		label.textContent = parsed.name;
		if (parsed.argument) {
			const title = header.createSpan({ cls: "myst-directive-title" });
			title.textContent = parsed.argument;
		}
	}

	if (Object.keys(parsed.options).length > 0) {
		const optionsEl = container.createDiv({ cls: "myst-directive-options" });
		for (const [key, value] of Object.entries(parsed.options)) {
			const opt = optionsEl.createDiv({ cls: "myst-directive-option" });
			const keyEl = opt.createSpan({ cls: "myst-directive-option-key" });
			keyEl.textContent = `${key}:`;
			const valEl = opt.createSpan({ cls: "myst-directive-option-value" });
			valEl.textContent = value;
		}
	}

	if (parsed.body) {
		const bodyEl = container.createDiv({ cls: "myst-directive-body" });
		const lines = parsed.body.split("\n");
		for (const line of lines) {
			const p = bodyEl.createEl("p");
			p.textContent = line;
			if (!line) p.addClass("myst-directive-blank-line");
		}
	}

	if (isAdmonitionDirective(parsed.name)) {
		container.addClass("myst-admonition");
		container.addClass(`myst-admonition-${parsed.name}`);
	}

	return container;
}

function createFigureElement(parsed: ParsedDirective, container: HTMLElement): HTMLElement {
	const img = container.createEl("img", {
		cls: "myst-figure-image",
		attr: {
			src: parsed.argument,
			alt: parsed.options.alt ?? "",
		},
	});

	if (parsed.options.width) img.setAttribute("width", parsed.options.width);
	if (parsed.options.height) img.setAttribute("height", parsed.options.height);
	if (parsed.options.align) container.addClass(`myst-figure-${parsed.options.align}`);

	if (parsed.body) {
		const caption = container.createDiv({ cls: "myst-figure-caption" });
		caption.textContent = parsed.body;
	}

	return container;
}

function createImageElement(parsed: ParsedDirective, container: HTMLElement): HTMLElement {
	const img = container.createEl("img", {
		cls: "myst-image",
		attr: {
			src: parsed.argument,
			alt: parsed.options.alt ?? "",
		},
	});

	if (parsed.options.width) img.setAttribute("width", parsed.options.width);
	if (parsed.options.height) img.setAttribute("height", parsed.options.height);

	return container;
}

function createCodeBlockElement(parsed: ParsedDirective, container: HTMLElement): HTMLElement {
	const pre = container.createEl("pre", { cls: "myst-code-block" });
	const code = pre.createEl("code", { cls: `language-${parsed.argument}` });
	code.textContent = parsed.body;

	if (parsed.options.linenos) container.addClass("myst-code-linenos");
	if (parsed.options.caption) {
		const caption = container.createDiv({ cls: "myst-code-caption" });
		caption.textContent = parsed.options.caption;
	}

	return container;
}

function createMathElement(parsed: ParsedDirective, container: HTMLElement): HTMLElement {
	if (directiveApp) {
		// Render $$body$$ through Obsidian's MathJax pipeline.
		// MarkdownRenderer.render wraps in a block div, so we render
		// into a temp container and move the math element out.
		const tempDiv = document.body.createDiv({ cls: "myst-math-temp" });
		tempDiv.style.display = "none";
		MarkdownRenderer.render(
			directiveApp,
			`$$${parsed.body}$$`,
			tempDiv,
			"",
			new Component(),
		);
		const mathEl = tempDiv.querySelector(".math-block") ?? tempDiv.querySelector(".math");
		if (mathEl) {
			container.appendChild(mathEl.cloneNode(true));
		} else {
			// Fallback: use whatever was rendered
			container.innerHTML = tempDiv.innerHTML;
		}
		tempDiv.remove();
	} else {
		// Fallback: plain text
		const mathEl = container.createSpan({ cls: "math math-block" });
		mathEl.textContent = parsed.body;
	}

	if (parsed.options.label) {
		container.setAttribute("data-label", parsed.options.label);
	}

	return container;
}

interface ParsedDirective {
	name: string;
	argument: string;
	options: Record<string, string>;
	body: string;
}

function parseDirectiveSource(source: string, directiveName: string): ParsedDirective {
	const lines = source.split("\n");
	let argument = "";
	const options: Record<string, string> = {};
	const bodyLines: string[] = [];
	let pastOptions = false;
	let blankLineSeen = false;

	for (const line of lines) {
		if (pastOptions) {
			bodyLines.push(line);
			continue;
		}

		if (line.trim() === "") {
			blankLineSeen = true;
			pastOptions = true;
			continue;
		}

		const optionMatch = line.match(/^:([a-zA-Z0-9_-]+):\s*(.*)/);
		if (optionMatch && !blankLineSeen) {
			options[optionMatch[1]] = optionMatch[2].trim();
			continue;
		}

		if (!argument && !blankLineSeen) {
			argument = line.trim();
			continue;
		}

		pastOptions = true;
		bodyLines.push(line);
	}

	return {
		name: directiveName,
		argument,
		options,
		body: bodyLines.join("\n"),
	};
}

const ADMONITION_NAMES = new Set([
	"admonition",
	"note",
	"warning",
	"danger",
	"attention",
	"caution",
	"important",
	"hint",
	"tip",
	"seealso",
	"todo",
	"topic",
	"sidebar",
	"margin",
	"error",
	"dropdown",
]);

function isAdmonitionDirective(name: string): boolean {
	return ADMONITION_NAMES.has(name);
}
