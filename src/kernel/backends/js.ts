/**
 * JavaScript execution backend using ProxySandbox + eval.
 *
 * User code runs inside a sandboxed proxy of window,
 * with console methods redirected to the output sink.
 */

import type { Backend, OutputSink } from "../types";
import { ProxySandbox } from "../sandbox/proxy-sandbox";

const backend: Backend = async function (
	code: string,
	sink: OutputSink,
	_viewEl: HTMLElement,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const sandbox = new ProxySandbox("js-cell");

		const run = async function (windowProxy: typeof sandbox.proxy) {
			const { console } = windowProxy;
			Object.assign(console, wrapConsole(sink));

			sandbox.active();
			try {
				// @ts-expect-error intentional direct eval in sandbox
				await eval(code);
			} catch (e) {
				sink({
					type: "error",
					text: e instanceof Error ? e.stack ?? e.message : String(e),
				});
			} finally {
				sandbox.inactive();
			}
		};

		run(sandbox.proxy).then(resolve).catch(reject);
	});
};

function wrapConsole(sink: OutputSink) {
	const write = (level: string, ...data: any[]) => {
		const text = data.map((d) =>
			typeof d === "string" ? d : JSON.stringify(d, null, 2),
		).join(" ");

		if (level === "error" || level === "warn") {
			sink({ type: "stderr", text });
		} else {
			sink({ type: "stdout", text });
		}
	};

	return {
		log: (...data: any[]) => write("log", ...data),
		info: (...data: any[]) => write("info", ...data),
		debug: (...data: any[]) => write("debug", ...data),
		warn: (...data: any[]) => write("warn", ...data),
		error: (...data: any[]) => write("error", ...data),
	};
}

export default backend;
