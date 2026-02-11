import { Paper } from "../types";

/**
 * Extract metadata from the first page of a PDF buffer.
 * Returns a partial Paper with whatever could be identified.
 */
export async function extractPdfMetadata(
	pdfBuffer: Buffer,
	fileName?: string,
): Promise<Partial<Paper>> {
	// Dynamic import — pdfjs-dist ships as ESM, extension host is CJS
	const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

	// Disable worker — running in Node.js extension host, not a browser
	pdfjsLib.GlobalWorkerOptions.workerSrc = "";

	const data = new Uint8Array(pdfBuffer);
	const pdf = await pdfjsLib.getDocument({
		data,
		useWorkerFetch: false,
		isEvalSupported: false,
		useSystemFonts: true,
	}).promise;
	const page = await pdf.getPage(1);
	const textContent = await page.getTextContent();

	const items = textContent.items as any[];
	if (items.length === 0) {
		return { title: fileName || "Untitled Paper", source: "user" };
	}

	// Collect text items with their font sizes
	const textBlocks: { str: string; fontSize: number; y: number }[] = [];
	for (const item of items) {
		if (!item.str?.trim()) continue;
		const fontSize = Math.abs(
			item.transform?.[3] || item.height || 12,
		);
		textBlocks.push({
			str: item.str.trim(),
			fontSize,
			y: item.transform?.[5] || 0,
		});
	}

	// Full text for regex searches
	const fullText = textBlocks.map((b) => b.str).join(" ");

	// 1. Title — largest font on page 1 (collect all items at max size)
	const maxFontSize = Math.max(...textBlocks.map((b) => b.fontSize));
	const titleParts = textBlocks
		.filter((b) => Math.abs(b.fontSize - maxFontSize) < 1)
		.map((b) => b.str);
	const title =
		titleParts.join(" ").trim() || fileName || "Untitled Paper";

	// 2. DOI — regex match anywhere on page 1
	const doiMatch = fullText.match(/\b(10\.\d{4,9}\/[^\s,;)}\]]+)/i);
	const doi = doiMatch ? doiMatch[1].replace(/[.)]+$/, "") : undefined;

	// 3. Abstract — text after "Abstract" heading
	let abstract: string | undefined;
	const abstractIdx = fullText.toLowerCase().indexOf("abstract");
	if (abstractIdx !== -1) {
		// Grab text after "Abstract" up to the next section (Introduction, Keywords, etc.)
		const afterAbstract = fullText
			.substring(abstractIdx + 8)
			.trim();
		const sectionMatch = afterAbstract.match(
			/\b(introduction|keywords|1\.\s|1\s+introduction|i\.\s)/i,
		);
		abstract = sectionMatch
			? afterAbstract.substring(0, sectionMatch.index).trim()
			: afterAbstract.substring(0, 1500).trim();

		// Clean up leading colons/dashes
		abstract = abstract.replace(/^[:\-—–\s]+/, "").trim();
		if (abstract.length < 20) abstract = undefined;
	}

	// 4. Authors — heuristic: text between title and abstract/DOI, smaller font
	let authors: string[] = [];
	const titleEndIdx = textBlocks.findIndex(
		(b) => Math.abs(b.fontSize - maxFontSize) >= 1,
	);
	if (titleEndIdx > 0) {
		const authorCandidates: string[] = [];
		for (
			let i = titleEndIdx;
			i < Math.min(titleEndIdx + 15, textBlocks.length);
			i++
		) {
			const block = textBlocks[i];
			const lower = block.str.toLowerCase();
			// Stop if we hit abstract, doi, or other sections
			if (
				lower.includes("abstract") ||
				lower.match(/^10\.\d/) ||
				lower.includes("introduction") ||
				lower.includes("keywords")
			) {
				break;
			}
			// Author lines tend to be comma/and separated names
			if (
				block.str.length > 2 &&
				block.fontSize < maxFontSize
			) {
				authorCandidates.push(block.str);
			}
		}
		const authorText = authorCandidates.join(" ");
		// Split by comma, "and", semicolons
		authors = authorText
			.split(/\s*(?:,\s*and\s*|,\s*&\s*|\band\b|,|;)\s*/i)
			.map((a) => a.trim())
			.filter(
				(a) =>
					a.length > 2 &&
					a.length < 60 &&
					// Filter out emails, numbers, affiliations
					!a.includes("@") &&
					!a.match(/^\d/) &&
					!a.match(
						/university|department|institute|school/i,
					),
			);
	}

	await pdf.destroy();

	return {
		title,
		authors: authors.length > 0 ? authors : [],
		abstract,
		doi,
		source: "user",
	};
}
