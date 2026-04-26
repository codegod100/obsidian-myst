import type { MarkdownPostProcessorContext } from "obsidian";

/**
 * Code block processor for MyST directives.
 *
 * Handles ```{directive-name} fenced code blocks that Obsidian
 * recognizes as code blocks. The source text contains the directive
 * argument, options, and body.
 *
 * Input format (the raw source inside the fence):
 *   Title text
 *   :key: value
 *
 *   Body content here.
 */
export function directiveCodeBlockProcessor(
	source: string,
	el: HTMLElement,
	_ctx: MarkdownPostProcessorContext,
): void {
	const parsed = parseDirectiveSource(source);
	const container = el.createDiv({ cls: "myst-directive" });

	// Add directive type class
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
		// Render body as plain text for now; future: recurse for nested MyST
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
function parseDirectiveSource(source: string): ParsedDirective {
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

	// The directive name isn't in the source — it's in the fence line.
	// We'll need to extract it from the code block language, which Obsidian
	// passes as part of the context. For now, we try to infer it from the
	// class on the container element, or default to "directive".
	return {
		name: "directive",
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
