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
		return enriched;
	}
}

// Example strategy: Basic formatter
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

// Example strategy: Abstract cleaner (remove HTML/XML tags)
export const AbstractCleaner: ExtractionStrategy = {
	name: "AbstractCleaner",
	async extract(paper: Paper): Promise<Paper> {
		if (paper.abstract) {
			return {
				...paper,
				abstract: paper.abstract.replace(
					/<[^>]*>/g,
					"",
				),
			};
		}
		return paper;
	},
};
