import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ResearchLibraryProvider } from "./webview/ResearchLibraryProvider";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log(
		'Congratulations, your extension "research-gate" is now active!',
	);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand(
		"research-gate.helloWorld",
		() => {
			// The code you place here will be executed every time your command is executed
			// Display a message box to the user
			vscode.window.showInformationMessage(
				"Hello World from Research Gate!",
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
			"research-gate.openPaper",
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
						}
					},
					undefined,
					context.subscriptions,
				);
			},
		),
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}

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
