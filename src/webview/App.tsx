import * as React from "react";
import { useState } from "react";
import Search from "./components/Search";
import Library from "./components/Library";

declare global {
	interface Window {
		acquireVsCodeApi: () => any;
	}
}

const vscode = window.acquireVsCodeApi ? window.acquireVsCodeApi() : null;

const App: React.FC = () => {
	const [view, setView] = useState<"library" | "search">("library");

	return (
		<div className="flex flex-col h-screen bg-background text-foreground p-4">
			<header className="mb-6">
				<nav className="flex bg-muted p-1 rounded-md">
					<button
						onClick={() =>
							setView("library")
						}
						className={`cursor-pointer flex-1 px-3 py-1.5 text-sm font-medium rounded-sm transition-all ${
							view === "library"
								? "bg-background text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground hover:bg-background/50"
						}`}
					>
						Library
					</button>
					<button
						onClick={() =>
							setView("search")
						}
						className={`cursor-pointer flex-1 px-3 py-1.5 text-sm font-medium rounded-sm transition-all ${
							view === "search"
								? "bg-background text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground hover:bg-background/50"
						}`}
					>
						Search
					</button>
					<button
						onClick={() => {
							if (vscode) {
								vscode.postMessage(
									{
										type: "openGraph",
									},
								);
							}
						}}
						className="cursor-pointer px-3 py-1.5 text-sm font-medium rounded-sm transition-all text-muted-foreground hover:text-foreground hover:bg-background/50"
						title="Open Graph View"
					>
						🕸️
					</button>
				</nav>
			</header>

			<main className="flex-1 overflow-y-auto">
				{view === "library" ? (
					<Library vscode={vscode} />
				) : (
					<Search vscode={vscode} />
				)}
			</main>
		</div>
	);
};

export default App;
