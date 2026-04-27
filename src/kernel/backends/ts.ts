/**
 * TypeScript execution backend.
 *
 * Loads the TypeScript compiler from CDN on first use,
 * transpiles code to JS, then delegates to the JS backend.
 */

import type { Backend, OutputSink } from "../types";
import urlImport from "../url-import";
import jsBackend from "./js";

const TSC_CDN = "https://cdn.jsdelivr.net/npm/typescript@5.4.5/lib/typescript.min.js";

let tsc: any | null = null;
let loadPromise: Promise<void> | null = null;

const backend: Backend = async function (
	code: string,
	sink: OutputSink,
	viewEl: HTMLElement,
): Promise<void> {
	if (!tsc) {
		backend.loading = true;
		loadPromise = loadPromise ?? loadTsc();
		await loadPromise;
		backend.loading = false;
	}

	const jsCode = tsc.transpile(`(async () => { ${code} })();`, {
		module: tsc.ModuleKind.ESNext,
		target: tsc.ScriptTarget.ES2022,
	});

	await jsBackend(jsCode, sink, viewEl);
};

backend.loading = true;

async function loadTsc(): Promise<void> {
	tsc = await urlImport(TSC_CDN, () => (window as any).ts);
	console.log("TypeScript compiler loaded.");
}

export default backend;
