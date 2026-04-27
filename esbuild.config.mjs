import esbuild from "esbuild";
import process from "process";

const prod = process.argv[2] === "production";

const cm6Externals = [
	"obsidian",
	"electron",
	"@codemirror/autocomplete",
	"@codemirror/commands",
	"@codemirror/language",
	"@codemirror/search",
	"@codemirror/state",
	"@codemirror/view",
	"@lezer/common",
	"@lezer/highlight",
	"@lezer/lr",
	"codemirror",
];

// Shim bare Node builtins that have no npm equivalent installed.
// markdown-it requires("punycode") — the npm package isn't installed
// and the Node builtin isn't available in the browser.
const nodeShimPlugin = {
	name: "node-shim",
	setup(build) {
		const shims = {
			punycode: `export function toASCII(s) { return s; } export function toUnicode(s) { return s; } export default { toASCII, toUnicode };`,
		};

		const filter = new RegExp(
			`^(${Object.keys(shims)
				.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
				.join("|")})$`,
		);

		build.onResolve({ filter }, (args) => {
			return { path: args.path, namespace: "node-shim" };
		});

		build.onLoad({ filter: /.*/, namespace: "node-shim" }, (args) => {
			return {
				contents: shims[args.path] || "export default {};",
				loader: "js",
			};
		});
	},
};

esbuild
	.build({
		entryPoints: ["src/main.ts"],
		bundle: true,
		external: [...cm6Externals],
		platform: "browser",
		format: "cjs",
		target: "es2022",
		logLevel: "info",
		sourcemap: prod ? false : "inline",
		treeShaking: true,
		outfile: "main.js",
		minify: prod,
		plugins: [nodeShimPlugin],
		define: {
			"process.env.NODE_ENV": prod ? '"production"' : '"development"',
		},
	})
	.catch(() => process.exit(1));
