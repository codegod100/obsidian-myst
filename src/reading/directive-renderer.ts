/**
 * Post-processor for MyST block directives in Obsidian reading mode.
 *
 * Obsidian's remark pipeline does not understand MyST `:::` fences, so we
 * parse the raw markdown source with markdown-it-myst (the same parser used
 * for export), locate directive spans from the token stream, and replace
 * the matching rendered section with custom DOM.
 */

import MarkdownIt from "markdown-it";
import { directivePlugin } from "markdown-it-myst";
import {
	Component,
	MarkdownRenderer,
	TFile,
	type App,
	type MarkdownPostProcessor,
	type MarkdownPostProcessorContext,
} from "obsidian";
/** Languages that have execution backends (checked at render time without importing kernel). */
const KNOWN_EXECUTABLE_LANGUAGES = new Set(["python", "py", "js", "javascript", "ts", "typescript"]);

let directiveApp: App | null = null;
let codeExecutionEnabled = false;

export function setDirectiveRendererApp(app: App): void {
	directiveApp = app;
}

export function setCodeExecutionEnabled(enabled: boolean): void {
	codeExecutionEnabled = enabled;
}

interface DirectiveSpan {
	startLine: number;
	endLine: number;
	name: string;
	argument: string;
	options: Record<string, string>;
	body: string;
}

interface FileCache {
	source: string;
	spans: DirectiveSpan[];
}

const fileCache = new Map<string, FileCache>();

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

export function invalidateFenceDirectiveCache(sourcePath: string): void {
	fileCache.delete(sourcePath);
}

function getSectionLineRange(sectionInfo: any): { start: number; end: number } | null {
	const start = typeof sectionInfo?.lineStart === "number"
		? sectionInfo.lineStart
		: typeof sectionInfo?.textStart === "number"
			? sectionInfo.textStart
			: null;

	const end = typeof sectionInfo?.lineEnd === "number"
		? sectionInfo.lineEnd
		: typeof sectionInfo?.textEnd === "number"
			? sectionInfo.textEnd
			: null;

	if (start === null || end === null) return null;
	return { start, end };
}

// ---------------------------------------------------------------------------
// Colon-fence rule (same as myst-parser.ts / myst-renderer.ts)
// ---------------------------------------------------------------------------

function colonFencePlugin(md: MarkdownIt): void {
	md.block.ruler.before(
		"fence",
		"colon_fence",
		function colon_fence(state, startLine, endLine, silent) {
			const pos = state.bMarks[startLine] + state.tShift[startLine];
			const max = state.eMarks[startLine];
			if (pos + 3 > max) return false;

			let colonCount = 0;
			let p = pos;
			while (p < max && state.src.charCodeAt(p) === 0x3a) {
				colonCount++;
				p++;
			}
			if (colonCount < 3) return false;

			const info = state.src.slice(p, max).trim();

			let nextLine = startLine + 1;
			let foundEnd = false;
			const colonClose = ":".repeat(colonCount);

			while (nextLine < endLine) {
				const npos = state.bMarks[nextLine] + state.tShift[nextLine];
				const nmax = state.eMarks[nextLine];
				if (npos + colonCount <= nmax) {
					let nc = 0;
					let np = npos;
					while (np < nmax && state.src.charCodeAt(np) === 0x3a) {
						nc++;
						np++;
					}
					if (nc >= colonCount && state.src.slice(np, nmax).trim() === "") {
						foundEnd = true;
						break;
					}
				}
				nextLine++;
			}

			if (!foundEnd) return false;
			if (silent) return true;

			const contentStart = state.bMarks[startLine + 1] + state.tShift[startLine + 1];
			const contentEnd = state.bMarks[nextLine];
			const content = state.src.slice(contentStart, contentEnd).trimEnd();

			const token = state.push("colon_fence", "code", 0);
			token.info = info;
			token.content = content;
			token.map = [startLine, nextLine + 1];
			token.markup = colonClose;

			state.line = nextLine + 1;
			return true;
		},
	);
}

// ---------------------------------------------------------------------------
// Shared markdown-it instance (single source of truth for directive parsing)
// ---------------------------------------------------------------------------

const md = new MarkdownIt("commonmark", { html: false });
md.use(colonFencePlugin);
md.use(directivePlugin);

// ---------------------------------------------------------------------------
// Directive span extraction from markdown-it token stream
// ---------------------------------------------------------------------------

function parseDirectiveSpans(source: string): DirectiveSpan[] {
	const spans: DirectiveSpan[] = [];
	const tokens = md.parse(source, {});

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i]!;
		if (token.type !== "parsed_directive_open") continue;

		const map = token.map;
		if (!map) continue;

		const rawOptions = (token.meta as any)?.options as Record<string, unknown> | undefined;
		const options: Record<string, string> = {};
		if (rawOptions) {
			for (const [key, val] of Object.entries(rawOptions)) {
				options[key] = typeof val === "string" ? val : String(val);
			}
		}

		spans.push({
			startLine: map[0],
			endLine: map[1],
			name: token.info,
			argument: (token.meta as any)?.arg ?? "",
			options,
			body: token.content ?? "",
		});
	}

	console.log("[myst] parseDirectiveSpans:", spans.length, "spans:", spans.map((s) => `${s.name}[${s.startLine},${s.endLine}]`).join(" "));
	return spans;
}

function parseCsvLine(line: string): string[] {
	const cells: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const ch = line[i] ?? "";
		if (ch === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
			continue;
		}

		if (ch === "," && !inQuotes) {
			cells.push(current.trim());
			current = "";
			continue;
		}

		current += ch;
	}

	cells.push(current.trim());
	return cells;
}

function parseListTableBody(body: string): string[][] {
	const rows: string[][] = [];
	let currentRow: string[] | null = null;

	for (const line of body.split(/\r?\n/)) {
		const rowMatch = line.match(/^\s*\*\s+-\s+(.*)$/);
		if (rowMatch) {
			if (currentRow) rows.push(currentRow);
			currentRow = [rowMatch[1] ?? ""];
			continue;
		}

		const cellMatch = line.match(/^\s+-\s+(.*)$/);
		if (cellMatch && currentRow) {
			currentRow.push(cellMatch[1] ?? "");
			continue;
		}

		if (line.trim() && currentRow && currentRow.length > 0) {
			currentRow[currentRow.length - 1] += ` ${line.trim()}`;
		}
	}

	if (currentRow) rows.push(currentRow);
	return rows;
}

function parseCsvTableBody(body: string): string[][] {
	const rows: string[][] = [];
	for (const line of body.split(/\r?\n/)) {
		if (!line.trim()) continue;
		rows.push(parseCsvLine(line));
	}
	return rows;
}

function titleizeDirectiveName(name: string): string {
	return name
		.split(/[-_:]/g)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

async function renderMarkdownInto(container: HTMLElement, markdown: string, sourcePath: string): Promise<void> {
	if (!directiveApp) {
		container.textContent = markdown;
		return;
	}

	await MarkdownRenderer.render(directiveApp, markdown, container, sourcePath, new Component());
}

async function renderDirectiveBody(container: HTMLElement, body: string, sourcePath: string): Promise<void> {
	if (!body.trim()) return;
	await renderMarkdownInto(container, body, sourcePath);
}

function createSectionRoot(name: string): HTMLElement {
	const root = document.createElement("div");
	root.addClass("myst-directive");
	root.addClass(`myst-directive-${name}`);
	return root;
}

function createCalloutRoot(name: string): HTMLElement {
	const root = document.createElement("div");
	root.addClass("callout");
	root.addClass("myst-admonition");
	root.addClass(`myst-admonition-${name}`);
	root.setAttribute("data-callout", name);
	root.setAttribute("data-myst-directive", name);
	return root;
}

function createCalloutTitle(root: HTMLElement, name: string, argument: string): HTMLElement {
	const title = root.createDiv({ cls: "callout-title" });
	title.createDiv({ cls: "callout-icon" });
	const titleInner = title.createDiv({ cls: "callout-title-inner" });
	titleInner.textContent = argument ? `${titleizeDirectiveName(name)}: ${argument}` : titleizeDirectiveName(name);
	return titleInner;
}

function createDirectiveOptionsList(container: HTMLElement, options: Record<string, string>): void {
	const entries = Object.entries(options);
	if (entries.length === 0) return;

	const list = container.createDiv({ cls: "myst-directive-options" });
	for (const [key, value] of entries) {
		const row = list.createDiv({ cls: "myst-directive-option" });
		row.createSpan({ cls: "myst-directive-option-key", text: `${key}:` });
		row.createSpan({ cls: "myst-directive-option-value", text: value });
	}
}

async function createListTableElement(span: DirectiveSpan): Promise<HTMLElement> {
	const root = createSectionRoot("list-table");
	const table = root.createEl("table", { cls: "myst-list-table" });

	if (span.argument) {
		table.createEl("caption", { text: span.argument });
	}

	const headerRows = Number.parseInt(span.options["header-rows"] ?? "0", 10) || 0;
	const rows = parseListTableBody(span.body);

	if (rows.length === 0) return root;

	if (headerRows > 0) {
		const thead = table.createEl("thead");
		for (let r = 0; r < headerRows && r < rows.length; r++) {
			const tr = thead.createEl("tr");
			for (const cell of rows[r]) {
				tr.createEl("th", { text: cell });
			}
		}
	}

	if (rows.length > headerRows) {
		const tbody = table.createEl("tbody");
		for (let r = headerRows; r < rows.length; r++) {
			const tr = tbody.createEl("tr");
			for (const cell of rows[r]) {
				tr.createEl("td", { text: cell });
			}
		}
	}

	return root;
}

async function createCsvTableElement(span: DirectiveSpan): Promise<HTMLElement> {
	const root = createSectionRoot("csv-table");
	const table = root.createEl("table", { cls: "myst-csv-table" });

	if (span.argument) {
		table.createEl("caption", { text: span.argument });
	}

	const headerRows = Number.parseInt(span.options["header-rows"] ?? "0", 10) || 0;
	const rows = parseCsvTableBody(span.body);

	if (rows.length === 0) return root;

	if (headerRows > 0) {
		const thead = table.createEl("thead");
		for (let r = 0; r < headerRows && r < rows.length; r++) {
			const tr = thead.createEl("tr");
			for (const cell of rows[r]) {
				tr.createEl("th", { text: cell });
			}
		}
	}

	if (rows.length > headerRows) {
		const tbody = table.createEl("tbody");
		for (let r = headerRows; r < rows.length; r++) {
			const tr = tbody.createEl("tr");
			for (const cell of rows[r]) {
				tr.createEl("td", { text: cell });
			}
		}
	}

	return root;
}

async function createAdmonitionElement(span: DirectiveSpan, sourcePath: string): Promise<HTMLElement> {
	const root = createCalloutRoot(span.name);
	createCalloutTitle(root, span.name, span.argument);

	const content = root.createDiv({ cls: "callout-content" });
	if (span.options.class) {
		content.addClass(span.options.class);
	}
	createDirectiveOptionsList(content, span.options);
	await renderDirectiveBody(content, span.body, sourcePath);
	return root;
}

async function createCodeBlockElement(span: DirectiveSpan): Promise<HTMLElement> {
	const root = createSectionRoot("code-block");
	const pre = root.createEl("pre", { cls: "myst-code-block" });
	const code = pre.createEl("code", { text: span.body });
	if (span.argument) {
		code.addClass(`language-${span.argument}`);
	}

	if (span.options.caption) {
		root.createDiv({ cls: "myst-code-caption", text: span.options.caption });
	}
	if (span.options.linenos) {
		root.createDiv({ cls: "myst-code-linenos" });
	}
	return root;
}

function resolveCodeCellLanguage(span: DirectiveSpan): string {
	return (span.options.language ?? span.argument ?? "python").trim().toLowerCase() || "python";
}

async function createCodeCellElement(span: DirectiveSpan): Promise<HTMLElement> {
	const root = createSectionRoot("code-cell");
	const anchorId = span.options.label ?? span.options.name;
	if (anchorId) {
		root.setAttribute("id", anchorId);
	}

	const language = resolveCodeCellLanguage(span);
	const pre = root.createEl("pre", { cls: "myst-code-cell" });
	const code = pre.createEl("code", { text: span.body });
	if (language) {
		code.addClass(`language-${language}`);
	}

	const toolbar = root.createDiv({ cls: "myst-code-cell-toolbar" });
	const output = root.createDiv({ cls: "myst-code-cell-output" });

	if (codeExecutionEnabled && KNOWN_EXECUTABLE_LANGUAGES.has(language)) {
		const runBtn = toolbar.createEl("button", {
			cls: "myst-code-cell-run",
			text: "▶ Run",
		});

		runBtn.addEventListener("click", async () => {
			runBtn.setAttribute("disabled", "true");
			try {
				const { executeCell, getBackend } = await import("src/kernel");
				const backend = getBackend(language);
				runBtn.textContent = backend?.loading ? "⏳ Loading…" : "⏳ Running…";
				output.empty();
				const resolvedBackend = await executeCell(span.body, language, output);
				if (!resolvedBackend) {
					output.createDiv({ cls: "myst-cell-error", text: `No backend for language: ${language}` });
				}
			} catch (err) {
				console.error("[myst] code-cell execution error:", err);
				output.createDiv({ cls: "myst-cell-error", text: err instanceof Error ? err.message : String(err) });
			} finally {
				runBtn.removeAttribute("disabled");
				runBtn.textContent = "▶ Run";
			}
		});
	} else {
		toolbar.createDiv({
			cls: "myst-code-cell-unsupported",
			text: codeExecutionEnabled
				? `Execution not supported for ${language || "unknown"}`
				: "Execution disabled",
		});
	}

	return root;
}

async function createMathElement(span: DirectiveSpan, sourcePath: string): Promise<HTMLElement> {
	const root = createSectionRoot("math");
	const math = root.createDiv({ cls: "math math-block" });
	await renderMarkdownInto(math, `$$\n${span.body}\n$$`, sourcePath);
	return root;
}

async function createFigureElement(span: DirectiveSpan, sourcePath: string): Promise<HTMLElement> {
	const root = createSectionRoot("figure");
	const figure = root.createEl("figure", { cls: "myst-figure" });

	if (span.options.name || span.options.label) {
		figure.setAttribute("id", span.options.name ?? span.options.label ?? "");
	}

	const src = span.argument.trim();
	if (src) {
		const img = figure.createEl("img", {
			cls: "myst-figure-image",
			attr: {
				src,
				alt: span.options.alt ?? "",
			},
		});
		if (span.options.width) img.setAttribute("width", span.options.width);
		if (span.options.height) img.setAttribute("height", span.options.height);
	}

	if (span.body.trim()) {
		const caption = figure.createEl("figcaption", { cls: "myst-figure-caption" });
		await renderDirectiveBody(caption, span.body, sourcePath);
	}

	return root;
}

async function createImageElement(span: DirectiveSpan, sourcePath: string): Promise<HTMLElement> {
	const root = createSectionRoot("image");
	const img = root.createEl("img", {
		cls: "myst-image",
		attr: {
			src: span.argument.trim(),
			alt: span.options.alt ?? "",
		},
	});
	if (span.options.width) img.setAttribute("width", span.options.width);
	if (span.options.height) img.setAttribute("height", span.options.height);
	if (span.body.trim()) {
		const caption = root.createDiv({ cls: "myst-image-caption" });
		await renderDirectiveBody(caption, span.body, sourcePath);
	}
	return root;
}

async function createGenericDirectiveElement(span: DirectiveSpan, sourcePath: string): Promise<HTMLElement> {
	const root = createSectionRoot(span.name);
	const header = root.createDiv({ cls: "myst-directive-header" });
	header.createSpan({ cls: "myst-directive-label", text: titleizeDirectiveName(span.name) });
	if (span.argument) {
		header.createSpan({ cls: "myst-directive-title", text: span.argument });
	}

	if (Object.keys(span.options).length > 0) {
		createDirectiveOptionsList(root, span.options);
	}

	const body = root.createDiv({ cls: "myst-directive-body" });
	await renderDirectiveBody(body, span.body, sourcePath);
	return root;
}

async function renderDirectiveSpan(span: DirectiveSpan, sourcePath: string): Promise<HTMLElement> {
	if (ADMONITION_NAMES.has(span.name)) {
		return createAdmonitionElement(span, sourcePath);
	}

	switch (span.name) {
		case "list-table":
			return createListTableElement(span);
		case "csv-table":
			return createCsvTableElement(span);
		case "code-block":
			return createCodeBlockElement(span);
		case "code-cell":
			return createCodeCellElement(span);
		case "math":
			return createMathElement(span, sourcePath);
		case "figure":
			return createFigureElement(span, sourcePath);
		case "image":
			return createImageElement(span, sourcePath);
		default:
			return createGenericDirectiveElement(span, sourcePath);
	}
}

async function getFileCache(sourcePath: string): Promise<FileCache | null> {
	if (fileCache.has(sourcePath)) {
		return fileCache.get(sourcePath) ?? null;
	}

	if (!directiveApp) return null;

	const file = directiveApp.vault.getAbstractFileByPath(sourcePath);
	if (!(file instanceof TFile)) return null;

	const source = await directiveApp.vault.read(file);
	const cache = {
		source,
		spans: parseDirectiveSpans(source),
	};
	fileCache.set(sourcePath, cache);
	return cache;
}

export const directivePostProcessor: MarkdownPostProcessor = async (
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext,
) => {
	const sectionInfo = ctx.getSectionInfo(el);
	if (!sectionInfo) return;

	const sectionRange = getSectionLineRange(sectionInfo);
	if (!sectionRange) return;

	const sourcePath = ctx.sourcePath;
	if (!sourcePath) return;

	console.log(`[myst] section [${sectionRange.start},${sectionRange.end}] <${el.tagName}> class="${el.className?.slice(0, 60)}"`);

	const cache = await getFileCache(sourcePath);
	if (!cache || cache.spans.length === 0) return;

	for (const span of cache.spans) {
		const overlaps = sectionRange.start < span.endLine && sectionRange.end >= span.startLine;
		if (!overlaps) continue;

		const sectionStartsDirective = sectionRange.start <= span.startLine;
		if (!sectionStartsDirective) {
			console.warn(`[myst] section starts mid-directive, hiding: section=[${sectionRange.start},${sectionRange.end}] span=[${span.startLine},${span.endLine}] name=${span.name}`);
			el.empty();
			el.style.display = "none";
			return;
		}

		console.log(`[myst] rendering directive: section=[${sectionRange.start},${sectionRange.end}] span=[${span.startLine},${span.endLine}] name=${span.name}`);
		const rendered = await renderDirectiveSpan(span, sourcePath);
		el.empty();
		el.style.display = "";
		el.appendChild(rendered);
		return;
	}
};
