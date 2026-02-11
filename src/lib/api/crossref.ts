import { Paper, SearchResult, SearchFields } from "../../types";

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
	type?: string;
}

interface CrossRefResponse {
	message: {
		items: CrossRefWork[];
		"total-results": number;
	};
}

interface CrossRefSingleResponse {
	message: CrossRefWork;
}

export class CrossRefClient {
	private readonly baseUrl = "https://api.crossref.org/works";

	private readonly headers = {
		"User-Agent":
			"ResearchLink-VSCode-Extension/0.1 (mailto:contact@example.com)",
	};

	async search(query: string, limit: number = 10): Promise<SearchResult> {
		const url = new URL(this.baseUrl);
		url.searchParams.append("query", query);
		url.searchParams.append("rows", limit.toString());
		url.searchParams.append("sort", "relevance");

		try {
			const response = await fetch(url.toString(), {
				headers: this.headers,
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

	async searchAdvanced(
		fields: SearchFields,
		limit: number = 10,
	): Promise<SearchResult> {
		// DOI — use direct lookup
		if (fields.doi) {
			const paper = await this.lookupByDoi(fields.doi);
			return {
				papers: paper ? [paper] : [],
				total: paper ? 1 : 0,
				source: "crossref",
			};
		}

		const url = new URL(this.baseUrl);
		url.searchParams.append("rows", limit.toString());
		url.searchParams.append("sort", "relevance");

		// CrossRef supports field-specific query params
		if (fields.title) {
			url.searchParams.append("query.title", fields.title);
		}
		if (fields.author) {
			url.searchParams.append("query.author", fields.author);
		}
		if (fields.venue) {
			url.searchParams.append(
				"query.container-title",
				fields.venue,
			);
		}

		// Year range filter
		const filters: string[] = [];
		if (fields.year?.from) {
			filters.push(`from-pub-date:${fields.year.from}`);
		}
		if (fields.year?.to) {
			filters.push(`until-pub-date:${fields.year.to}`);
		}
		if (filters.length > 0) {
			url.searchParams.append("filter", filters.join(","));
		}

		// Need at least one query param
		if (
			!fields.title &&
			!fields.author &&
			!fields.venue &&
			filters.length === 0
		) {
			return { papers: [], total: 0, source: "crossref" };
		}

		try {
			const response = await fetch(url.toString(), {
				headers: this.headers,
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
			console.error(
				"CrossRef advanced search failed:",
				error,
			);
			return { papers: [], total: 0, source: "crossref" };
		}
	}

	async lookupByDoi(doi: string): Promise<Paper | null> {
		const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//i, "");
		const url = `${this.baseUrl}/${encodeURIComponent(cleanDoi)}`;

		try {
			const response = await fetch(url, {
				headers: this.headers,
			});

			if (!response.ok) {
				return null;
			}

			const data =
				(await response.json()) as CrossRefSingleResponse;
			return this.mapToPaper(data.message);
		} catch {
			return null;
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
