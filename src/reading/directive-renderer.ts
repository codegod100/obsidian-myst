import type { MarkdownPostProcessor } from "obsidian";
import { KNOWN_DIRECTIVES } from "src/shared/myst-types";

/**
 * Post-processor for MyST directives.
 *
 * Obsidian's remark parser doesn't recognize `:::` as a code fence — it renders
 * `:::{note}\ncontent\n:::` as a single <p> element with <br> tags:
 *   <p>:::{note}<br>content<br>:::</p>
 *
 * So we scan child elements whose text content contains the full
 * `:::{name}` ... `:::` pattern, parse it, and replace the element.
 *
 * We also handle the multi-paragraph case (blank lines between sections)
 * where opening fence, body, and closing fence are separate <p> elements.
 *
 * And we handle the ````{name}```` code-block form where Obsidian renders
 * `<pre><code class="language-{name}">` elements.
 */
export const directivePostProcessor: MarkdownPostProcessor = (el: HTMLElement) => {
	processFenceDirectives(el);
	processCodeBlockDirectives(el);
};

// --- ::: fence form ---

const OPEN_FENCE_RE = /^:::+\s*\{([a-zA-Z][a-zA-Z0-9_:.-]*)\}/;
const CLOSE_FENCE_RE = /^:::+\s*$/;

/**
 * Full directive block pattern — matches the entire `:::{name}` ... `:::` 
 * within a single text node. Captures: directive name, rest of opening line, body.
 */
const DIRECTIVE_BLOCK_RE = /(^|[\n\r]):::+\s*\{([a-zA-Z][a-zA-Z0-9_:.-]*)\}([^\n\r]*)([\s\S]*?)\n:::+\s*$/m;

function processFenceDirectives(el: HTMLElement): void {
	// Case 1: Single element containing the full directive block
	// (most common — Obsidian renders `:::{note}\ncontent\n:::` as one <p>)
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
		return; // Post-processor re-runs for each section; one match per call
	}

	// Case 2: Multi-element — opening fence, body paragraphs, closing fence
	// are separate child elements (happens when blank lines separate them)
	const children = Array.from(el.children);
	let i = 0;

	while (i < children.length) {
		const child = children[i];
		if (!(child instanceof HTMLElement)) {
			i++;
			continue;
		}

		const text = child.textContent?.trim() ?? "";
		const openMatch = text.match(OPEN_FENCE_RE);

		if (openMatch) {
			const directiveName = openMatch[1];
			if (!KNOWN_DIRECTIVES.has(directiveName)) {
				i++;
				continue;
			}

			const restOfLine = text.replace(OPEN_FENCE_RE, "").trim();

			// Collect body elements until closing fence
			const bodyElements: HTMLElement[] = [];
			let closed = false;
			let j = i + 1;

			while (j < children.length) {
				const sibling = children[j];
				if (!(sibling instanceof HTMLElement)) {
					j++;
					continue;
				}

				const siblingText = sibling.textContent?.trim() ?? "";
				if (CLOSE_FENCE_RE.test(siblingText)) {
					closed = true;
					j++;
					break;
				}
				bodyElements.push(sibling);
				j++;
			}

			if (closed) {
				const bodyText = bodyElements.map((e) => e.textContent ?? "").join("\n");
				const parsed = parseDirectiveSource(
					restOfLine ? restOfLine + "\n" + bodyText : bodyText,
					directiveName,
				);

				const container = createDirectiveElement(parsed);

				// Remove old elements
				child.remove();
				for (const bodyEl of bodyElements) {
					bodyEl.remove();
				}
				const closeEl = children[j - 1];
				if (closeEl instanceof HTMLElement) {
					closeEl.remove();
				}

				el.insertBefore(container, children[i + 1] ?? null);
				i = j;
			} else {
				i++;
			}
		} else {
			i++;
		}
	}
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

/**
 * Extract a MyST directive name from a code element's class list.
 * Obsidian renders ```{note} as <code class="language-{note}">.
 */
function extractDirectiveLanguage(code: HTMLElement): string | null {
	const classes = code.className;

	// Match language-{name} patterns (with braces)
	const langMatch = classes.match(/language-\{([^}]+)\}/);
	if (langMatch) {
		const name = langMatch[1];
		if (KNOWN_DIRECTIVES.has(name)) {
			return name;
		}
	}

	// Also match plain language-name (without braces) for known directives
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

	// Header with directive name and argument
	if (parsed.argument || parsed.name) {
		const header = container.createDiv({ cls: "myst-directive-header" });
		const label = header.createSpan({ cls: "myst-directive-label" });
		label.textContent = parsed.name;
		if (parsed.argument) {
			const title = header.createSpan({ cls: "myst-directive-title" });
			title.textContent = parsed.argument;
		}
	}

	// Options (if any)
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

	// Body
	if (parsed.body) {
		const bodyEl = container.createDiv({ cls: "myst-directive-body" });
		const lines = parsed.body.split("\n");
		for (const line of lines) {
			const p = bodyEl.createEl("p");
			p.textContent = line;
			if (!line) p.addClass("myst-directive-blank-line");
		}
	}

	// Admonition-specific styling
	if (isAdmonitionDirective(parsed.name)) {
		container.addClass("myst-admonition");
		container.addClass(`myst-admonition-${parsed.name}`);
	}

	return container;
}

interface ParsedDirective {
	name: string;
	argument: string;
	options: Record<string, string>;
	body: string;
}

/**
 * Parse raw directive source into structured parts.
 *
 * Expected format:
 *   Title argument
 *   :option-key: option value
 *   :another-key: another value
 *
 *   Body content starts after blank line.
 */
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

		// Blank line separates options from body
		if (line.trim() === "") {
			blankLineSeen = true;
			pastOptions = true;
			continue;
		}

		// Option line: :key: value
		const optionMatch = line.match(/^:([a-zA-Z0-9_-]+):\s*(.*)/);
		if (optionMatch && !blankLineSeen) {
			options[optionMatch[1]] = optionMatch[2].trim();
			continue;
		}

		// If we haven't seen options yet and this isn't an option, it's the argument
		if (!argument && !blankLineSeen) {
			argument = line.trim();
			continue;
		}

		// Everything else is body
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
