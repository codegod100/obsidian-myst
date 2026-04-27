/**
 * Kernel public API — execute code cells and manage backends.
 */

export type { Backend, CellOutput, OutputSink } from "./types";
export { createDomSink, clearOutput } from "./stdio";
export { getBackend, isSupportedLanguage } from "./backends";

import type { Backend, OutputSink } from "./types";
import { getBackend } from "./backends";
import { createDomSink, clearOutput } from "./stdio";

/**
 * Execute a code cell and render output into a container element.
 *
 * @param code - The source code to execute.
 * @param language - Language identifier (e.g. "python", "js", "ts").
 * @param outputEl - DOM element to render output into.
 * @returns The backend used (for checking loading state), or undefined if unsupported.
 */
export async function executeCell(
	code: string,
	language: string,
	outputEl: HTMLElement,
): Promise<Backend | undefined> {
	const backend = getBackend(language);
	if (!backend) return undefined;

	clearOutput(outputEl);
	const sink = createDomSink(outputEl);
	await backend(code, sink, outputEl);
	return backend;
}
