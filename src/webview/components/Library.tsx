import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { Paper } from "../../types";

interface LibraryProps {
	vscode: any;
}

const Library: React.FC<LibraryProps> = ({ vscode }) => {
	const [papers, setPapers] = useState<Paper[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [sortBy, setSortBy] = useState<
		"newest" | "oldest" | "title" | "year" | "citations"
	>("newest");
	const [filterType, setFilterType] = useState<string>("all");
	const [filterAuthor, setFilterAuthor] = useState("");
	const [editingTagsFor, setEditingTagsFor] = useState<string | null>(
		null,
	);
	const [newTagInput, setNewTagInput] = useState("");

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data;
			switch (message.type) {
				case "libraryUpdate":
					setPapers(message.value);
					break;
			}
		};

		window.addEventListener("message", handleMessage);

		// Request initial library data
		if (vscode) {
			vscode.postMessage({ type: "getLibrary" });
		}

		return () =>
			window.removeEventListener("message", handleMessage);
	}, [vscode]);

	const handleRemove = (id: string, e: React.MouseEvent) => {
		e.stopPropagation();
		if (vscode) {
			vscode.postMessage({ type: "removePaper", id: id });
		}
	};

	const handleOpen = (paper: Paper) => {
		if (vscode) {
			vscode.postMessage({ type: "openPaper", paper: paper });
		}
	};

	const handleUpdateTags = (id: string, newTags: string[]) => {
		// Optimistic update
		const updatedPapers = papers.map((p) =>
			p.id === id ? { ...p, tags: newTags } : p,
		);
		setPapers(updatedPapers);
		if (vscode) {
			vscode.postMessage({
				type: "updateTags",
				id,
				tags: newTags,
			});
		}
	};

	const addTag = (id: string, tag: string) => {
		const paper = papers.find((p) => p.id === id);
		if (paper) {
			const currentTags = paper.tags || [];
			if (!currentTags.includes(tag)) {
				handleUpdateTags(id, [...currentTags, tag]);
			}
		}
		setNewTagInput("");
		setEditingTagsFor(null);
	};

	const removeTag = (id: string, tag: string) => {
		const paper = papers.find((p) => p.id === id);
		if (paper && paper.tags) {
			handleUpdateTags(
				id,
				paper.tags.filter((t) => t !== tag),
			);
		}
	};

	// Derive all unique tags
	const allTags = useMemo(() => {
		const tags = new Set<string>();
		papers.forEach((p) => p.tags?.forEach((t) => tags.add(t)));
		return Array.from(tags).sort();
	}, [papers]);

	// Derive all unique publication types
	const allTypes = useMemo(() => {
		const types = new Set<string>();
		papers.forEach((p) => {
			if (p.publicationType) types.add(p.publicationType);
		});
		return Array.from(types).sort();
	}, [papers]);

	// Filter and Sort
	const filteredPapers = useMemo(() => {
		let result = papers;

		// Search Filter
		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			result = result.filter(
				(p) =>
					p.title.toLowerCase().includes(q) ||
					p.authors.some((a) =>
						a.toLowerCase().includes(q),
					) ||
					p.tags?.some((t) =>
						t.toLowerCase().includes(q),
					),
			);
		}

		// Tag Filter
		if (selectedTags.length > 0) {
			result = result.filter((p) =>
				selectedTags.every((t) => p.tags?.includes(t)),
			);
		}

		// Type Filter
		if (filterType !== "all") {
			result = result.filter(
				(p) => p.publicationType === filterType,
			);
		}

		// Author Filter
		if (filterAuthor) {
			const aq = filterAuthor.toLowerCase();
			result = result.filter((p) =>
				p.authors.some((a) =>
					a.toLowerCase().includes(aq),
				),
			);
		}

		// Sort
		result = [...result].sort((a, b) => {
			switch (sortBy) {
				case "newest":
					return (
						(b.enrichedAt || 0) -
						(a.enrichedAt || 0)
					);
				case "oldest":
					return (
						(a.enrichedAt || 0) -
						(b.enrichedAt || 0)
					);
				case "title":
					return a.title.localeCompare(b.title);
				case "year":
					return (b.year || 0) - (a.year || 0);
				case "citations":
					return (
						(b.citations || 0) -
						(a.citations || 0)
					);
				default:
					return 0;
			}
		});

		return result;
	}, [
		papers,
		searchQuery,
		selectedTags,
		sortBy,
		filterType,
		filterAuthor,
	]);

	return (
		<div className="flex flex-col h-full bg-background text-foreground">
			{/* Sticky Header with Filters */}
			<div className="p-4 border-b border-border space-y-4 sticky top-0 bg-background/95 backdrop-blur z-10">
				<header className="flex items-center justify-between">
					<h2 className="text-xl font-bold tracking-tight">
						My Library
					</h2>
					<span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
						{filteredPapers.length} /{" "}
						{papers.length}
					</span>
				</header>

				<div className="space-y-2">
					<input
						type="text"
						placeholder="Filter papers..."
						value={searchQuery}
						onChange={(e) =>
							setSearchQuery(
								e.target.value,
							)
						}
						className="w-full px-3 py-2 bg-input text-foreground border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
					/>

					<div className="flex gap-2">
						<select
							title="Sort by"
							value={sortBy}
							onChange={(e) =>
								setSortBy(
									e.target
										.value as any,
								)
							}
							className="flex-1 px-2 py-1.5 bg-input text-foreground border border-input rounded-md text-xs focus:outline-none"
						>
							<option value="newest">
								Newest Added
							</option>
							<option value="oldest">
								Oldest Added
							</option>
							<option value="year">
								Year (Newest)
							</option>
							<option value="citations">
								Most Cited
							</option>
							<option value="title">
								Title (A-Z)
							</option>
						</select>

						{allTypes.length > 0 && (
							<select
								title="Filter by type"
								value={
									filterType
								}
								onChange={(e) =>
									setFilterType(
										e
											.target
											.value,
									)
								}
								className="flex-1 px-2 py-1.5 bg-input text-foreground border border-input rounded-md text-xs focus:outline-none"
							>
								<option value="all">
									All
									Types
								</option>
								{allTypes.map(
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
						)}
					</div>

					<input
						type="text"
						placeholder="Filter by author..."
						value={filterAuthor}
						onChange={(e) =>
							setFilterAuthor(
								e.target.value,
							)
						}
						className="w-full px-3 py-1.5 bg-input text-foreground border border-input rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary"
					/>

					{/* Tag Cloud */}
					{allTags.length > 0 && (
						<div className="flex flex-wrap gap-1.5 pt-1">
							{allTags.map((tag) => (
								<button
									key={
										tag
									}
									onClick={() =>
										setSelectedTags(
											(
												prev,
											) =>
												prev.includes(
													tag,
												)
													? prev.filter(
															(
																t,
															) =>
																t !==
																tag,
														)
													: [
															...prev,
															tag,
														],
										)
									}
									className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
										selectedTags.includes(
											tag,
										)
											? "bg-primary text-primary-foreground border-primary"
											: "bg-muted text-muted-foreground border-transparent hover:border-primary/50"
									}`}
								>
									{tag}
								</button>
							))}
						</div>
					)}
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{filteredPapers.length > 0 ? (
					filteredPapers.map((paper) => (
						<div
							key={paper.id}
							onClick={() =>
								handleOpen(
									paper,
								)
							}
							className="group relative p-4 border border-border rounded-lg bg-card text-card-foreground shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-primary/50"
						>
							<div className="flex justify-between items-start gap-4 mb-2">
								<div className="flex flex-col gap-1 w-full">
									<div className="flex gap-2 mb-1">
										<span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
											{paper.publicationType ||
												(paper.venue
													? "Journal"
													: "Paper")}
										</span>
										{paper.isOpenAccess && (
											<span className="text-[10px] uppercase font-bold tracking-wider text-secondary-foreground bg-secondary px-1.5 py-0.5 rounded border border-border">
												OA
											</span>
										)}
									</div>
									<h3 className="font-semibold text-base leading-tight group-hover:text-primary transition-colors">
										{
											paper.title
										}
									</h3>
								</div>
							</div>

							<div className="text-sm text-muted-foreground mb-3 space-y-0.5">
								<p className="line-clamp-1">
									{paper.authors
										? paper
												.authors
												.length >
											3
											? paper.authors
													.slice(
														0,
														3,
													)
													.join(
														", ",
													) +
												" et al."
											: paper.authors.join(
													", ",
												)
										: "Unknown Author"}
								</p>
								<p className="text-xs flex items-center gap-2">
									<span className="font-medium text-foreground">
										{
											paper.year
										}
									</span>
									{paper.citations ? (
										<span>
											•{" "}
											{
												paper.citations
											}{" "}
											citations
										</span>
									) : null}
								</p>
							</div>

							{/* Tags on Card */}
							<div className="flex flex-wrap gap-1.5 mb-3">
								{paper.tags?.map(
									(
										tag,
									) => (
										<span
											key={
												tag
											}
											className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-secondary text-secondary-foreground font-medium border border-border"
										>
											{
												tag
											}
											<button
												onClick={(
													e,
												) => {
													e.stopPropagation();
													removeTag(
														paper.id,
														tag,
													);
												}}
												className="ml-1 hover:text-destructive cursor-pointer"
											>
												×
											</button>
										</span>
									),
								)}

								{editingTagsFor ===
								paper.id ? (
									<div
										className="flex items-center gap-1"
										onClick={(
											e,
										) =>
											e.stopPropagation()
										}
									>
										<input
											autoFocus
											type="text"
											value={
												newTagInput
											}
											onChange={(
												e,
											) =>
												setNewTagInput(
													e
														.target
														.value,
												)
											}
											onKeyDown={(
												e,
											) => {
												if (
													e.key ===
													"Enter"
												) {
													e.preventDefault();
													if (
														newTagInput.trim()
													) {
														addTag(
															paper.id,
															newTagInput.trim(),
														);
													}
												} else if (
													e.key ===
													"Escape"
												) {
													setEditingTagsFor(
														null,
													);
													setNewTagInput(
														"",
													);
												}
											}}
											onBlur={() => {
												if (
													newTagInput.trim()
												) {
													addTag(
														paper.id,
														newTagInput.trim(),
													);
												} else {
													setEditingTagsFor(
														null,
													);
												}
											}}
											className="w-20 px-1 py-0.5 text-[10px] bg-background border border-primary rounded outline-none text-foreground"
											placeholder="Tag..."
										/>
									</div>
								) : (
									<button
										onClick={(
											e,
										) => {
											e.stopPropagation();
											setEditingTagsFor(
												paper.id,
											);
											setNewTagInput(
												"",
											);
										}}
										className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground hover:bg-secondary hover:text-secondary-foreground transition-colors cursor-pointer border border-transparent hover:border-border"
									>
										+
										Tag
									</button>
								)}
							</div>

							<div className="flex items-center gap-2 mt-auto pt-3 border-t border-border/50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
								<button
									onClick={(
										e,
									) => {
										e.stopPropagation();
										handleOpen(
											paper,
										);
									}}
									className="cursor-pointer text-xs font-medium px-3 py-1.5 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
								>
									Read
								</button>
								{paper.url && (
									<a
										href={
											paper.url
										}
										target="_blank"
										rel="noopener noreferrer"
										onClick={(
											elem,
										) =>
											elem.stopPropagation()
										}
										className="text-xs font-medium px-3 py-1.5 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors cursor-pointer"
									>
										Source
									</a>
								)}
								<button
									onClick={(
										elem,
									) =>
										handleRemove(
											paper.id,
											elem,
										)
									}
									className="cursor-pointer ml-auto text-xs font-medium px-2 py-1.5 text-destructive hover:bg-destructive/10 rounded transition-colors"
								>
									Remove
								</button>
							</div>
						</div>
					))
				) : (
					<div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border rounded-lg bg-muted/20">
						<div className="text-4xl mb-4">
							📚
						</div>
						<p className="font-medium text-foreground">
							{papers.length === 0
								? "Your library is empty"
								: "No papers match filters"}
						</p>
						{papers.length === 0 && (
							<p className="text-sm text-muted-foreground mt-1 max-w-[200px]">
								Search for
								papers to start
								building your
								collection.
							</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export default Library;
