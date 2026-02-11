import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { PdfAnnotation } from "../types";

// Use the worker URL injected by the extension host via an inline script.
pdfjsLib.GlobalWorkerOptions.workerSrc =
	(window as any).__PDFJS_WORKER_SRC__ || "";

declare global {
	interface Window {
		acquireVsCodeApi: () => any;
	}
}

const vscode = window.acquireVsCodeApi ? window.acquireVsCodeApi() : null;

const HIGHLIGHT_COLORS = [
	{ name: "Yellow", value: "rgba(255, 235, 59, 0.35)" },
	{ name: "Green", value: "rgba(76, 175, 80, 0.35)" },
	{ name: "Blue", value: "rgba(33, 150, 243, 0.35)" },
	{ name: "Pink", value: "rgba(233, 30, 99, 0.35)" },
	{ name: "Orange", value: "rgba(255, 152, 0, 0.35)" },
];

interface PdfState {
	currentPage: number;
	totalPages: number;
	scale: number;
	loading: boolean;
	error: string | null;
}

const PdfViewer: React.FC = () => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const highlightCanvasRef = useRef<HTMLCanvasElement>(null);
	const textLayerRef = useRef<HTMLDivElement>(null);
	const [state, setState] = useState<PdfState>({
		currentPage: 1,
		totalPages: 0,
		scale: 1.2,
		loading: true,
		error: null,
	});
	const pdfDocRef = useRef<any>(null);
	const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
	const [highlightColor, setHighlightColor] = useState(
		HIGHLIGHT_COLORS[0].value,
	);
	const [showAnnotationPanel, setShowAnnotationPanel] = useState(false);
	const [showAllAnnotations, setShowAllAnnotations] = useState(false);
	const [editingNote, setEditingNote] = useState<string | null>(null);
	const [noteText, setNoteText] = useState("");
	const paperIdRef = useRef<string | null>(null);

	// Listen for messages from extension host
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data;
			if (message.type === "loadPdfData") {
				if (message.paperId) {
					paperIdRef.current = message.paperId;
				}
				if (message.annotations) {
					setAnnotations(message.annotations);
				}
				// Decode base64 → Uint8Array and load with pdfjs
				const raw = atob(message.data);
				const bytes = new Uint8Array(raw.length);
				for (let i = 0; i < raw.length; i++) {
					bytes[i] = raw.charCodeAt(i);
				}
				loadPdfFromData(bytes);
			} else if (message.type === "pdfError") {
				setState((prev) => ({
					...prev,
					loading: false,
					error: `Failed to load PDF: ${message.error}`,
				}));
			}
		};

		window.addEventListener("message", handleMessage);
		if (vscode) {
			vscode.postMessage({ type: "ready" });
		}
		return () =>
			window.removeEventListener("message", handleMessage);
	}, []);

	const loadPdfFromData = async (data: Uint8Array) => {
		try {
			const loadingTask = pdfjsLib.getDocument({ data });
			const pdf = await loadingTask.promise;

			pdfDocRef.current = pdf;
			setState((prev) => ({
				...prev,
				totalPages: pdf.numPages,
				currentPage: 1,
				loading: false,
			}));
		} catch (err: any) {
			setState((prev) => ({
				...prev,
				loading: false,
				error: `Failed to parse PDF: ${err.message || err}`,
			}));
		}
	};

	// Render current page (canvas + text layer)
	const renderPage = useCallback(async () => {
		const pdf = pdfDocRef.current;
		const canvas = canvasRef.current;
		const highlightCanvas = highlightCanvasRef.current;
		const textLayer = textLayerRef.current;
		if (!pdf || !canvas || !highlightCanvas || !textLayer) {
			return;
		}

		try {
			const page = await pdf.getPage(state.currentPage);
			const viewport = page.getViewport({
				scale: state.scale,
			});
			const context = canvas.getContext("2d");
			if (!context) return;

			canvas.height = viewport.height;
			canvas.width = viewport.width;
			highlightCanvas.height = viewport.height;
			highlightCanvas.width = viewport.width;

			await page.render({
				canvasContext: context,
				viewport: viewport,
			}).promise;

			// Render text layer for selection
			textLayer.innerHTML = "";
			textLayer.style.width = `${viewport.width}px`;
			textLayer.style.height = `${viewport.height}px`;

			const textContent = await page.getTextContent();
			const textItems = textContent.items as any[];

			for (const item of textItems) {
				if (!item.str || item.str.trim() === "")
					continue;

				const tx = pdfjsLib.Util.transform(
					viewport.transform,
					item.transform,
				);

				// tx = [scaleX, shearX, shearY, scaleY, translateX, translateY]
				// After viewport transform, scaleY (tx[3]) is negative (Y-flip)
				const fontHeight = Math.abs(tx[3]);
				const spanLeft = tx[4];
				const spanTop = tx[5] - fontHeight;

				const span = document.createElement("span");
				span.textContent = item.str;
				span.style.position = "absolute";
				span.style.left = "0";
				span.style.top = "0";
				span.style.fontSize = `${fontHeight}px`;
				span.style.fontFamily =
					item.fontName || "sans-serif";
				// Use transform for both positioning AND horizontal scaling
				// This avoids left/top coordinate issues entirely
				span.style.transform = `translate(${spanLeft}px, ${spanTop}px) scaleX(${tx[0] / fontHeight})`;
				span.style.transformOrigin = "left top";
				span.style.whiteSpace = "pre";
				span.style.color = "transparent";
				span.style.cursor = "text";
				span.style.lineHeight = "1";
				textLayer.appendChild(span);
			}

			// Render highlights for this page
			renderHighlights();
		} catch (err: any) {
			setState((prev) => ({
				...prev,
				error: `Failed to render page: ${err.message || err}`,
			}));
		}
	}, [state.currentPage, state.scale]);

	// Render highlight overlays on the highlight canvas
	const renderHighlights = useCallback(() => {
		const highlightCanvas = highlightCanvasRef.current;
		if (!highlightCanvas) return;

		const ctx = highlightCanvas.getContext("2d");
		if (!ctx) return;

		ctx.clearRect(
			0,
			0,
			highlightCanvas.width,
			highlightCanvas.height,
		);

		const pageAnnotations = annotations.filter(
			(a) => a.page === state.currentPage,
		);

		for (const ann of pageAnnotations) {
			ctx.fillStyle = ann.color;
			for (const rect of ann.rects) {
				ctx.fillRect(
					rect.x * state.scale,
					rect.y * state.scale,
					rect.w * state.scale,
					rect.h * state.scale,
				);
			}
			// Draw a small note indicator if there's a note
			if (ann.note) {
				const firstRect = ann.rects[0];
				if (firstRect) {
					ctx.fillStyle = "#f59e0b";
					ctx.beginPath();
					ctx.arc(
						(firstRect.x + firstRect.w) *
							state.scale,
						firstRect.y * state.scale,
						4,
						0,
						Math.PI * 2,
					);
					ctx.fill();
				}
			}
		}
	}, [annotations, state.currentPage, state.scale]);

	useEffect(() => {
		if (pdfDocRef.current && !state.loading) {
			renderPage();
		}
	}, [state.currentPage, state.scale, state.loading, renderPage]);

	useEffect(() => {
		renderHighlights();
	}, [annotations, renderHighlights]);

	const goToPage = (page: number) => {
		if (page >= 1 && page <= state.totalPages) {
			setState((prev) => ({ ...prev, currentPage: page }));
		}
	};

	const zoom = (direction: "in" | "out") => {
		setState((prev) => ({
			...prev,
			scale:
				direction === "in"
					? Math.min(prev.scale + 0.2, 3.0)
					: Math.max(prev.scale - 0.2, 0.4),
		}));
	};

	// Handle creating a highlight from text selection
	const handleHighlight = useCallback(() => {
		const selection = window.getSelection();
		if (
			!selection ||
			selection.rangeCount === 0 ||
			selection.isCollapsed
		) {
			return;
		}

		const range = selection.getRangeAt(0);
		const textLayer = textLayerRef.current;
		if (!textLayer || !textLayer.contains(range.startContainer)) {
			return;
		}

		const selectedText = selection.toString().trim();
		if (!selectedText) return;

		// Get the bounding rects relative to the text layer
		const clientRects = range.getClientRects();
		const layerRect = textLayer.getBoundingClientRect();

		const rects: { x: number; y: number; w: number; h: number }[] =
			[];
		for (let i = 0; i < clientRects.length; i++) {
			const cr = clientRects[i];
			rects.push({
				x: (cr.left - layerRect.left) / state.scale,
				y: (cr.top - layerRect.top) / state.scale,
				w: cr.width / state.scale,
				h: cr.height / state.scale,
			});
		}

		if (rects.length === 0) return;

		const newAnnotation: PdfAnnotation = {
			id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
			page: state.currentPage,
			rects,
			color: highlightColor,
			text: selectedText,
			createdAt: Date.now(),
		};

		const updated = [...annotations, newAnnotation];
		setAnnotations(updated);
		saveAnnotations(updated);

		selection.removeAllRanges();
	}, [annotations, highlightColor, state.currentPage, state.scale]);

	// Save annotations to extension host
	const saveAnnotations = (anns: PdfAnnotation[]) => {
		if (vscode && paperIdRef.current) {
			vscode.postMessage({
				type: "saveAnnotations",
				paperId: paperIdRef.current,
				annotations: anns,
			});
		}
	};

	// Delete an annotation
	const deleteAnnotation = (id: string) => {
		const updated = annotations.filter((a) => a.id !== id);
		setAnnotations(updated);
		saveAnnotations(updated);
		setEditingNote(null);
	};

	// Save a note on an annotation
	const saveNote = (id: string, note: string) => {
		const updated = annotations.map((a) =>
			a.id === id ? { ...a, note } : a,
		);
		setAnnotations(updated);
		saveAnnotations(updated);
		setEditingNote(null);
		setNoteText("");
	};

	// Keyboard shortcut for highlight
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "h") {
				e.preventDefault();
				handleHighlight();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () =>
			window.removeEventListener("keydown", handleKeyDown);
	}, [handleHighlight]);

	if (state.error) {
		return (
			<div className="flex flex-col items-center justify-center h-screen p-8 text-center">
				<div className="text-4xl mb-4">⚠️</div>
				<p className="text-destructive font-medium mb-2">
					Error Loading PDF
				</p>
				<p className="text-sm text-muted-foreground max-w-md">
					{state.error}
				</p>
			</div>
		);
	}

	if (state.loading) {
		return (
			<div className="flex flex-col items-center justify-center h-screen text-center">
				<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
				<p className="text-muted-foreground">
					Loading PDF...
				</p>
			</div>
		);
	}

	const currentPageAnnotations = annotations.filter(
		(a) => a.page === state.currentPage,
	);

	return (
		<div className="flex h-screen bg-background">
			{/* Main Content */}
			<div className="flex flex-col flex-1 min-w-0">
				{/* Toolbar */}
				<div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card flex-shrink-0">
					<div className="flex items-center gap-2">
						<button
							onClick={() =>
								goToPage(
									state.currentPage -
										1,
								)
							}
							disabled={
								state.currentPage <=
								1
							}
							className="cursor-pointer px-2 py-1 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
						>
							← Prev
						</button>
						<span className="text-sm text-foreground font-medium min-w-[80px] text-center">
							{state.currentPage} /{" "}
							{state.totalPages}
						</span>
						<button
							onClick={() =>
								goToPage(
									state.currentPage +
										1,
								)
							}
							disabled={
								state.currentPage >=
								state.totalPages
							}
							className="cursor-pointer px-2 py-1 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
						>
							Next →
						</button>
					</div>

					<div className="flex items-center gap-2">
						<button
							onClick={() =>
								zoom("out")
							}
							disabled={
								state.scale <=
								0.4
							}
							className="cursor-pointer px-2 py-1 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
						>
							−
						</button>
						<span className="text-xs text-muted-foreground min-w-[50px] text-center">
							{Math.round(
								state.scale *
									100,
							)}
							%
						</span>
						<button
							onClick={() =>
								zoom("in")
							}
							disabled={
								state.scale >=
								3.0
							}
							className="cursor-pointer px-2 py-1 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
						>
							+
						</button>

						<div className="w-px h-5 bg-border mx-1"></div>

						{/* Highlight color picker */}
						<div className="flex items-center gap-1">
							{HIGHLIGHT_COLORS.map(
								(c) => (
									<button
										key={
											c.name
										}
										title={
											c.name
										}
										onClick={() =>
											setHighlightColor(
												c.value,
											)
										}
										className={`cursor-pointer w-5 h-5 rounded-full border-2 transition-all ${
											highlightColor ===
											c.value
												? "border-foreground scale-110"
												: "border-transparent hover:border-muted-foreground"
										}`}
										style={{
											backgroundColor:
												c.value.replace(
													"0.35",
													"0.8",
												),
										}}
									/>
								),
							)}
						</div>

						<button
							onClick={
								handleHighlight
							}
							className="cursor-pointer px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 transition-colors font-medium"
							title="Highlight selection (⌘H)"
						>
							✏️ Highlight
						</button>

						<button
							onClick={() =>
								setShowAnnotationPanel(
									!showAnnotationPanel,
								)
							}
							className={`cursor-pointer px-2 py-1 text-sm rounded transition-colors ${
								showAnnotationPanel
									? "bg-primary text-primary-foreground"
									: "bg-secondary text-secondary-foreground hover:bg-secondary/80"
							}`}
							title="Toggle annotations panel"
						>
							📝{" "}
							{annotations.length >
								0 &&
								`(${annotations.length})`}
						</button>
					</div>
				</div>

				{/* PDF Canvas Area */}
				<div className="flex-1 overflow-auto p-4 bg-muted/30">
					<div className="relative inline-block">
						<canvas
							ref={canvasRef}
							className="shadow-lg rounded block"
						/>
						<canvas
							ref={highlightCanvasRef}
							className="absolute top-0 left-0 pointer-events-none"
						/>
						<div
							ref={textLayerRef}
							className="absolute top-0 left-0 overflow-hidden"
							style={{
								mixBlendMode:
									"multiply",
							}}
						/>
					</div>
				</div>
			</div>

			{/* Annotation Panel (Sidebar) */}
			{showAnnotationPanel &&
				(() => {
					const displayedAnnotations =
						showAllAnnotations
							? [...annotations].sort(
									(
										a,
										b,
									) =>
										a.page -
											b.page ||
										a.createdAt -
											b.createdAt,
								)
							: currentPageAnnotations;

					return (
						<div className="w-72 border-l border-border bg-card flex flex-col flex-shrink-0">
							<div className="p-3 border-b border-border space-y-2">
								<div className="flex items-center justify-between">
									<h3 className="text-sm font-semibold text-foreground">
										Annotations
									</h3>
									<span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
										{
											displayedAnnotations.length
										}
										{showAllAnnotations
											? " total"
											: ` / ${annotations.length}`}
									</span>
								</div>

								{/* Toggle: Current Page / All */}
								<div className="flex rounded-md border border-border overflow-hidden">
									<button
										onClick={() =>
											setShowAllAnnotations(
												false,
											)
										}
										className={`cursor-pointer flex-1 px-2 py-1 text-[10px] font-medium transition-colors ${
											!showAllAnnotations
												? "bg-primary text-primary-foreground"
												: "bg-transparent text-muted-foreground hover:text-foreground"
										}`}
									>
										This
										Page
									</button>
									<button
										onClick={() =>
											setShowAllAnnotations(
												true,
											)
										}
										className={`cursor-pointer flex-1 px-2 py-1 text-[10px] font-medium transition-colors ${
											showAllAnnotations
												? "bg-primary text-primary-foreground"
												: "bg-transparent text-muted-foreground hover:text-foreground"
										}`}
									>
										All
										Pages
									</button>
								</div>
							</div>

							<div className="flex-1 overflow-y-auto p-2 space-y-2">
								{displayedAnnotations.length ===
								0 ? (
									<div className="text-center py-8 text-muted-foreground text-xs">
										<p>
											No
											annotations
											{showAllAnnotations
												? ""
												: " on this page"}
											.
										</p>
										<p className="mt-1">
											Select
											text
											and
											click{" "}
											<span className="font-medium">
												✏️
												Highlight
											</span>{" "}
											or
											press{" "}
											<kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">
												⌘H
											</kbd>
										</p>
									</div>
								) : (
									displayedAnnotations.map(
										(
											ann,
										) => (
											<div
												key={
													ann.id
												}
												onClick={() => {
													if (
														ann.page !==
														state.currentPage
													) {
														goToPage(
															ann.page,
														);
													}
												}}
												className={`p-2.5 rounded-md border border-border bg-background text-xs group transition-colors ${
													ann.page !==
													state.currentPage
														? "cursor-pointer hover:border-primary/50"
														: ""
												}`}
											>
												{/* Color strip + page badge */}
												<div className="flex items-center gap-2 mb-2">
													<div
														className="h-1 rounded-full flex-1"
														style={{
															backgroundColor:
																ann.color.replace(
																	"0.35",
																	"0.7",
																),
														}}
													/>
													<span
														className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
															ann.page ===
															state.currentPage
																? "bg-primary/20 text-primary"
																: "bg-muted text-muted-foreground"
														}`}
													>
														p.
														{
															ann.page
														}
													</span>
												</div>

												{/* Highlighted text */}
												{ann.text && (
													<p className="text-foreground line-clamp-3 mb-2 italic">
														"
														{
															ann.text
														}

														"
													</p>
												)}

												{/* Note section */}
												{editingNote ===
												ann.id ? (
													<div className="space-y-1.5">
														<textarea
															autoFocus
															value={
																noteText
															}
															onChange={(
																e,
															) =>
																setNoteText(
																	e
																		.target
																		.value,
																)
															}
															placeholder="Add a note..."
															className="w-full px-2 py-1.5 text-xs bg-input border border-input rounded resize-none text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
															rows={
																3
															}
															onKeyDown={(
																e,
															) => {
																if (
																	e.key ===
																		"Enter" &&
																	(e.metaKey ||
																		e.ctrlKey)
																) {
																	saveNote(
																		ann.id,
																		noteText,
																	);
																} else if (
																	e.key ===
																	"Escape"
																) {
																	setEditingNote(
																		null,
																	);
																}
															}}
														/>
														<div className="flex gap-1">
															<button
																onClick={() =>
																	saveNote(
																		ann.id,
																		noteText,
																	)
																}
																className="cursor-pointer px-2 py-0.5 text-[10px] bg-primary text-primary-foreground rounded"
															>
																Save
															</button>
															<button
																onClick={() =>
																	setEditingNote(
																		null,
																	)
																}
																className="cursor-pointer px-2 py-0.5 text-[10px] bg-muted text-muted-foreground rounded"
															>
																Cancel
															</button>
														</div>
													</div>
												) : ann.note ? (
													<p
														className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
														onClick={() => {
															setEditingNote(
																ann.id,
															);
															setNoteText(
																ann.note ||
																	"",
															);
														}}
													>
														📝{" "}
														{
															ann.note
														}
													</p>
												) : null}

												{/* Actions */}
												<div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
													{!editingNote && (
														<button
															onClick={() => {
																setEditingNote(
																	ann.id,
																);
																setNoteText(
																	ann.note ||
																		"",
																);
															}}
															className="cursor-pointer px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded hover:bg-secondary hover:text-secondary-foreground transition-colors"
														>
															{ann.note
																? "Edit Note"
																: "+ Note"}
														</button>
													)}
													<button
														onClick={() =>
															deleteAnnotation(
																ann.id,
															)
														}
														className="cursor-pointer px-1.5 py-0.5 text-[10px] text-destructive hover:bg-destructive/10 rounded transition-colors ml-auto"
													>
														Delete
													</button>
												</div>
											</div>
										),
									)
								)}
							</div>
						</div>
					);
				})()}
		</div>
	);
};

export default PdfViewer;
