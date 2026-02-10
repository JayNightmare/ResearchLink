import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ResearchLibraryProvider } from "./webview/ResearchLibraryProvider";
import { SemanticScholarClient } from "./lib/api/semanticscholar";
import { LibraryStore } from "./lib/storage/library";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand(
		"research-link.helloWorld",
		() => {
			// The code you place here will be executed every time your command is executed
			// Display a message box to the user
			vscode.window.showInformationMessage(
				"Hello World from Research Link!",
			);
		},
	);

	context.subscriptions.push(disposable);

	// Register Sidebar Provider
	const sidebarProvider = new ResearchLibraryProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ResearchLibraryProvider.viewType,
			sidebarProvider,
		),
	);

	// Register Open Paper Command
	context.subscriptions.push(
		vscode.commands.registerCommand(
			"research-link.openPaper",
			(paper: any) => {
				// Create and show a new webview
				const panel = vscode.window.createWebviewPanel(
					"researchLinkPaper",
					`Paper: ${paper.title.substr(0, 20)}...`,
					vscode.ViewColumn.One,
					{ enableScripts: true }, // Enable scripts in the webview
				);

				// Get path to script
				const scriptPath = vscode.Uri.joinPath(
					context.extensionUri,
					"out",
					"webview",
					"panel.js",
				);
				const scriptUri =
					panel.webview.asWebviewUri(scriptPath);

				const stylePath = vscode.Uri.joinPath(
					context.extensionUri,
					"out",
					"webview",
					"panel.css",
				);
				const styleUri =
					panel.webview.asWebviewUri(stylePath);

				// Set HTML content
				panel.webview.html = getWebviewContent(
					scriptUri,
					styleUri,
					panel.webview.cspSource,
				);

				// Handle messages from the webview
				panel.webview.onDidReceiveMessage(
					(message) => {
						switch (message.type) {
							case "ready":
								// Send paper data once webview is ready
								panel.webview.postMessage(
									{
										type: "loadPaper",
										value: paper,
									},
								);
								return;
							case "generateAIReference":
								// Handle AI reference generation
								generateAIReference(
									message.paper,
								);
								return;
							case "openPdf":
								// Open PDF in embedded viewer
								vscode.commands.executeCommand(
									"research-link.openPdf",
									message.url,
									message.title ||
										"PDF",
								);
								return;
						}
					},
					undefined,
					context.subscriptions,
				);
			},
		),
	);

	// Register Open PDF Command
	context.subscriptions.push(registerOpenPdfCommand(context));

	// Register Open Graph Command
	context.subscriptions.push(registerOpenGraphCommand(context));
}

// This method is called when your extension is deactivated
export function deactivate() {}

// ──────────────────────────────────────────
//  Register: Open PDF Command
// ──────────────────────────────────────────
function registerOpenPdfCommand(context: vscode.ExtensionContext) {
	return vscode.commands.registerCommand(
		"research-link.openPdf",
		async (url: string, title: string) => {
			const panel = vscode.window.createWebviewPanel(
				"researchLinkPdf",
				`PDF: ${title.substring(0, 25)}...`,
				vscode.ViewColumn.One,
				{ enableScripts: true },
			);

			const scriptUri = panel.webview.asWebviewUri(
				vscode.Uri.joinPath(
					context.extensionUri,
					"out",
					"webview",
					"pdf.js",
				),
			);
			const styleUri = panel.webview.asWebviewUri(
				vscode.Uri.joinPath(
					context.extensionUri,
					"out",
					"webview",
					"pdf.css",
				),
			);
			const workerUri = panel.webview.asWebviewUri(
				vscode.Uri.joinPath(
					context.extensionUri,
					"out",
					"webview",
					"pdf.worker.min.mjs",
				),
			);

			const nonce = getNonce();
			panel.webview.html = `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource}; script-src 'nonce-${nonce}'; worker-src ${panel.webview.cspSource};">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleUri}" rel="stylesheet">
				<title>PDF Viewer</title>
			</head>
			<body>
				<div id="root"></div>
				<script nonce="${nonce}">window.__PDFJS_WORKER_SRC__ = "${workerUri}";</script>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;

			panel.webview.onDidReceiveMessage(
				async (message) => {
					if (message.type === "ready") {
						// Fetch the PDF on the extension host (full network access)
						try {
							// Try the URL directly, and fall back to common PDF URL rewrites
							let pdfUrl = url;

							// Common URL fixups for known sources
							if (
								pdfUrl.includes(
									"arxiv.org/abs/",
								)
							) {
								pdfUrl =
									pdfUrl.replace(
										"/abs/",
										"/pdf/",
									);
							}
							if (
								pdfUrl.includes(
									"semanticscholar.org/paper/",
								)
							) {
								// S2 paper pages aren't PDFs — skip directly to error
								panel.webview.postMessage(
									{
										type: "pdfError",
										error: "This link is a paper landing page, not a direct PDF. The PDF may not be freely available.",
									},
								);
								return;
							}

							const response =
								await fetch(
									pdfUrl,
									{
										headers: {
											"User-Agent":
												"ResearchLink-VSCode-Extension/0.2",
										},
										redirect: "follow",
									},
								);

							if (!response.ok) {
								panel.webview.postMessage(
									{
										type: "pdfError",
										error: `HTTP ${response.status}: ${response.statusText}`,
									},
								);
								return;
							}

							const buffer =
								await response.arrayBuffer();

							// Validate it's actually a PDF (magic bytes: %PDF)
							const header =
								new Uint8Array(
									buffer.slice(
										0,
										5,
									),
								);
							const magic =
								String.fromCharCode(
									...header,
								);
							if (
								!magic.startsWith(
									"%PDF",
								)
							) {
								panel.webview.postMessage(
									{
										type: "pdfError",
										error: "The URL did not return a valid PDF file. It may be behind a paywall or require authentication.",
									},
								);
								return;
							}

							const base64 =
								Buffer.from(
									buffer,
								).toString(
									"base64",
								);
							panel.webview.postMessage(
								{
									type: "loadPdfData",
									data: base64,
								},
							);
						} catch (err: any) {
							panel.webview.postMessage(
								{
									type: "pdfError",
									error:
										err.message ||
										String(
											err,
										),
								},
							);
						}
					}
				},
				undefined,
				context.subscriptions,
			);
		},
	);
}

function registerOpenGraphCommand(context: vscode.ExtensionContext) {
	const s2Client = new SemanticScholarClient();

	return vscode.commands.registerCommand(
		"research-link.openGraph",
		async () => {
			// Create a fresh LibraryStore each time so we see the latest papers
			const libraryStore = new LibraryStore(
				context.globalStorageUri.fsPath,
			);

			const panel = vscode.window.createWebviewPanel(
				"researchLinkGraph",
				"Research Graph",
				vscode.ViewColumn.One,
				{ enableScripts: true },
			);

			const scriptUri = panel.webview.asWebviewUri(
				vscode.Uri.joinPath(
					context.extensionUri,
					"out",
					"webview",
					"graph.js",
				),
			);
			const styleUri = panel.webview.asWebviewUri(
				vscode.Uri.joinPath(
					context.extensionUri,
					"out",
					"webview",
					"graph.css",
				),
			);

			const nonce = getNonce();
			panel.webview.html = `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource}; script-src 'nonce-${nonce}'; connect-src https:;">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleUri}" rel="stylesheet">
				<title>Research Graph</title>
			</head>
			<body>
				<div id="root"></div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;

			panel.webview.onDidReceiveMessage(
				(message) => {
					if (message.type === "ready") {
						loadGraphData(
							panel,
							libraryStore,
							s2Client,
						);
					} else if (
						message.type === "openPaper"
					) {
						vscode.commands.executeCommand(
							"research-link.openPaper",
							message.paper,
						);
					}
				},
				undefined,
				context.subscriptions,
			);
		},
	);
}

function getWebviewContent(
	scriptUri: vscode.Uri,
	styleUri: vscode.Uri,
	cspSource: string,
) {
	const nonce = getNonce();
	return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource}; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleUri}" rel="stylesheet">
        <title>Paper Details</title>
    </head>
    <body>
        <div id="root"></div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
}

function getNonce() {
	let text = "";
	const possible =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(
			Math.floor(Math.random() * possible.length),
		);
	}
	return text;
}

async function generateAIReference(paper: any) {
	if (!vscode.workspace.workspaceFolders) {
		vscode.window.showErrorMessage(
			"Open a folder to generate AI references.",
		);
		return;
	}

	// Check/Create docs folder
	const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
	const docsPath = path.join(workspaceRoot, "docs");

	if (!fs.existsSync(docsPath)) {
		fs.mkdirSync(docsPath, { recursive: true });
	}

	// Sanitize DOI for filename
	const filename = `${paper.doi ? paper.doi.replace(/[\/\\]/g, "_") : paper.id}.md`;
	const filePath = path.join(docsPath, filename);

	// Create Metadata Content
	const content = `---
title: "${paper.title}"
authors: [${paper.authors.map((a: string) => `"${a}"`).join(", ")}]
year: ${paper.year}
venue: "${paper.venue || ""}"
doi: "${paper.doi || ""}"
url: "${paper.url || ""}"
type: "${paper.publicationType || "Article"}"
citations: ${paper.citations || 0}
isOpenAccess: ${paper.isOpenAccess ? "true" : "false"}
---

# Abstract
${paper.abstract || "No abstract."}

# Notes
Created by ResearchLink.
`;

	try {
		fs.writeFileSync(filePath, content, "utf8");
		vscode.window.showInformationMessage(
			`AI Reference created: docs/${filename}`,
		);
	} catch (err) {
		vscode.window.showErrorMessage(
			`Failed to create AI reference: ${err}`,
		);
	}
}

async function loadGraphData(
	panel: vscode.WebviewPanel,
	libraryStore: LibraryStore,
	s2Client: SemanticScholarClient,
) {
	const papers = libraryStore.getAllPapers();

	// Build shared-author edges immediately (no API calls needed)
	const edges: { source: string; target: string }[] = [];
	for (let i = 0; i < papers.length; i++) {
		for (let j = i + 1; j < papers.length; j++) {
			const shared = papers[i].authors.filter((a) =>
				papers[j].authors.some(
					(b) =>
						a.toLowerCase() ===
						b.toLowerCase(),
				),
			);
			if (shared.length > 0) {
				edges.push({
					source: papers[i].id,
					target: papers[j].id,
				});
			}
		}
	}

	// Send graph data immediately so the user sees something right away
	panel.webview.postMessage({
		type: "graphData",
		papers,
		edges,
	});

	// Then fetch citation-based edges asynchronously and send an update
	if (papers.length > 0) {
		const paperIds = new Set(papers.map((p) => p.id));
		let foundNewEdges = false;

		for (const paper of papers) {
			try {
				const refs = await s2Client.getReferences(
					paper.id,
				);
				for (const refId of refs) {
					if (paperIds.has(refId)) {
						const exists = edges.some(
							(e) =>
								(e.source ===
									paper.id &&
									e.target ===
										refId) ||
								(e.source ===
									refId &&
									e.target ===
										paper.id),
						);
						if (!exists) {
							edges.push({
								source: paper.id,
								target: refId,
							});
							foundNewEdges = true;
						}
					}
				}
			} catch {
				// Silently continue on reference fetch failures
			}
		}

		// If we found new citation edges, send an updated graph
		if (foundNewEdges) {
			panel.webview.postMessage({
				type: "graphData",
				papers,
				edges,
			});
		}
	}
}
