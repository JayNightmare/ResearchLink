import * as vscode from "vscode";
import { Paper, SearchFields } from "../types";
import { CrossRefClient } from "../lib/api/crossref";
import { SemanticScholarClient } from "../lib/api/semanticscholar";
import { LibraryStore } from "../lib/storage/library";
import { createExtractor, MetadataExtractor } from "../features/extraction";
import { OpenAlexClient } from "../lib/api/openalex";

export class ResearchLibraryProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "research-link.researchLibrary";

	private _view?: vscode.WebviewView;

	private _crossRefClient = new CrossRefClient();
	private _semanticScholarClient = new SemanticScholarClient();
	private _openAlexClient = new OpenAlexClient();
	private _libraryStore: LibraryStore;
	private _extractor: MetadataExtractor = createExtractor();

	constructor(private readonly _context: vscode.ExtensionContext) {
		// Initialize LibraryStore with globalStoragePath
		this._libraryStore = new LibraryStore(
			_context.globalStorageUri.fsPath,
		);
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			// Restrict the webview to only load resources from the `out` and `media` directories
			localResourceRoots: [
				vscode.Uri.joinPath(
					this._context.extensionUri,
					"out",
				),
				vscode.Uri.joinPath(
					this._context.extensionUri,
					"media",
				),
			],
		};

		webviewView.webview.html = this._getHtmlForWebview(
			webviewView.webview,
		);

		webviewView.webview.onDidReceiveMessage(async (data) => {
			switch (data.type) {
				case "search": {
					const query = data.value;
					if (!query) {
						return;
					}

					await vscode.window.withProgress(
						{
							location: vscode
								.ProgressLocation
								.Notification,
							title: `Searching for "${query}"...`,
							cancellable: false,
						},
						async () => {
							try {
								const [
									crossRefResults,
									semanticScholarResults,
									openAlexResults,
								] =
									await Promise.all(
										[
											this._crossRefClient.search(
												query,
											),
											this._semanticScholarClient.search(
												query,
											),
											this._openAlexClient.search(
												query,
											),
										],
									);

								const combinedPapers =
									this._mergeResults(
										semanticScholarResults.papers,
										crossRefResults.papers,
										openAlexResults.papers,
									);

								// Send results back to webview
								webviewView.webview.postMessage(
									{
										type: "searchResults",
										value: combinedPapers,
									},
								);
							} catch (error) {
								vscode.window.showErrorMessage(
									`Search failed: ${error}`,
								);
							}
						},
					);
					break;
				}
				case "advancedSearch": {
					const fields =
						data.value as SearchFields;
					if (!fields) {
						return;
					}

					const label = fields.doi
						? `Looking up DOI: ${fields.doi}`
						: `Advanced search...`;

					await vscode.window.withProgress(
						{
							location: vscode
								.ProgressLocation
								.Notification,
							title: label,
							cancellable: false,
						},
						async () => {
							try {
								const [
									crossRefResults,
									semanticScholarResults,
									openAlexResults,
								] =
									await Promise.all(
										[
											this._crossRefClient.searchAdvanced(
												fields,
											),
											this._semanticScholarClient.searchAdvanced(
												fields,
											),
											this._openAlexClient.searchAdvanced(
												fields,
											),
										],
									);

								const combinedPapers =
									this._mergeResults(
										semanticScholarResults.papers,
										crossRefResults.papers,
										openAlexResults.papers,
									);

								webviewView.webview.postMessage(
									{
										type: "searchResults",
										value: combinedPapers,
									},
								);
							} catch (error) {
								vscode.window.showErrorMessage(
									`Search failed: ${error}`,
								);
							}
						},
					);
					break;
				}
				case "savePaper": {
					const enriched =
						await this._extractor.enrich(
							data.paper,
						);
					this._libraryStore.addPaper(enriched);
					vscode.window.showInformationMessage(
						`Saved paper: ${data.title}`,
					);
					// Refresh library view
					this._sendLibraryUpdate(
						webviewView.webview,
					);
					break;
				}
				case "removePaper": {
					this._libraryStore.removePaper(data.id);
					vscode.window.showInformationMessage(
						`Removed paper.`,
					);
					// Refresh library view
					this._sendLibraryUpdate(
						webviewView.webview,
					);
					break;
				}
				case "getLibrary": {
					this._sendLibraryUpdate(
						webviewView.webview,
					);
					break;
				}
				case "updateTags": {
					const paper =
						this._libraryStore.getPaper(
							data.id,
						);
					if (paper) {
						paper.tags = data.tags;
						this._libraryStore.addPaper(
							paper,
						);
						this._sendLibraryUpdate(
							webviewView.webview,
						);
					}
					break;
				}
				case "openPaper": {
					vscode.commands.executeCommand(
						"research-link.openPaper",
						data.paper,
					);
					break;
				}
				case "openGraph": {
					vscode.commands.executeCommand(
						"research-link.openGraph",
					);
					break;
				}
				case "importPdf": {
					vscode.commands.executeCommand(
						"research-link.importPdf",
					);
					break;
				}
				case "importUrl": {
					vscode.commands.executeCommand(
						"research-link.importUrl",
					);
					break;
				}
			}
		});
	}

	private _mergeResults(
		s2Papers: Paper[],
		crossRefPapers: Paper[],
		openAlexPapers: Paper[],
	): Paper[] {
		const merged = new Map<string, Paper>();

		// 1. S2 results (often best for citation counts & links)
		for (const p of s2Papers) {
			const key =
				p.doi?.toLowerCase() ||
				p.title.toLowerCase().trim();
			merged.set(key, p);
		}

		// 2. OpenAlex results (great coverage, OA links)
		for (const p of openAlexPapers) {
			const key =
				p.doi?.toLowerCase() ||
				p.title.toLowerCase().trim();
			const existing = merged.get(key);
			if (existing) {
				// Enrich existing
				if (!existing.abstract && p.abstract) {
					existing.abstract = p.abstract;
				}
				if (!existing.doi && p.doi) {
					existing.doi = p.doi;
				}
				if (!existing.pdfUrl && p.pdfUrl) {
					existing.pdfUrl = p.pdfUrl;
					existing.isOpenAccess = true;
				}
				if (!existing.venue && p.venue) {
					existing.venue = p.venue;
				}
				if (
					(existing.citations || 0) <
					(p.citations || 0)
				) {
					existing.citations = p.citations;
				}
			} else {
				merged.set(key, p);
			}
		}

		// 3. CrossRef results (standard metadata)
		for (const p of crossRefPapers) {
			const key =
				p.doi?.toLowerCase() ||
				p.title.toLowerCase().trim();
			const existing = merged.get(key);
			if (existing) {
				// Enrich existing
				if (!existing.abstract && p.abstract) {
					existing.abstract = p.abstract;
				}
				if (!existing.doi && p.doi) {
					existing.doi = p.doi;
				}
				if (!existing.pdfUrl && p.pdfUrl) {
					existing.pdfUrl = p.pdfUrl;
					existing.isOpenAccess = true;
				}
				if (!existing.venue && p.venue) {
					existing.venue = p.venue;
				}
			} else {
				merged.set(key, p);
			}
		}

		return Array.from(merged.values());
	}

	private _sendLibraryUpdate(webview: vscode.Webview) {
		const papers = this._libraryStore.getAllPapers();
		webview.postMessage({
			type: "libraryUpdate",
			value: papers,
		});
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(
				this._context.extensionUri,
				"out",
				"webview",
				"index.js",
			),
		);

		// Get the local path to main style run in the webview, then convert it to a uri we can use in the webview.
		const styleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(
				this._context.extensionUri,
				"out",
				"webview",
				"index.css",
			),
		);

		// Use a nonce to only allow a specific script to be run.
		const nonce = getNonce();

		return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <!--
                    Use a content security policy to only allow loading images from https or from our extension directory,
                    and only allow scripts that have a specific nonce.
                -->
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleUri}" rel="stylesheet">
                <title>Research Library</title>
            </head>
            <body>
                <div id="root"></div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
	}
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
