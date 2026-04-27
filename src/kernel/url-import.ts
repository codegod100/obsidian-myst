/**
 * Load a script from a URL and extract a global.
 *
 * Injects a <script> tag, waits for it to load, then calls extract()
 * to pull the value from the window object. If the script is already
 * loaded (same src exists in <head>), returns immediately.
 */

export default function urlImport<R>(
	url: string,
	extract: () => R,
): Promise<R> {
	return new Promise((resolve) => {
		const existing = document.head.querySelector(`script[src="${url}"]`);
		if (existing) {
			resolve(extract());
			return;
		}

		const script = document.createElement("script");
		script.src = url;
		script.onload = () => resolve(extract());
		document.head.append(script);
	});
}
