export interface Paper {
	id: string; // DOI or S2ID
	title: string;
	authors: string[];
	abstract?: string;
	doi?: string;
	citations?: number;
	url?: string;
	venue?: string;
	year?: number;
	localPath?: string; // Path to saved PDF/local copy
	notes?: string;
	tags?: string[];
	publicationType?: string;
	isOpenAccess?: boolean;
}

export interface SearchResult {
	papers: Paper[];
	total: number;
	source: "crossref" | "semanticscholar";
}

export interface LibraryStore {
	papers: { [id: string]: Paper };
	lastUpdated: number;
}
