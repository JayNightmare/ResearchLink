import { Paper, SearchResult, SearchFields } from "../../types";

export class OpenAlexClient {
	private baseUrl = "https://api.openalex.org/works";

	private _mapWorkToPaper(work: any): Paper {
		// Extract DOI
		let doi = work.doi;
		if (doi && doi.startsWith("https://doi.org/")) {
			doi = doi.replace("https://doi.org/", "");
		}

		// Extract Venue
		const venue =
			work.primary_location?.source?.display_name ||
			work.primary_location?.source?.host_organization_name;

		// Extract PDF URL (Open Access)
		const pdfUrl = work.open_access?.is_oa
			? work.best_oa_location?.pdf_url
			: undefined;

		// Extract Authors
		const authors =
			work.authorships?.map(
				(a: any) => a.author.display_name,
			) || [];

		// Extract Abstract (OpenAlex uses inverted index, recreate text)
		let abstract = undefined;
		if (work.abstract_inverted_index) {
			const index = work.abstract_inverted_index;
			const wordList: { word: string; pos: number }[] = [];
			for (const word in index) {
				const positions = index[word];
				if (Array.isArray(positions)) {
					positions.forEach((pos: number) =>
						wordList.push({ word, pos }),
					);
				}
			}
			wordList.sort((a, b) => a.pos - b.pos);
			abstract = wordList.map((w) => w.word).join(" ");
		}

		return {
			id: work.id, // OpenAlex ID (https://openalex.org/W...)
			title: work.title || "Untitled",
			authors,
			year: work.publication_year,
			venue,
			doi,
			abstract,
			citations: work.cited_by_count,
			url: work.id, // Use OA ID as URL if no other URL
			pdfUrl,
			publicationType: work.type_crossref || work.type,
			isOpenAccess: work.open_access?.is_oa || false,
			source: "openalex",
		};
	}

	async search(query: string, limit: number = 10): Promise<SearchResult> {
		try {
			const url = new URL(this.baseUrl);
			url.searchParams.append("search", query);
			url.searchParams.append("per-page", limit.toString());
			// Sort by relevance by default in OpenAlex search

			const response = await fetch(url.toString());
			if (!response.ok) {
				throw new Error(
					`OpenAlex API error: ${response.status}`,
				);
			}

			const data = await response.json();
			const results = data.results || [];

			const papers = results.map((r: any) =>
				this._mapWorkToPaper(r),
			);

			return {
				papers,
				total: data.meta?.count || 0,
				source: "openalex",
			};
		} catch (error) {
			console.error("OpenAlex search failed:", error);
			return { papers: [], total: 0, source: "openalex" };
		}
	}

	async lookupByDoi(doi: string): Promise<Paper | null> {
		try {
			const url = new URL(this.baseUrl);
			// clean DOI just in case
			const cleanDoi = doi.replace(
				/^https?:\/\/doi\.org\//,
				"",
			);
			// OpenAlex filter expects full DOI URL usually: https://doi.org/10.xxx
			// documentation says: filter=doi:https://doi.org/10.1371/journal.pone.0266781
			const doiUrl = `https://doi.org/${cleanDoi}`;

			url.searchParams.append("filter", `doi:${doiUrl}`);

			const response = await fetch(url.toString());
			if (!response.ok) {
				return null;
			}

			const data = await response.json();
			if (data.results && data.results.length > 0) {
				return this._mapWorkToPaper(data.results[0]);
			}
			return null;
		} catch (error) {
			console.error("OpenAlex DOI lookup failed:", error);
			return null;
		}
	}

	async searchAdvanced(
		fields: SearchFields,
		limit: number = 10,
	): Promise<SearchResult> {
		if (fields.doi) {
			const paper = await this.lookupByDoi(fields.doi);
			return {
				papers: paper ? [paper] : [],
				total: paper ? 1 : 0,
				source: "openalex",
			};
		}

		try {
			const url = new URL(this.baseUrl);
			const filters: string[] = [];
			const textQueryParts: string[] = [];

			if (fields.title) {
				textQueryParts.push(fields.title);
			}

			if (fields.author) {
				// filter=authorships.author.display_name.search:Einstein
				filters.push(
					`authorships.author.display_name.search:${fields.author}`,
				);
			}

			if (fields.venue) {
				// filter=primary_location.source.display_name.search:Nature
				filters.push(
					`primary_location.source.display_name.search:${fields.venue}`,
				);
			}

			if (fields.year) {
				if (fields.year.from && fields.year.to) {
					filters.push(
						`publication_year:${fields.year.from}-${fields.year.to}`,
					);
				} else if (fields.year.from) {
					filters.push(
						`publication_year:>${fields.year.from - 1}`,
					);
				} else if (fields.year.to) {
					filters.push(
						`publication_year:<${fields.year.to + 1}`,
					);
				}
			}

			if (textQueryParts.length > 0) {
				url.searchParams.append(
					"search",
					textQueryParts.join(" "),
				);
			}

			if (filters.length > 0) {
				url.searchParams.append(
					"filter",
					filters.join(","),
				);
			}

			url.searchParams.append("per-page", limit.toString());

			const response = await fetch(url.toString());
			if (!response.ok) {
				throw new Error(
					`OpenAlex API error: ${response.status}`,
				);
			}

			const data = await response.json();
			const results = data.results || [];

			const papers = results.map((r: any) =>
				this._mapWorkToPaper(r),
			);

			return {
				papers,
				total: data.meta?.count || 0,
				source: "openalex",
			};
		} catch (error) {
			console.error(
				"OpenAlex advanced search failed:",
				error,
			);
			return { papers: [], total: 0, source: "openalex" };
		}
	}
}
