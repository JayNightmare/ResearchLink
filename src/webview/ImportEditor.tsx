import * as React from "react";
import { useState, useEffect } from "react";
import { Paper } from "../types";

declare global {
	interface Window {
		acquireVsCodeApi: () => any;
	}
}

const vscode = window.acquireVsCodeApi ? window.acquireVsCodeApi() : null;

const PUBLICATION_TYPES = [
	"JournalArticle",
	"Conference",
	"Review",
	"Book",
	"BookSection",
	"Dataset",
	"Preprint",
	"Other",
];

const ImportEditor: React.FC = () => {
	// View state
	const [view, setView] = useState<"edit" | "selection">("edit");
	const [candidates, setCandidates] = useState<Paper[]>([]);

	// Form state
	const [title, setTitle] = useState("Untitled Paper");
	const [authors, setAuthors] = useState("");
	const [year, setYear] = useState(new Date().getFullYear());
	const [venue, setVenue] = useState("");
	const [abstract, setAbstract] = useState("");
	const [doi, setDoi] = useState("");
	const [pdfUrl, setPdfUrl] = useState("");
	const [publicationType, setPublicationType] =
		useState("JournalArticle");
	const [tags, setTags] = useState("");
	const [importSource, setImportSource] = useState<"pdf" | "url">("url");
	const [fileName, setFileName] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data;
			if (message.type === "loadImportData") {
				populateForm(message.paper || {});
				if (message.importSource)
					setImportSource(message.importSource);
				if (message.fileName)
					setFileName(message.fileName);
				setView("edit");
			} else if (message.type === "loadCandidates") {
				setCandidates(message.papers || []);
				setImportSource("url");
				setView("selection");
			}
		};
		window.addEventListener("message", handleMessage);
		if (vscode) vscode.postMessage({ type: "ready" });
		return () =>
			window.removeEventListener("message", handleMessage);
	}, []);

	const populateForm = (p: Partial<Paper>) => {
		if (p.title) setTitle(p.title);
		if (p.authors?.length) setAuthors(p.authors.join(", "));
		if (p.year) setYear(p.year);
		if (p.venue) setVenue(p.venue);
		if (p.abstract) setAbstract(p.abstract);
		if (p.doi) setDoi(p.doi);
		if (p.pdfUrl) setPdfUrl(p.pdfUrl);
		if (p.publicationType) setPublicationType(p.publicationType);
		if (p.tags?.length) setTags(p.tags.join(", "));
	};

	const handleSave = () => {
		if (!title.trim()) return;
		setSaving(true);

		const paper: Paper = {
			id:
				doi ||
				`user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
			title: title.trim(),
			authors: authors
				.split(/\s*,\s*/)
				.map((a) => a.trim())
				.filter((a) => a.length > 0),
			year,
			venue: venue.trim() || undefined,
			abstract: abstract.trim() || undefined,
			doi: doi.trim() || undefined,
			pdfUrl: pdfUrl.trim() || undefined,
			publicationType,
			tags: tags
				.split(/\s*,\s*/)
				.map((t) => t.trim())
				.filter((t) => t.length > 0),
			source: "user",
			isOpenAccess: false,
		};

		if (vscode) {
			vscode.postMessage({
				type: "saveImportedPaper",
				paper,
			});
		}
	};

	const handleCancel = () => {
		if (vscode) {
			vscode.postMessage({ type: "cancelImport" });
		}
	};

	const selectCandidate = (paper: Paper) => {
		populateForm(paper);
		setView("edit");
	};

	const skipSelection = () => {
		// Clear form defaults for manual entry
		setTitle("");
		setAuthors("");
		setYear(new Date().getFullYear());
		setVenue("");
		setAbstract("");
		setDoi("");
		setPdfUrl("");
		setView("edit");
	};

	if (view === "selection") {
		return (
			<div className="flex flex-col h-screen bg-background text-foreground p-6 font-sans">
				<div className="border-b border-border pb-6 mb-6">
					<h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground">
						Select a Paper
					</h1>
					<p className="text-sm text-muted-foreground mt-1">
						We found multiple matches.
						Please select the correct paper
						or enter details manually.
					</p>
				</div>

				<div className="flex-1 overflow-y-auto pr-2 space-y-3">
					{candidates.map((paper, i) => (
						<div
							key={i}
							onClick={() =>
								selectCandidate(
									paper,
								)
							}
							className="p-4 border border-border rounded-lg bg-card hover:border-primary/50 hover:shadow-md cursor-pointer transition-all group"
						>
							<h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors">
								{paper.title}
							</h3>
							<p className="text-sm text-muted-foreground mb-2 line-clamp-1">
								{paper.authors.join(
									", ",
								)}{" "}
								• {paper.year}
							</p>
							{paper.venue && (
								<p className="text-xs text-muted-foreground bg-muted inline-block px-1.5 py-0.5 rounded">
									{
										paper.venue
									}
								</p>
							)}
						</div>
					))}
				</div>

				<div className="pt-6 mt-4 border-t border-border">
					<button
						onClick={skipSelection}
						className="cursor-pointer w-full py-2.5 text-sm font-medium border border-input text-foreground hover:bg-muted rounded-md transition-colors"
					>
						None of these — Enter manually
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-screen bg-background text-foreground p-6 font-sans">
			{/* Header */}
			<div className="border-b border-border pb-6 mb-6">
				<div className="flex gap-2 mb-3">
					<span className="text-xs font-mono font-bold text-primary-foreground bg-primary px-2 py-1 rounded-full uppercase tracking-wider">
						{importSource === "pdf"
							? "PDF Import"
							: "URL Import"}
					</span>
					<span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full uppercase tracking-wider border border-amber-500/30">
						User Added
					</span>
					{fileName && (
						<span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded-full">
							📄 {fileName}
						</span>
					)}
				</div>
				<h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground">
					Import Paper
				</h1>
				<p className="text-sm text-muted-foreground mt-1">
					Review and edit the extracted metadata,
					then save to your library.
				</p>
			</div>

			{/* Form */}
			<div className="flex-1 overflow-y-auto pr-2 space-y-5">
				{/* Title */}
				<div className="space-y-1.5">
					<label className="text-sm font-semibold text-foreground flex items-center gap-2">
						<span className="w-1 h-4 bg-primary rounded-full"></span>
						Title{" "}
						<span className="text-destructive">
							*
						</span>
					</label>
					<input
						type="text"
						value={title}
						onChange={(e) =>
							setTitle(e.target.value)
						}
						placeholder="Paper title"
						className="w-full px-3 py-2 text-sm bg-input border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
					/>
				</div>

				{/* Authors */}
				<div className="space-y-1.5">
					<label className="text-sm font-semibold text-foreground flex items-center gap-2">
						<span className="w-1 h-4 bg-primary rounded-full"></span>
						Authors
					</label>
					<input
						type="text"
						value={authors}
						onChange={(e) =>
							setAuthors(
								e.target.value,
							)
						}
						placeholder="Author 1, Author 2, Author 3"
						className="w-full px-3 py-2 text-sm bg-input border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
					/>
					<p className="text-xs text-muted-foreground">
						Comma-separated names
					</p>
				</div>

				{/* Year + Venue (side by side) */}
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-1.5">
						<label className="text-sm font-semibold text-foreground">
							Year
						</label>
						<input
							title="Publication year"
							type="number"
							value={year}
							onChange={(e) =>
								setYear(
									parseInt(
										e
											.target
											.value,
									) ||
										new Date().getFullYear(),
								)
							}
							min={1900}
							max={2100}
							className="w-full px-3 py-2 text-sm bg-input border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
						/>
					</div>
					<div className="space-y-1.5">
						<label className="text-sm font-semibold text-foreground">
							Venue
						</label>
						<input
							type="text"
							value={venue}
							onChange={(e) =>
								setVenue(
									e.target
										.value,
								)
							}
							placeholder="e.g. NeurIPS 2024"
							className="w-full px-3 py-2 text-sm bg-input border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
						/>
					</div>
				</div>

				{/* Abstract */}
				<div className="space-y-1.5">
					<label className="text-sm font-semibold text-foreground flex items-center gap-2">
						<span className="w-1 h-4 bg-primary rounded-full"></span>
						Abstract
					</label>
					<textarea
						value={abstract}
						onChange={(e) =>
							setAbstract(
								e.target.value,
							)
						}
						placeholder="Paste or edit the abstract..."
						rows={6}
						className="w-full px-3 py-2 text-sm bg-input border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y transition-colors leading-relaxed"
					/>
				</div>

				{/* DOI + PDF URL */}
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-1.5">
						<label className="text-sm font-semibold text-foreground">
							DOI
						</label>
						<input
							type="text"
							value={doi}
							onChange={(e) =>
								setDoi(
									e.target
										.value,
								)
							}
							placeholder="10.xxxx/xxxxx"
							className="w-full px-3 py-2 text-sm bg-input border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono transition-colors"
						/>
					</div>
					<div className="space-y-1.5">
						<label className="text-sm font-semibold text-foreground">
							PDF URL
						</label>
						<input
							type="text"
							value={pdfUrl}
							onChange={(e) =>
								setPdfUrl(
									e.target
										.value,
								)
							}
							placeholder="https://..."
							className="w-full px-3 py-2 text-sm bg-input border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
						/>
					</div>
				</div>

				{/* Publication Type + Tags */}
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-1.5">
						<label className="text-sm font-semibold text-foreground">
							Publication Type
						</label>
						<select
							title="Publication type"
							value={publicationType}
							onChange={(e) =>
								setPublicationType(
									e.target
										.value,
								)
							}
							className="w-full px-3 py-2 text-sm bg-input border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer transition-colors"
						>
							{PUBLICATION_TYPES.map(
								(t) => (
									<option
										key={
											t
										}
										value={
											t
										}
									>
										{
											t
										}
									</option>
								),
							)}
						</select>
					</div>
					<div className="space-y-1.5">
						<label className="text-sm font-semibold text-foreground">
							Tags
						</label>
						<input
							type="text"
							value={tags}
							onChange={(e) =>
								setTags(
									e.target
										.value,
								)
							}
							placeholder="tag1, tag2, tag3"
							className="w-full px-3 py-2 text-sm bg-input border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
						/>
						<p className="text-xs text-muted-foreground">
							Comma-separated
						</p>
					</div>
				</div>
			</div>

			{/* Action Buttons */}
			<div className="flex items-center gap-3 pt-6 mt-6 border-t border-border">
				<button
					onClick={handleSave}
					disabled={!title.trim() || saving}
					className="cursor-pointer px-6 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
				>
					{saving
						? "Saving..."
						: "💾 Save to Library"}
				</button>
				<button
					onClick={handleCancel}
					className="cursor-pointer px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
				>
					Cancel
				</button>
				<span className="ml-auto text-xs text-muted-foreground">
					{title.trim()
						? "✓ Ready to save"
						: "Title is required"}
				</span>
			</div>
		</div>
	);
};

export default ImportEditor;
