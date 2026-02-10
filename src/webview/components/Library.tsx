import * as React from "react";
import { useState, useEffect } from "react";
import { Paper } from "../../types";

interface LibraryProps {
	vscode: any;
}

const Library: React.FC<LibraryProps> = ({ vscode }) => {
	const [papers, setPapers] = useState<Paper[]>([]);

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

	return (
		<div className="p-4 space-y-6">
			<header className="flex items-center justify-between">
				<h2 className="text-xl font-bold tracking-tight">
					My Library
				</h2>
				<span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
					{papers.length}{" "}
					{papers.length === 1
						? "paper"
						: "papers"}
				</span>
			</header>

			<div className="space-y-4">
				{papers.length > 0 ? (
					papers.map((paper) => (
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
											e,
										) =>
											e.stopPropagation()
										}
										className="text-xs font-medium px-3 py-1.5 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors"
									>
										Source
									</a>
								)}
								<button
									onClick={(
										e,
									) =>
										handleRemove(
											paper.id,
											e,
										)
									}
									className="cursor-pointer ml-auto text-xs font-medium px-2 py-1.5 text-destructive hover:bg-destructive/10 rounded transition-colors"
									title="Remove from library"
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
							Your library is empty
						</p>
						<p className="text-sm text-muted-foreground mt-1 max-w-[200px]">
							Search for papers to
							start building your
							collection.
						</p>
					</div>
				)}
			</div>
		</div>
	);
};

export default Library;
