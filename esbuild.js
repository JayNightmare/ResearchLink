const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

async function main() {
	const ctx = await esbuild.context({
		entryPoints: ["src/webview/index.tsx", "src/webview/panel.tsx"],
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
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
