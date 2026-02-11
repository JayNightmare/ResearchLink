import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ResearchLibraryProvider } from "./webview/ResearchLibraryProvider";
import { SemanticScholarClient } from "./lib/api/semanticscholar";
import { CrossRefClient } from "./lib/api/crossref";
import { LibraryStore } from "./lib/storage/library";
import { extractPdfMetadata } from "./lib/pdfExtractor";

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
									message.paperId,
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

	// Register Import Commands
	const importDisposables = registerImportCommands(context);
	importDisposables.forEach((d) => context.subscriptions.push(d));
}

// This method is called when your extension is deactivated
export function deactivate() {}

// ──────────────────────────────────────────
//  Register: Open PDF Command
// ──────────────────────────────────────────
function registerOpenPdfCommand(context: vscode.ExtensionContext) {
	return vscode.commands.registerCommand(
		"research-link.openPdf",
		async (url: string, title: string, paperId?: string) => {
			const libraryStore = new LibraryStore(
				context.globalStorageUri.fsPath,
			);
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

							// Look up existing annotations for this paper
							let existingAnnotations: any[] =
								[];
							if (paperId) {
								const paper =
									libraryStore.getPaper(
										paperId,
									);
								if (
									paper?.annotations
								) {
									existingAnnotations =
										paper.annotations;
								}
							}

							panel.webview.postMessage(
								{
									type: "loadPdfData",
									data: base64,
									paperId:
										paperId ||
										null,
									annotations:
										existingAnnotations,
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
					} else if (
						message.type ===
						"saveAnnotations"
					) {
						// Persist annotations to library store
						if (message.paperId) {
							const paper =
								libraryStore.getPaper(
									message.paperId,
								);
							if (paper) {
								paper.annotations =
									message.annotations ||
									[];
								libraryStore.addPaper(
									paper,
								);
							}
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

// ──────────────────────────────────────────
//  Register: Import Commands
// ──────────────────────────────────────────
function registerImportCommands(
	context: vscode.ExtensionContext,
): vscode.Disposable[] {
	const s2Client = new SemanticScholarClient();
	const crossRefClient = new CrossRefClient();

	function openImportPanel(args: {
		paper?: any;
		candidates?: any[];
		importSource: "pdf" | "url";
		fileName?: string;
	}) {
		const panel = vscode.window.createWebviewPanel(
			"research-link.importEditor",
			"Import Paper",
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [
					vscode.Uri.joinPath(
						context.extensionUri,
						"out",
					),
					vscode.Uri.joinPath(
						context.extensionUri,
						"media",
					),
				],
			},
		);

		const scriptUri = panel.webview.asWebviewUri(
			vscode.Uri.joinPath(
				context.extensionUri,
				"out",
				"webview",
				"import.js",
			),
		);
		const styleUri = panel.webview.asWebviewUri(
			vscode.Uri.joinPath(
				context.extensionUri,
				"out",
				"webview",
				"import.css",
			),
		);

		panel.webview.html = getWebviewContent(
			scriptUri,
			styleUri,
			panel.webview.cspSource,
		);

		panel.webview.onDidReceiveMessage(
			(message) => {
				switch (message.type) {
					case "ready":
						if (
							args.candidates &&
							args.candidates.length >
								0
						) {
							panel.webview.postMessage(
								{
									type: "loadCandidates",
									papers: args.candidates,
								},
							);
						} else {
							panel.webview.postMessage(
								{
									type: "loadImportData",
									paper: args.paper,
									importSource:
										args.importSource,
									fileName: args.fileName,
								},
							);
						}
						return;
					case "saveImportedPaper": {
						const store = new LibraryStore(
							context.globalStorageUri
								.fsPath,
						);
						store.addPaper(message.paper);
						vscode.window.showInformationMessage(
							`Imported: ${message.paper.title}`,
						);
						panel.dispose();
						return;
					}
					case "cancelImport":
						panel.dispose();
						return;
				}
			},
			undefined,
			context.subscriptions,
		);
	}

	// Import PDF Command
	const importPdf = vscode.commands.registerCommand(
		"research-link.importPdf",
		async () => {
			const fileUris = await vscode.window.showOpenDialog({
				canSelectMany: false,
				filters: { "PDF Files": ["pdf"] },
				title: "Select a PDF to import",
			});

			if (!fileUris || fileUris.length === 0) return;

			const fileUri = fileUris[0];
			const fileName = path.basename(fileUri.fsPath);

			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation
						.Notification,
					title: `Extracting metadata from ${fileName}...`,
					cancellable: false,
				},
				async () => {
					try {
						const pdfBuffer =
							fs.readFileSync(
								fileUri.fsPath,
							);
						const extracted =
							await extractPdfMetadata(
								pdfBuffer,
								fileName,
							);

						// If DOI was found, try to enrich via APIs
						if (extracted.doi) {
							try {
								const s2Results =
									await s2Client.search(
										extracted.doi,
										1,
									);
								if (
									s2Results
										.papers
										.length >
									0
								) {
									const apiPaper =
										s2Results
											.papers[0];
									// Fill in missing fields from API
									if (
										!extracted.abstract &&
										apiPaper.abstract
									)
										extracted.abstract =
											apiPaper.abstract;
									if (
										!extracted.year &&
										apiPaper.year
									)
										extracted.year =
											apiPaper.year;
									if (
										apiPaper.venue
									)
										extracted.venue =
											apiPaper.venue;
									if (
										apiPaper.citations
									)
										extracted.citations =
											apiPaper.citations;
									if (
										apiPaper.pdfUrl
									)
										extracted.pdfUrl =
											apiPaper.pdfUrl;
									if (
										apiPaper.url
									)
										extracted.url =
											apiPaper.url;
								}
							} catch {
								// API enrichment is best-effort
							}
						}

						openImportPanel({
							paper: extracted,
							importSource: "pdf",
							fileName,
						});
					} catch (error) {
						vscode.window.showErrorMessage(
							`Failed to extract metadata: ${error}`,
						);
						// Still open the editor with defaults
						openImportPanel({
							paper: {
								title: fileName,
								source: "user",
							},
							importSource: "pdf",
							fileName,
						});
					}
				},
			);
		},
	);

	// Import URL Command
	const importUrl = vscode.commands.registerCommand(
		"research-link.importUrl",
		async () => {
			const input = await vscode.window.showInputBox({
				prompt: "Enter a DOI, URL, or paper title to look up",
				placeHolder:
					"e.g. 10.1234/example or https://arxiv.org/abs/...",
				title: "Import Paper from URL",
			});

			if (!input?.trim()) return;

			const query = input.trim();

			// Detect if it is likely a specific identifier (DOI or URL)
			const isDoi =
				/^10\.\d{4,9}\/[-._;()/:a-zA-Z0-9]+$/.test(
					query,
				);
			const isUrl =
				/^https?:\/\//.test(query) ||
				query.includes("arxiv.org");
			const isDirectLookup = isDoi || isUrl;

			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation
						.Notification,
					title: `Looking up "${query}"...`,
					cancellable: false,
				},
				async () => {
					try {
						// If direct lookup (DOI/URL), fetch 1. If keyword, fetch 5.
						const limit = isDirectLookup
							? 1
							: 5;

						const [s2Results, crResults] =
							await Promise.all([
								s2Client.search(
									query,
									limit,
								),
								crossRefClient.search(
									query,
									limit,
								),
							]);

						// Merge results
						const merged = new Map<
							any,
							any
						>();

						// S2 first
						s2Results.papers.forEach(
							(p) => {
								const key =
									p.doi?.toLowerCase() ||
									p.title
										.toLowerCase()
										.trim();
								merged.set(
									key,
									{
										...p,
										source: "user",
									},
								);
							},
						);

						// CrossRef merge
						crResults.papers.forEach(
							(p) => {
								const key =
									p.doi?.toLowerCase() ||
									p.title
										.toLowerCase()
										.trim();
								const existing =
									merged.get(
										key,
									);
								if (existing) {
									if (
										!existing.abstract &&
										p.abstract
									)
										existing.abstract =
											p.abstract;
									if (
										!existing.doi &&
										p.doi
									)
										existing.doi =
											p.doi;
									if (
										!existing.pdfUrl &&
										p.pdfUrl
									)
										existing.pdfUrl =
											p.pdfUrl;
									if (
										!existing.venue &&
										p.venue
									)
										existing.venue =
											p.venue;
								} else {
									merged.set(
										key,
										{
											...p,
											source: "user",
										},
									);
								}
							},
						);

						const candidates = Array.from(
							merged.values(),
						);

						if (candidates.length === 0) {
							vscode.window.showWarningMessage(
								"No results found. Opening blank import form.",
							);
							openImportPanel({
								paper: {
									title: query,
									source: "user",
								},
								importSource:
									"url",
							});
						} else if (
							candidates.length ===
								1 ||
							isDirectLookup
						) {
							// Exact match or single result
							openImportPanel({
								paper: candidates[0],
								importSource:
									"url",
							});
						} else {
							// Multiple candidates
							openImportPanel({
								candidates: candidates,
								importSource:
									"url",
							});
						}
					} catch (error) {
						vscode.window.showErrorMessage(
							`Lookup failed: ${error}`,
						);
						openImportPanel({
							paper: {
								title: query,
								source: "user",
							},
							importSource: "url",
						});
					}
				},
			);
		},
	);

	return [importPdf, importUrl];
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
	const edges: { source: string; target: string; degree?: number }[] = [];
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
					degree: 1,
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

	// Then fetch citation-based edges asynchronously
	if (papers.length > 0) {
		const paperIds = new Set(papers.map((p) => p.id));
		let foundNewEdges = false;

		// Collect intermediate ref IDs for second-degree lookup
		const intermediateRefs = new Map<string, string>(); // refId -> source paper id

		// First-degree references
		for (const paper of papers) {
			try {
				const refs = await s2Client.getReferences(
					paper.id,
				);
				for (const refId of refs) {
					if (paperIds.has(refId)) {
						// Direct citation between two saved papers
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
								degree: 1,
							});
							foundNewEdges = true;
						}
					} else {
						// Track as intermediate for second-degree lookup
						if (
							!intermediateRefs.has(
								refId,
							)
						) {
							intermediateRefs.set(
								refId,
								paper.id,
							);
						}
					}
				}
			} catch {
				// Silently continue on reference fetch failures
			}
		}

		// Send update after first-degree if we found edges
		if (foundNewEdges) {
			panel.webview.postMessage({
				type: "graphData",
				papers,
				edges,
			});
		}

		// Second-degree references: fetch refs of intermediate papers
		// Limit to avoid excessive API calls (max 20 intermediates)
		const intermediateIds = Array.from(
			intermediateRefs.keys(),
		).slice(0, 20);
		let foundSecondDegree = false;

		for (const intId of intermediateIds) {
			try {
				const refs2 =
					await s2Client.getReferences(intId);
				for (const refId2 of refs2) {
					if (paperIds.has(refId2)) {
						// Found a second-degree connection: savedPaper -> intermediate -> refId2
						const sourcePaper =
							intermediateRefs.get(
								intId,
							)!;
						if (sourcePaper === refId2) {
							continue; // Skip self-loops
						}

						const exists = edges.some(
							(e) =>
								(e.source ===
									sourcePaper &&
									e.target ===
										refId2) ||
								(e.source ===
									refId2 &&
									e.target ===
										sourcePaper),
						);
						if (!exists) {
							edges.push({
								source: sourcePaper,
								target: refId2,
								degree: 2,
							});
							foundSecondDegree = true;
						}
					}
				}
			} catch {
				// Silently continue
			}
		}

		// Send final update with second-degree edges
		if (foundSecondDegree) {
			panel.webview.postMessage({
				type: "graphData",
				papers,
				edges,
			});
		}
	}
}
