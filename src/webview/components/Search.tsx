import * as React from "react";
import { useState, useEffect } from "react";
import { Paper } from "../../types";

interface SearchProps {
	vscode: any;
}

const Search: React.FC<SearchProps> = ({ vscode }) => {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<Paper[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data;
			switch (message.type) {
				case "searchResults":
					setResults((prev) => message.value);
					setLoading(false);
					break;
			}
		};

		window.addEventListener("message", handleMessage);
		return () =>
			window.removeEventListener("message", handleMessage);
	}, []);

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		if (vscode && query) {
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

	return (
		<div className="p-4 space-y-6">
			<header>
				<h2 className="text-xl font-bold mb-4 tracking-tight">
					Search Papers
				</h2>
				<form
					onSubmit={handleSearch}
					className="flex gap-2"
				>
					<div className="relative flex-1">
						<input
							type="text"
							value={query}
							onChange={(e) =>
								setQuery(
									e.target
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
						disabled={loading || !query}
						className="cursor-pointer px-4 py-2 bg-primary text-primary-foreground font-medium rounded shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
					>
						{loading ? "..." : "Search"}
					</button>
				</form>
			</header>

			<div className="space-y-4">
				{loading && (
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
						<p className="text-muted-foreground">
							Searching databases...
						</p>
					</div>
				)}

				{!loading && results.length > 0
					? results.map((paper, index) => (
							<div
								key={`${paper.id}-${index}`}
								className="group relative p-4 border border-border rounded-lg bg-card text-card-foreground shadow-sm hover:shadow-md transition-all hover:border-primary/50"
							>
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
						))
					: !loading && (
							<div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border rounded-lg bg-muted/20">
								<div className="text-4xl mb-4">
									🔍
								</div>
								<p className="font-medium text-foreground">
									No
									papers
									found
								</p>
								<p className="text-sm text-muted-foreground mt-1 max-w-[200px]">
									{query
										? "Try adjusting your search terms."
										: "Enter a query to search CrossRef and Semantic Scholar."}
								</p>
							</div>
						)}
			</div>
		</div>
	);
};

export default Search;
