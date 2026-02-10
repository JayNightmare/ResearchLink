import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";

// Use the worker URL injected by the extension host via an inline script.
// Falls back to empty string (which will error) if not set.
pdfjsLib.GlobalWorkerOptions.workerSrc =
	(window as any).__PDFJS_WORKER_SRC__ || "";

declare global {
	interface Window {
		acquireVsCodeApi: () => any;
	}
}

const vscode = window.acquireVsCodeApi ? window.acquireVsCodeApi() : null;

interface PdfState {
	currentPage: number;
	totalPages: number;
	scale: number;
	loading: boolean;
	error: string | null;
}

const PdfViewer: React.FC = () => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [state, setState] = useState<PdfState>({
		currentPage: 1,
		totalPages: 0,
		scale: 1.2,
		loading: true,
		error: null,
	});
	const pdfDocRef = useRef<any>(null);

	// Listen for messages from extension host
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data;
			if (message.type === "loadPdfData") {
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

	// Render current page
	const renderPage = useCallback(async () => {
		const pdf = pdfDocRef.current;
		const canvas = canvasRef.current;
		if (!pdf || !canvas) {
			return;
		}

		try {
			const page = await pdf.getPage(state.currentPage);
			const viewport = page.getViewport({
				scale: state.scale,
			});

			const context = canvas.getContext("2d");
			if (!context) {
				return;
			}

			canvas.height = viewport.height;
			canvas.width = viewport.width;

			await page.render({
				canvasContext: context,
				viewport: viewport,
			}).promise;
		} catch (err: any) {
			setState((prev) => ({
				...prev,
				error: `Failed to render page: ${err.message || err}`,
			}));
		}
	}, [state.currentPage, state.scale]);

	useEffect(() => {
		if (pdfDocRef.current && !state.loading) {
			renderPage();
		}
	}, [state.currentPage, state.scale, state.loading, renderPage]);

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

	return (
		<div className="flex flex-col h-screen bg-background">
			{/* Toolbar */}
			<div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
				<div className="flex items-center gap-2">
					<button
						onClick={() =>
							goToPage(
								state.currentPage -
									1,
							)
						}
						disabled={
							state.currentPage <= 1
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
						onClick={() => zoom("out")}
						disabled={state.scale <= 0.4}
						className="cursor-pointer px-2 py-1 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
					>
						−
					</button>
					<span className="text-xs text-muted-foreground min-w-[50px] text-center">
						{Math.round(state.scale * 100)}%
					</span>
					<button
						onClick={() => zoom("in")}
						disabled={state.scale >= 3.0}
						className="cursor-pointer px-2 py-1 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
					>
						+
					</button>
				</div>
			</div>

			{/* Canvas */}
			<div className="flex-1 overflow-auto flex justify-center p-4 bg-muted/30">
				<canvas
					ref={canvasRef}
					className="shadow-lg rounded max-w-full h-auto"
				/>
			</div>
		</div>
	);
};

export default PdfViewer;
