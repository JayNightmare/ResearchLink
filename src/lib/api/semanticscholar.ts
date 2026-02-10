import { Paper, SearchResult } from "../../types";

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

export class SemanticScholarClient {
	private readonly baseUrl =
		"https://api.semanticscholar.org/graph/v1/paper/search";

	async search(query: string, limit: number = 10): Promise<SearchResult> {
		const url = new URL(this.baseUrl);
		url.searchParams.append("query", query);
		url.searchParams.append("limit", limit.toString());
		url.searchParams.append(
			"fields",
			"paperId,title,authors,abstract,citationCount,venue,year,url,publicationTypes,openAccessPdf,externalIds",
		);

		try {
			const response = await fetch(url.toString(), {
				headers: {
					// Normally API key would be here if public rate limits are exceeded
					"User-Agent":
						"ResearchLink-VSCode-Extension/0.1",
				},
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
				headers: {
					"User-Agent":
						"ResearchLink-VSCode-Extension/0.1",
				},
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
