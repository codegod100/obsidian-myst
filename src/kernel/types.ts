/**
 * Kernel type definitions for code-cell execution.
 */

/** Output entry from a code execution. */
export type CellOutput =
	| { type: "stdout"; text: string }
	| { type: "stderr"; text: string }
	| { type: "error"; text: string }
	| { type: "html"; html: string };

/** Callback for receiving output entries. */
export type OutputSink = (entry: CellOutput) => void;

/**
 * A code execution backend for a specific language.
 *
 * Lazy-initialized: `loading` is true while the runtime loads (e.g. Pyodide).
 * Call the backend function to execute code; it resolves when done.
 */
export type Backend = {
	(code: string, sink: OutputSink, viewEl: HTMLElement): Promise<void>;
	loading?: boolean;
};
