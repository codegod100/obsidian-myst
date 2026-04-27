/**
 * Python execution backend using Pyodide (WASM).
 *
 * Loads Pyodide from CDN on first use (~10MB, cached by browser after that).
 * Runs code via `runPythonAsync`, pipes stdout/stderr to the output sink.
 * Supports matplotlib by rendering into a viewEl container.
 */

import type { Backend, OutputSink } from "../types";
import urlImport from "../url-import";

const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/";

interface PyodideInterface {
	runPythonAsync(code: string): Promise<any>;
	loadPackage(names: string | string[]): Promise<void>;
}

let engine: PyodideInterface | null = null;
let currentSink: OutputSink | null = null;
let loadPromise: Promise<void> | null = null;

/**
 * Set a DOM element as the matplotlib render target for Pyodide.
 * Pyodide's matplotlib backend reads `document.pyodideMplTarget`.
 */
function setMplTarget(target?: HTMLElement): void {
	if (target) {
		(document as any).pyodideMplTarget = target;
	} else {
		delete (document as any).pyodideMplTarget;
	}
}

const backend: Backend = async function (
	code: string,
	sink: OutputSink,
	viewEl: HTMLElement,
): Promise<void> {
	if (!engine) {
		backend.loading = true;
		loadPromise = loadPromise ?? loadPyodide();
		await loadPromise;
		backend.loading = false;
	}

	currentSink = sink;
	try {
		setMplTarget(viewEl);
		await engine.runPythonAsync(code);
	} catch (e) {
		sink({
			type: "error",
			text: e instanceof Error ? e.stack ?? e.message : String(e),
		});
	} finally {
		setMplTarget(undefined);
	}
};

backend.loading = true;

async function loadPyodide(): Promise<void> {
	const loadPyodide = await urlImport<() => Promise<PyodideInterface>>(
		`${PYODIDE_CDN}pyodide.js`,
		() => (window as any).loadPyodide,
	);

	engine = await loadPyodide({
		indexURL: PYODIDE_CDN,
		stdout: (s: string) => currentSink?.({ type: "stdout", text: s }),
		stderr: (s: string) => currentSink?.({ type: "stderr", text: s }),
	});

	await engine.loadPackage("micropip");
	console.log("Pyodide loaded.");
}

export default backend;
