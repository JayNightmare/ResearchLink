import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { Paper } from "../../types";

interface SearchProps {
	vscode: any;
}

const Search: React.FC<SearchProps> = ({ vscode }) => {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<Paper[]>([]);
	const [loading, setLoading] = useState(false);
	const [advanced, setAdvanced] = useState(false);

	// Advanced search fields
	const [fieldTitle, setFieldTitle] = useState("");
	const [fieldAuthor, setFieldAuthor] = useState("");
	const [fieldYearFrom, setFieldYearFrom] = useState("");
	const [fieldYearTo, setFieldYearTo] = useState("");
	const [fieldVenue, setFieldVenue] = useState("");
	const [fieldDoi, setFieldDoi] = useState("");

	// Client-side Filters & Sort
	const [filterYearFrom, setFilterYearFrom] = useState("");
	const [filterYearTo, setFilterYearTo] = useState("");
	const [filterOpenAccess, setFilterOpenAccess] = useState(false);
	const [filterPubType, setFilterPubType] = useState("All");
	const [sortBy, setSortBy] = useState<
		"relevance" | "citationCount" | "yearDesc" | "yearAsc"
	>("relevance");

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data;
			switch (message.type) {
				case "searchResults":
					setResults(message.value || []);
					setLoading(false);
					// Reset filters on new search
					setFilterPubType("All");
					setFilterYearFrom("");
					setFilterYearTo("");
					break;
			}
		};

		window.addEventListener("message", handleMessage);
		return () =>
			window.removeEventListener("message", handleMessage);
	}, []);

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		if (!vscode) return;

		if (advanced) {
			const hasFields =
				fieldTitle ||
				fieldAuthor ||
				fieldYearFrom ||
				fieldYearTo ||
				fieldVenue ||
				fieldDoi;
			if (!hasFields) return;
			setLoading(true);
			setResults([]);
			vscode.postMessage({
				type: "advancedSearch",
				value: {
					title: fieldTitle || undefined,
					author: fieldAuthor || undefined,
					year:
						fieldYearFrom || fieldYearTo
							? {
									from: fieldYearFrom
										? parseInt(
												fieldYearFrom,
												10,
											)
										: undefined,
									to: fieldYearTo
										? parseInt(
												fieldYearTo,
												10,
											)
										: undefined,
								}
							: undefined,
					venue: fieldVenue || undefined,
					doi: fieldDoi || undefined,
				},
			});
		} else {
			if (!query) return;
			setLoading(true);
			setResults([]);
			vscode.postMessage({ type: "search", value: query });
		}
	};

	const handleSave = (paper: Paper) => {
		if (vscode) {
			vscode.postMessage({
				type: "savePaper",
				title: paper.title,
				paper: paper,
			});
		}
	};

	const clearAdvanced = () => {
		setFieldTitle("");
		setFieldAuthor("");
		setFieldYearFrom("");
		setFieldYearTo("");
		setFieldVenue("");
		setFieldDoi("");
	};

	const hasAdvancedInput =
		fieldTitle ||
		fieldAuthor ||
		fieldYearFrom ||
		fieldYearTo ||
		fieldVenue ||
		fieldDoi;

	// Derived logic: Filtered & Sorted Results
	const filteredResults = useMemo(() => {
		let out = [...results];

		// 1. Filter: Year
		if (filterYearFrom) {
			const from = parseInt(filterYearFrom, 10);
			out = out.filter((p) => (p.year || 0) >= from);
		}
		if (filterYearTo) {
			const to = parseInt(filterYearTo, 10);
			out = out.filter((p) => (p.year || 0) <= to);
		}

		// 2. Filter: Open Access
		if (filterOpenAccess) {
			out = out.filter((p) => p.isOpenAccess);
		}

		// 3. Filter: Pub Type
		if (filterPubType !== "All") {
			out = out.filter((p) => {
				const type =
					p.publicationType ||
					(p.venue ? "Journal" : "Paper");
				return type === filterPubType;
			});
		}

		// 4. Sort
		out.sort((a, b) => {
			switch (sortBy) {
				case "citationCount":
					return (
						(b.citations || 0) -
						(a.citations || 0)
					);
				case "yearDesc":
					return (b.year || 0) - (a.year || 0);
				case "yearAsc":
					return (a.year || 0) - (b.year || 0);
				case "relevance":
				default:
					return 0; // Preserve original API order (relevance)
			}
		});

		return out;
	}, [
		results,
		filterYearFrom,
		filterYearTo,
		filterOpenAccess,
		filterPubType,
		sortBy,
	]);

	// Extract unique publication types from results for the dropdown
	const availableTypes = useMemo(() => {
		const types = new Set<string>();
		results.forEach((p) => {
			const t =
				p.publicationType ||
				(p.venue ? "Journal" : "Paper");
			if (t) types.add(t);
		});
		return Array.from(types).sort();
	}, [results]);

	const fieldInputClass =
		"w-full p-2 text-sm border border-input rounded bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-all shadow-sm";
	const labelClass =
		"block text-xs font-medium text-muted-foreground mb-1";

	return (
		<div className="p-4 space-y-4">
			<header className="space-y-4">
				<div className="flex items-center justify-between mb-2">
					<h2 className="text-xl font-bold tracking-tight">
						Search Papers
					</h2>
					<button
						type="button"
						onClick={() => {
							setAdvanced(!advanced);
							// setResults([]); // Optional: clear or keep results on toggle? Keeping is better UX.
						}}
						className={`cursor-pointer text-xs font-medium px-2.5 py-1 rounded transition-all ${
							advanced
								? "bg-primary text-primary-foreground"
								: "bg-muted text-muted-foreground hover:text-foreground"
						}`}
					>
						{advanced
							? "⚙ Advanced"
							: "⚙ Advanced"}
					</button>
				</div>

				<form
					onSubmit={handleSearch}
					className="space-y-3"
				>
					{!advanced ? (
						<div className="flex gap-2">
							<div className="relative flex-1">
								<input
									type="text"
									title="Search query"
									value={
										query
									}
									onChange={(
										e,
									) =>
										setQuery(
											e
												.target
												.value,
										)
									}
									placeholder="Title, author, DOI..."
									className="w-full p-2 pl-3 pr-8 border border-input rounded bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent transition-all shadow-sm"
								/>
								{query && (
									<button
										type="button"
										onClick={() =>
											setQuery(
												"",
											)
										}
										className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
									>
										x
									</button>
								)}
							</div>
							<button
								type="submit"
								disabled={
									loading ||
									!query
								}
								className="cursor-pointer px-4 py-2 bg-primary text-primary-foreground font-medium rounded shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
							>
								{loading
									? "..."
									: "Search"}
							</button>
						</div>
					) : (
						<div className="space-y-3 p-3 border border-border rounded-lg bg-muted/30">
							{/* ... Advanced fields ... */}
							{/* Reusing existing logic for fields */}
							<div>
								<label
									className={
										labelClass
									}
								>
									Title
								</label>
								<input
									type="text"
									title="Title"
									value={
										fieldTitle
									}
									onChange={(
										e,
									) =>
										setFieldTitle(
											e
												.target
												.value,
										)
									}
									className={
										fieldInputClass
									}
								/>
							</div>
							<div>
								<label
									className={
										labelClass
									}
								>
									Author
								</label>
								<input
									type="text"
									title="Author"
									value={
										fieldAuthor
									}
									onChange={(
										e,
									) =>
										setFieldAuthor(
											e
												.target
												.value,
										)
									}
									className={
										fieldInputClass
									}
								/>
							</div>
							<div className="flex gap-2">
								<div className="flex-1">
									<label
										className={
											labelClass
										}
									>
										Year
										From
									</label>
									<input
										type="number"
										title="Year From"
										value={
											fieldYearFrom
										}
										onChange={(
											e,
										) =>
											setFieldYearFrom(
												e
													.target
													.value,
											)
										}
										className={
											fieldInputClass
										}
									/>
								</div>
								<div className="flex-1">
									<label
										className={
											labelClass
										}
									>
										Year
										To
									</label>
									<input
										type="number"
										title="Year To"
										value={
											fieldYearTo
										}
										onChange={(
											e,
										) =>
											setFieldYearTo(
												e
													.target
													.value,
											)
										}
										className={
											fieldInputClass
										}
									/>
								</div>
							</div>
							<div>
								<label
									className={
										labelClass
									}
								>
									Venue
								</label>
								<input
									type="text"
									title="Venue"
									value={
										fieldVenue
									}
									onChange={(
										e,
									) =>
										setFieldVenue(
											e
												.target
												.value,
										)
									}
									className={
										fieldInputClass
									}
								/>
							</div>
							<div>
								<label
									className={
										labelClass
									}
								>
									DOI
								</label>
								<input
									type="text"
									title="DOI"
									value={
										fieldDoi
									}
									onChange={(
										e,
									) =>
										setFieldDoi(
											e
												.target
												.value,
										)
									}
									className={
										fieldInputClass
									}
								/>
							</div>
							<div className="flex gap-2 pt-1">
								<button
									type="submit"
									disabled={
										loading ||
										!hasAdvancedInput
									}
									className="cursor-pointer flex-1 px-4 py-2 bg-primary text-primary-foreground font-medium rounded shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
								>
									{loading
										? "Searching..."
										: "Search"}
								</button>
								<button
									type="button"
									onClick={
										clearAdvanced
									}
									className="cursor-pointer px-3 py-2 border border-input text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-all text-sm"
								>
									Clear
								</button>
							</div>
						</div>
					)}
				</form>
			</header>

			{/* Filter & Sort Bar (Only show if we have results) */}
			{!loading && results.length > 0 && (
				<div className="bg-muted/10 border-y border-border py-2 -mx-4 px-4 flex flex-wrap gap-2 items-center text-xs">
					<div className="flex items-center gap-1.5">
						<span className="text-muted-foreground font-medium">
							Total:
						</span>
						<span className="font-bold">
							{filteredResults.length}
						</span>
					</div>

					<div className="h-4 w-px bg-border mx-1"></div>

					<div className="flex items-center gap-1">
						<span className="text-muted-foreground">
							Year:
						</span>
						<input
							type="number"
							title="Filter Year From"
							placeholder="From"
							value={filterYearFrom}
							onChange={(e) =>
								setFilterYearFrom(
									e.target
										.value,
								)
							}
							className="w-14 px-1 py-0.5 border border-input rounded bg-background"
						/>
						<span>-</span>
						<input
							type="number"
							title="Filter Year To"
							placeholder="To"
							value={filterYearTo}
							onChange={(e) =>
								setFilterYearTo(
									e.target
										.value,
								)
							}
							className="w-14 px-1 py-0.5 border border-input rounded bg-background"
						/>
					</div>

					<div className="h-4 w-px bg-border mx-1"></div>

					<label className="flex items-center gap-1.5 cursor-pointer select-none">
						<input
							type="checkbox"
							title="Filter Open Access"
							checked={
								filterOpenAccess
							}
							onChange={(e) =>
								setFilterOpenAccess(
									e.target
										.checked,
								)
							}
							className="rounded border-input text-primary focus:ring-primary/20"
						/>
						<span>Open Access</span>
					</label>

					<div className="h-4 w-px bg-border mx-1"></div>

					<select
						title="Filter Publication Type"
						value={filterPubType}
						onChange={(e) =>
							setFilterPubType(
								e.target.value,
							)
						}
						className="bg-background border border-input rounded px-1 py-0.5 max-w-[100px]"
					>
						<option value="All">
							All Types
						</option>
						{availableTypes.map((t) => (
							<option
								key={t}
								value={t}
							>
								{t}
							</option>
						))}
					</select>

					<div className="h-4 w-px bg-border mx-1"></div>

					<select
						title="Sort By"
						value={sortBy}
						onChange={(e) =>
							setSortBy(
								e.target
									.value as any,
							)
						}
						className="bg-background border border-input rounded px-1 py-0.5"
					>
						<option value="relevance">
							Relevance
						</option>
						<option value="citationCount">
							Most Cited
						</option>
						<option value="yearDesc">
							Newest
						</option>
						<option value="yearAsc">
							Oldest
						</option>
					</select>
				</div>
			)}

			<div className="space-y-4">
				{loading && (
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
						<p className="text-muted-foreground">
							Searching databases...
						</p>
					</div>
				)}

				{!loading && filteredResults.length > 0
					? filteredResults.map(
							(paper, index) => (
								<div
									key={`${paper.id}-${index}`}
									className="group relative p-4 border border-border rounded-lg bg-card text-card-foreground shadow-sm hover:shadow-md transition-all hover:border-primary/50"
								>
									{/* Paper Card Content */}
									<div className="flex justify-between items-start gap-4 mb-2">
										<div className="flex flex-col gap-1">
											<div className="flex gap-2">
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
										<p className="text-xs">
											<span className="font-medium text-foreground">
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
									</div>

									<div className="flex items-center gap-2 mt-auto pt-3 border-t border-border/50">
										<button
											onClick={() =>
												handleSave(
													paper,
												)
											}
											className="cursor-pointer text-xs font-medium px-3 py-1.5 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors flex-1 text-center"
										>
											Save
											to
											Library
										</button>
										{paper.url && (
											<a
												href={
													paper.url
												}
												target="_blank"
												rel="noopener noreferrer"
												className="text-xs font-medium px-3 py-1.5 border border-input hover:bg-muted rounded transition-colors"
											>
												Source
											</a>
										)}
									</div>
								</div>
							),
						)
					: !loading &&
						filteredResults.length === 0 &&
						results.length > 0 && (
							// No results AFTER filter
							<div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border rounded-lg bg-muted/20">
								<div className="text-4xl mb-4">
									🌪️
								</div>
								<p className="font-medium text-foreground">
									No
									matches
									with
									current
									filters
								</p>
								<button
									onClick={() => {
										setFilterPubType(
											"All",
										);
										setFilterYearFrom(
											"",
										);
										setFilterYearTo(
											"",
										);
										setFilterOpenAccess(
											false,
										);
									}}
									className="mt-2 text-primary hover:underline text-sm"
								>
									Clear
									Filters
								</button>
							</div>
						)}

				{!loading && results.length === 0 && (
					// No results available at all
					<div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border rounded-lg bg-muted/20">
						<div className="text-4xl mb-4">
							🔍
						</div>
						<p className="font-medium text-foreground">
							No papers found
						</p>
						<p className="text-sm text-muted-foreground mt-1 max-w-[200px]">
							{query ||
							hasAdvancedInput
								? "Try adjusting your search terms."
								: advanced
									? "Fill in at least one field to search."
									: "Enter a query to search CrossRef and Semantic Scholar."}
						</p>
					</div>
				)}
			</div>
		</div>
	);
};

export default Search;
