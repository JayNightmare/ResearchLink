import { Paper, SearchResult, SearchFields } from "../../types";

interface S2Author {
	name: string;
}

interface S2Paper {
	paperId: string;
	title: string;
	authors: S2Author[];
	abstract: string;
	year: number;
	citationCount: number;
	venue: string;
	url: string;
	publicationTypes?: string[];
	openAccessPdf?: { url: string; status: string } | null;
	externalIds?: { DOI?: string; ArXiv?: string } | null;
}

interface S2Response {
	data: S2Paper[];
	total: number;
}

const S2_FIELDS =
	"paperId,title,authors,abstract,citationCount,venue,year,url,publicationTypes,openAccessPdf,externalIds";

export class SemanticScholarClient {
	private readonly baseUrl =
		"https://api.semanticscholar.org/graph/v1/paper/search";

	private readonly headers = {
		"User-Agent": "ResearchLink-VSCode-Extension/0.1",
	};

	async search(query: string, limit: number = 10): Promise<SearchResult> {
		const url = new URL(this.baseUrl);
		url.searchParams.append("query", query);
		url.searchParams.append("limit", limit.toString());
		url.searchParams.append("fields", S2_FIELDS);

		try {
			const response = await fetch(url.toString(), {
				headers: this.headers,
			});

			if (!response.ok) {
				if (response.status === 429) {
					console.warn(
						"Semantic Scholar rate limit reached.",
					);
				}
				throw new Error(
					`Semantic Scholar API error: ${response.statusText}`,
				);
			}

			const data = (await response.json()) as S2Response;
			const papers = data.data
				? data.data.map(this.mapToPaper)
				: [];

			return {
				papers,
				total: data.total || papers.length,
				source: "semanticscholar",
			};
		} catch (error) {
			console.error("Semantic Scholar search failed:", error);
			return {
				papers: [],
				total: 0,
				source: "semanticscholar",
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
				source: "semanticscholar",
			};
		}

		// Build keyword query from structured fields
		const parts: string[] = [];
		if (fields.title) {
			parts.push(fields.title);
		}
		if (fields.author) {
			parts.push(fields.author);
		}
		if (fields.venue) {
			parts.push(fields.venue);
		}

		const query = parts.join(" ");
		if (!query) {
			return {
				papers: [],
				total: 0,
				source: "semanticscholar",
			};
		}

		const url = new URL(this.baseUrl);
		url.searchParams.append("query", query);
		url.searchParams.append("limit", limit.toString());
		url.searchParams.append("fields", S2_FIELDS);

		// S2 supports year range filter
		if (fields.year?.from || fields.year?.to) {
			const from = fields.year.from || "";
			const to = fields.year.to || "";
			url.searchParams.append("year", `${from}-${to}`);
		}

		try {
			const response = await fetch(url.toString(), {
				headers: this.headers,
			});

			if (!response.ok) {
				throw new Error(
					`Semantic Scholar API error: ${response.statusText}`,
				);
			}

			const data = (await response.json()) as S2Response;
			const papers = data.data
				? data.data.map(this.mapToPaper)
				: [];

			return {
				papers,
				total: data.total || papers.length,
				source: "semanticscholar",
			};
		} catch (error) {
			console.error("S2 advanced search failed:", error);
			return {
				papers: [],
				total: 0,
				source: "semanticscholar",
			};
		}
	}

	async lookupByDoi(doi: string): Promise<Paper | null> {
		const url = `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=${S2_FIELDS}`;

		try {
			const response = await fetch(url, {
				headers: this.headers,
			});

			if (!response.ok) {
				return null;
			}

			const data = (await response.json()) as S2Paper;
			return this.mapToPaper(data);
		} catch {
			return null;
		}
	}

	private mapToPaper(paper: S2Paper): Paper {
		return {
			id: paper.paperId, // S2ID
			title: paper.title,
			authors: paper.authors
				? paper.authors.map((a) => a.name)
				: [],
			abstract: paper.abstract || undefined,
			doi: paper.externalIds?.DOI || undefined,
			citations: paper.citationCount || 0,
			year: paper.year,
			venue: paper.venue,
			url: paper.url,
			publicationType: paper.publicationTypes
				? paper.publicationTypes[0]
				: undefined,
			isOpenAccess: !!paper.openAccessPdf,
			pdfUrl: paper.openAccessPdf?.url,
		};
	}

	async getReferences(paperId: string): Promise<string[]> {
		const url = `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(paperId)}/references?fields=paperId&limit=100`;

		try {
			const response = await fetch(url, {
				headers: this.headers,
			});

			if (!response.ok) {
				return [];
			}

			const data = (await response.json()) as {
				data: {
					citedPaper: { paperId: string | null };
				}[];
			};

			return (data.data || [])
				.map((r) => r.citedPaper?.paperId)
				.filter(
					(id): id is string =>
						id !== null && id !== undefined,
				);
		} catch {
			return [];
		}
	}
}
