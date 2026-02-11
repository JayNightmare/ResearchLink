export interface PdfAnnotation {
	id: string;
	page: number;
	rects: { x: number; y: number; w: number; h: number }[];
	color: string;
	note?: string;
	text?: string; // The selected/highlighted text
	createdAt: number;
}

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
	pdfUrl?: string;
	references?: string[]; // Semantic Scholar paper IDs for graph edges
	enrichedAt?: number;
	annotations?: PdfAnnotation[];
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
