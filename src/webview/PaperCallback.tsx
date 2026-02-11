import * as React from "react";
import { useState, useEffect } from "react";
import { Paper } from "../types";

declare global {
	interface Window {
		acquireVsCodeApi: () => any;
	}
}

const vscode = window.acquireVsCodeApi ? window.acquireVsCodeApi() : null;

const PaperCallback: React.FC = () => {
	const [paper, setPaper] = useState<Paper | null>(null);
	const [tab, setTab] = useState<"overview" | "reference">("overview");
	const [refStyle, setRefStyle] = useState("APA");
	const [citationType, setCitationType] = useState<"full" | "in-text">(
		"full",
	);

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			if (event.data.type === "loadPaper") {
				setPaper(event.data.value);
			}
		};
		window.addEventListener("message", handleMessage);

		// Signal ready
		if (vscode) vscode.postMessage({ type: "ready" });

		return () =>
			window.removeEventListener("message", handleMessage);
	}, []);

	const handleGenerateAIReference = () => {
		if (vscode && paper) {
			vscode.postMessage({
				type: "generateAIReference",
				paper,
			});
		}
	};

	const handleOpenPdf = () => {
		if (vscode && paper && paper.pdfUrl) {
			vscode.postMessage({
				type: "openPdf",
				url: paper.pdfUrl,
				title: paper.title,
				paperId: paper.id,
			});
		}
	};

	if (!paper)
		return (
			<div className="p-4 text-center text-muted-foreground animate-pulse">
				Loading paper details...
			</div>
		);

	return (
		<div className="flex flex-col h-screen bg-background text-foreground p-6 font-sans">
			{/* Top Section */}
			<div className="border-b border-border pb-6 mb-6">
				<div className="flex justify-between items-start">
					<div>
						<div className="flex gap-2 mb-2">
							<span className="text-xs font-mono font-bold text-muted-foreground bg-muted px-2 py-1 rounded-full uppercase tracking-wider">
								{paper.publicationType ||
									"Scanned Article"}
							</span>
							{paper.isOpenAccess && (
								<span className="text-xs font-mono font-bold text-secondary-foreground bg-secondary px-2 py-1 rounded-full uppercase tracking-wider border border-border">
									Open
									Access
								</span>
							)}
						</div>
						<h1 className="text-3xl font-bold leading-tight tracking-tight">
							{paper.title}
						</h1>
						<div className="text-sm text-muted-foreground mt-3 space-y-1">
							<p className="font-medium">
								{paper.authors
									.length >
								0
									? paper.authors.join(
											", ",
										)
									: "Unknown Authors"}
							</p>
							<p>
								<span className="font-semibold">
									{
										paper.year
									}
								</span>
								{paper.venue && (
									<span>
										{" "}
										•{" "}
										{
											paper.venue
										}
									</span>
								)}
								{paper.citations ? (
									<span>
										{" "}
										•{" "}
										{
											paper.citations
										}{" "}
										citations
									</span>
								) : null}
							</p>
							{paper.id && (
								<p className="font-mono text-xs opacity-75">
									ID:{" "}
									{
										paper.id
									}
								</p>
							)}
						</div>
					</div>
				</div>

				<div className="flex gap-2 mt-6">
					<button
						onClick={() =>
							setTab("overview")
						}
						className={`cursor-pointer px-4 py-2 rounded-md text-sm font-medium transition-colors focus:ring-2 focus:ring-ring ${
							tab === "overview"
								? "bg-primary text-primary-foreground shadow-sm"
								: "hover:bg-muted text-muted-foreground hover:text-foreground"
						}`}
					>
						Overview
					</button>
					<button
						onClick={() =>
							setTab("reference")
						}
						className={`cursor-pointer px-4 py-2 rounded-md text-sm font-medium transition-colors focus:ring-2 focus:ring-ring ${
							tab === "reference"
								? "bg-primary text-primary-foreground shadow-sm"
								: "hover:bg-muted text-muted-foreground hover:text-foreground"
						}`}
					>
						Reference
					</button>
					{paper.url && (
						<a
							href={paper.url}
							target="_blank"
							rel="noopener noreferrer"
							className="px-4 py-2 rounded-md text-sm font-medium border border-input hover:bg-muted text-center flex items-center ml-auto transition-colors"
						>
							View Source ↗
						</a>
					)}
					{paper.pdfUrl && (
						<button
							onClick={handleOpenPdf}
							className="cursor-pointer px-4 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 shadow-sm flex items-center transition-colors"
							title="Open PDF"
						>
							Read PDF 📄
						</button>
					)}
				</div>
			</div>

			{/* Bottom Section */}
			<div className="flex-1 overflow-y-auto pr-2">
				{tab === "overview" && (
					<div className="space-y-6">
						<section>
							<h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
								<span className="w-1 h-4 bg-primary rounded-full"></span>
								Abstract
							</h3>
							<p className="leading-relaxed text-base text-foreground/90 whitespace-pre-wrap">
								{paper.abstract || (
									<span className="italic text-muted-foreground">
										No
										abstract
										available.
									</span>
								)}
							</p>
						</section>

						{paper.doi && (
							<section className="pt-4 border-t border-border">
								<h3 className="text-sm font-semibold mb-2 text-muted-foreground">
									DOI
								</h3>
								<a
									href={`https://doi.org/${paper.doi}`}
									className="text-primary hover:underline font-mono text-sm break-all"
								>
									https://doi.org/
									{
										paper.doi
									}
								</a>
							</section>
						)}
					</div>
				)}

				{tab === "reference" && (
					<div className="space-y-6">
						<div className="flex gap-4 items-end flex-wrap">
							<div className="space-y-1">
								<label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
									Style
								</label>
								<select
									title="Select Reference Style"
									value={
										refStyle
									}
									onChange={(
										e,
									) =>
										setRefStyle(
											e
												.target
												.value,
										)
									}
									className="block w-40 p-2 border border-input rounded bg-background text-sm focus:ring-2 focus:ring-ring"
								>
									<option>
										APA
									</option>
									<option>
										Harvard
									</option>
									<option>
										MLA
									</option>
									<option>
										Chicago
									</option>
								</select>
							</div>

							<div className="space-y-1">
								<label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
									Format
								</label>
								<div className="flex border border-input rounded overflow-hidden">
									<button
										onClick={() =>
											setCitationType(
												"full",
											)
										}
										className={`cursor-pointer px-3 py-2 text-sm ${
											citationType ===
											"full"
												? "bg-accent text-accent-foreground font-medium"
												: "hover:bg-muted"
										}`}
									>
										Full
										Citation
									</button>
									<div className="w-px bg-input"></div>
									<button
										onClick={() =>
											setCitationType(
												"in-text",
											)
										}
										className={`cursor-pointer px-3 py-2 text-sm ${
											citationType ===
											"in-text"
												? "bg-accent text-accent-foreground font-medium"
												: "hover:bg-muted"
										}`}
									>
										In-Text
									</button>
								</div>
							</div>
						</div>

						<div className="relative group">
							<div className="p-6 bg-muted/40 rounded-lg font-mono text-sm border border-border/50 shadow-sm relative overflow-hidden">
								<div className="absolute top-0 left-0 w-1 h-full bg-primary/20"></div>
								{generateReference(
									paper,
									refStyle,
									citationType,
								)}
							</div>
							<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
								<button
									className="cursor-pointer text-xs bg-background border shadow-sm px-2 py-1 rounded"
									onClick={() => {
										navigator.clipboard.writeText(
											generateReference(
												paper,
												refStyle,
												citationType,
											),
										);
									}}
								>
									Copy
								</button>
							</div>
						</div>

						<div className="pt-6 border-t border-border mt-8">
							<h3 className="font-semibold mb-3 flex items-center gap-2">
								<span className="text-xl">
									🤖
								</span>
								AI Workflow
							</h3>
							<div className="bg-card border border-border p-4 rounded-lg">
								<p className="text-sm text-muted-foreground mb-4">
									Generate
									a
									structured
									markdown
									file
									tailored
									for LLM
									context,
									including
									abstract,
									citations,
									and
									metadata.
								</p>
								<button
									onClick={
										handleGenerateAIReference
									}
									className="cursor-pointer w-full sm:w-auto px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 flex items-center justify-center gap-2 font-medium transition-colors"
								>
									<span>
										✨
									</span>
									Generate
									AI
									Reference
									File
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

function generateReference(
	paper: Paper,
	style: string,
	type: "full" | "in-text",
) {
	const authors = paper.authors;

	if (type === "in-text") {
		const year = paper.year || "n.d.";
		if (authors.length === 1) return `(${authors[0]}, ${year})`;
		if (authors.length === 2)
			return `(${authors[0]} & ${authors[1]}, ${year})`;
		if (authors.length > 2)
			return `(${authors[0]} et al., ${year})`;
		return `(${paper.title}, ${year})`;
	}

	const authorString = authors.join(", ");

	switch (style) {
		case "APA":
			return `${authorString}. (${paper.year}). ${paper.title}. ${paper.venue || ""}. ${paper.url || ""}`;
		case "MLA":
			return `${authorString}. "${paper.title}." ${paper.venue || ""}, ${paper.year}.`;
		case "Harvard":
			return `${authorString} (${paper.year}) '${paper.title}', ${paper.venue || ""}. Available at: ${paper.url || ""}`;
		case "Chicago":
			return `${authorString}. "${paper.title}." ${paper.venue || ""} (${paper.year}).`;
		default:
			return `${paper.title} - ${authorString} (${paper.year})`;
	}
}

export default PaperCallback;
