import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

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

esbuild
	.build({
		entryPoints: ["src/main.ts"],
		bundle: true,
		external: [...cm6Externals, ...builtins],
		format: "cjs",
		target: "es2022",
		logLevel: "info",
		sourcemap: prod ? false : "inline",
		treeShaking: true,
		outfile: "main.js",
		minify: prod,
		define: {
			"process.env.NODE_ENV": prod ? '"production"' : '"development"',
		},
	})
	.catch(() => process.exit(1));
