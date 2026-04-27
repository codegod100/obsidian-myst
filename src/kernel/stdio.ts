/**
 * DOM-based output sink for code-cell execution results.
 *
 * Writes CellOutput entries into a container element.
 * No framework dependency — just DOM manipulation.
 */

import type { CellOutput, OutputSink } from "./types";

export type { CellOutput, OutputSink };

/**
 * Create an output sink that appends entries to a container element.
 *
 * @param containerEl - The element to write output into.
 * @returns An OutputSink function.
 */
export function createDomSink(containerEl: HTMLElement): OutputSink {
	return (entry: CellOutput) => {
		const div = containerEl.createDiv({
			cls: `myst-cell-output myst-cell-${entry.type}`,
		});

		switch (entry.type) {
			case "stdout":
			case "stderr":
				div.textContent = entry.text;
				break;
			case "error":
				div.createEl("pre", { cls: "myst-cell-error", text: entry.text });
				break;
			case "html":
				div.innerHTML = entry.html;
				break;
		}
	};
}

/**
 * Clear all output from a container element.
 */
export function clearOutput(containerEl: HTMLElement): void {
	containerEl.empty();
}
