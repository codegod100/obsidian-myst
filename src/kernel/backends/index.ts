/**
 * Backend registry — maps language names to Backend instances.
 */

import type { Backend } from "../types";
import jsBackend from "./js";
import tsBackend from "./ts";
import pythonBackend from "./python";

const backends: Record<string, Backend> = {
	js: jsBackend,
	javascript: jsBackend,
	ts: tsBackend,
	typescript: tsBackend,
	python: pythonBackend,
	py: pythonBackend,
};

/**
 * Get the backend for a language. Returns undefined if not supported.
 */
export function getBackend(language: string): Backend | undefined {
	return backends[language.toLowerCase()];
}

/**
 * Check if a language is supported for code execution.
 */
export function isSupportedLanguage(language: string): boolean {
	return language.toLowerCase() in backends;
}
