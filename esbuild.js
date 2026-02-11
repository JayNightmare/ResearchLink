const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

async function main() {
	const ctx = await esbuild.context({
		entryPoints: [
			"src/webview/index.tsx",
			"src/webview/panel.tsx",
			"src/webview/pdf.tsx",
			"src/webview/graph.tsx",
			"src/webview/import.tsx",
		],
		bundle: true,
		outdir: "out/webview",
		external: ["vscode"],
		format: "iife",
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		loader: { ".ts": "ts", ".tsx": "tsx", ".css": "css" },
		plugins: [
			require("esbuild-style-plugin")({
				postcss: {
					plugins: [
						require("@tailwindcss/postcss"),
						require("autoprefixer"),
					],
				},
			}),
		],
	});

	if (watch) {
		await ctx.watch();
		console.log("watching...");
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}

	// Copy pdfjs worker to output so it can be served as a webview URI
	const workerSrc = path.join(
		__dirname,
		"node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
	);
	const workerDest = path.join(
		__dirname,
		"out/webview/pdf.worker.min.mjs",
	);
	if (fs.existsSync(workerSrc)) {
		fs.copyFileSync(workerSrc, workerDest);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
