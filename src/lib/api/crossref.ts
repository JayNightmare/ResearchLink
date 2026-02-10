import { Paper, SearchResult } from "../../types";

interface CrossRefAuthor {
	given?: string;
	family?: string;
}

interface CrossRefWork {
	DOI: string;
	title: string[];
	author?: CrossRefAuthor[];
	"container-title"?: string[];
	"is-referenced-by-count"?: number;
	URL: string;
	created?: {
		"date-parts": number[][];
	};
	abstract?: string;
}

interface CrossRefResponse {
	message: {
		items: CrossRefWork[];
		"total-results": number;
	};
}

export class CrossRefClient {
	private readonly baseUrl = "https://api.crossref.org/works";

	async search(query: string, limit: number = 10): Promise<SearchResult> {
		const url = new URL(this.baseUrl);
		url.searchParams.append("query", query);
		url.searchParams.append("rows", limit.toString());
		url.searchParams.append("sort", "relevance");

		try {
			const response = await fetch(url.toString(), {
				headers: {
					"User-Agent":
						"ResearchLink-VSCode-Extension/0.1 (mailto:contact@example.com)", // Good practice for CrossRef
				},
			});

			if (!response.ok) {
				throw new Error(
					`CrossRef API error: ${response.statusText}`,
				);
			}

			const data =
				(await response.json()) as CrossRefResponse;
			const papers = data.message.items.map(this.mapToPaper);

			return {
				papers,
				total: data.message["total-results"],
				source: "crossref",
			};
		} catch (error) {
			console.error("CrossRef search failed:", error);
			return {
				papers: [],
				total: 0,
				source: "crossref",
			};
		}
	}

	private mapToPaper(work: CrossRefWork): Paper {
		const authors = work.author
			? work.author
					.map((a) =>
						`${a.given || ""} ${a.family || ""}`.trim(),
					)
					.filter((n) => n.length > 0)
			: [];

		// Simple abstract cleanup if present (often XML)
		let abstract = work.abstract;
		if (abstract) {
			abstract = abstract.replace(/<[^>]*>/g, ""); // Naive strip tags
		}

		return {
			id: work.DOI,
			title: work.title ? work.title[0] : "Untitled",
			authors,
			doi: work.DOI,
			url: work.URL,
			venue: work["container-title"]?.[0],
			citations: work["is-referenced-by-count"] || 0,
			year: work.created?.["date-parts"]?.[0]?.[0],
			abstract,
		};
	}
}
