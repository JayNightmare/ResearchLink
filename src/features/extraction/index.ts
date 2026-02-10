import { Paper } from "../../types";

export interface ExtractionStrategy {
	name: string;
	extract(paper: Paper): Promise<Paper>;
}

export class MetadataExtractor {
	private strategies: ExtractionStrategy[] = [];

	register(strategy: ExtractionStrategy) {
		this.strategies.push(strategy);
	}

	async enrich(paper: Paper): Promise<Paper> {
		let enriched = { ...paper };
		for (const strategy of this.strategies) {
			try {
				enriched = await strategy.extract(enriched);
			} catch (error) {
				console.error(
					`Metadata extraction failed for ${strategy.name}:`,
					error,
				);
			}
		}
		enriched.enrichedAt = Date.now();
		return enriched;
	}
}

/** Trims whitespace from title and author names */
export const BasicFormatter: ExtractionStrategy = {
	name: "BasicFormatter",
	async extract(paper: Paper): Promise<Paper> {
		return {
			...paper,
			authors: paper.authors.map((a) => a.trim()),
			title: paper.title.trim(),
		};
	},
};

/** Strips HTML/XML tags from abstracts (CrossRef often returns JATS XML) */
export const AbstractCleaner: ExtractionStrategy = {
	name: "AbstractCleaner",
	async extract(paper: Paper): Promise<Paper> {
		if (paper.abstract) {
			return {
				...paper,
				abstract: paper.abstract
					.replace(/<[^>]*>/g, "") // Strip HTML/XML tags
					.replace(/\s{2,}/g, " ") // Collapse whitespace
					.trim(),
			};
		}
		return paper;
	},
};

/** Normalises DOI format: strips URL prefixes, lowercases, validates pattern */
export const DOIValidator: ExtractionStrategy = {
	name: "DOIValidator",
	async extract(paper: Paper): Promise<Paper> {
		if (!paper.doi) {
			return paper;
		}

		let doi = paper.doi
			.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
			.trim();

		// DOI pattern: 10.XXXX/anything
		const doiPattern = /^10\.\d{4,}(\.\d+)*\/.+$/;
		if (!doiPattern.test(doi)) {
			// Invalid DOI — clear it to avoid downstream issues
			return { ...paper, doi: undefined };
		}

		return { ...paper, doi };
	},
};

/** Title-cases author names and deduplicates */
export const AuthorNormalizer: ExtractionStrategy = {
	name: "AuthorNormalizer",
	async extract(paper: Paper): Promise<Paper> {
		if (!paper.authors || paper.authors.length === 0) {
			return paper;
		}

		const titleCase = (name: string): string =>
			name
				.split(/\s+/)
				.map(
					(word) =>
						word.charAt(0).toUpperCase() +
						word.slice(1).toLowerCase(),
				)
				.join(" ");

		const normalised = paper.authors
			.map((a) => titleCase(a.trim()))
			.filter((a) => a.length > 0);

		// Deduplicate (case-insensitive)
		const seen = new Set<string>();
		const unique = normalised.filter((a) => {
			const key = a.toLowerCase();
			if (seen.has(key)) {
				return false;
			}
			seen.add(key);
			return true;
		});

		return { ...paper, authors: unique };
	},
};

/** Factory: creates a fully-configured MetadataExtractor */
export function createExtractor(): MetadataExtractor {
	const extractor = new MetadataExtractor();
	extractor.register(BasicFormatter);
	extractor.register(AbstractCleaner);
	extractor.register(DOIValidator);
	extractor.register(AuthorNormalizer);
	return extractor;
}
