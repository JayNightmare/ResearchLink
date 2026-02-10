# Change Log

All notable changes to the "Research Link" extension will be documented in this file.

## [0.0.3] - 2026-02-10

### Fixed

- **PDF Viewer**: Resolved "Failed to fetch" — PDF binary is now fetched by the extension host (full network access) and sent to the webview as base64 data.
- **PDF Viewer**: Resolved "Invalid PDF structure" — added `%PDF` magic byte validation. URLs returning HTML landing pages now show a clear paywall/authentication error.
- **PDF Viewer**: Resolved "No workerSrc specified" — `pdf.worker.min.mjs` is now bundled locally (copied by esbuild build step) and injected via `window.__PDFJS_WORKER_SRC__`.
- **PDF Viewer**: ArXiv URLs (`/abs/`) are auto-rewritten to `/pdf/` for direct download.
- **Graph View**: Fixed blank graph — `LibraryStore` was stale (cached at command registration time). Now creates a fresh instance per invocation.
- **Graph View**: Data now sent immediately (shared-author edges), with citation edges enriched asynchronously via Semantic Scholar API.
- **Missing Abstracts**: S2 now requests `externalIds` field to get DOIs. Search results are deduplicated by DOI/title, filling missing abstracts, DOIs, and PDF URLs from CrossRef.

### Changed

- **CSP**: Simplified PDF webview CSP — removed `connect-src https:` (no longer needed since extension host fetches). Added `worker-src` for local worker.
- **Build**: `esbuild.js` now copies `pdf.worker.min.mjs` to `out/webview/` during build.
- **Search Merge**: Results from S2 and CrossRef are now smart-merged instead of simply concatenated.

## [0.0.2] - 2026-02-10

### Added

- **Metadata Extraction**: Papers are now cleaned and enriched on save via a strategy-based `MetadataExtractor` (DOI validation, author normalisation, abstract cleaning).
- **PDF Viewer**: Embedded in-editor PDF viewing via `pdfjs-dist` with canvas rendering, page navigation, and zoom controls.
- **Graph View**: Force-directed graph visualisation of saved papers. Edges based on Semantic Scholar citation references and shared authors. Features drag, pan/zoom, and click-to-open.
- **New Commands**: `research-link.openPdf`, `research-link.openGraph`.
- **New API Method**: `SemanticScholarClient.getReferences()` for fetching citation links.

### Changed

- **Paper Type**: Added `references` and `enrichedAt` fields.
- **tsconfig**: Added `skipLibCheck` to accommodate `pdfjs-dist` transitive dependency types.

## [0.0.1] - 2026-02-09

### Added

- **Search Integration**: Unified search across CrossRef and Semantic Scholar APIs.
- **Library Management**: Sidebar view to save, remove, and organize papers.
- **Paper Details View**: Dedicated panel for reading abstracts and metadata.
- **Citation Generator**: Support for APA, MLA, Harvard, and Chicago styles.
- **AI Workflow**: One-click generation of structured markdown files (`docs/*.md`) for LLM context.
- **Reference Toggles**: Switch between "Full Citation" and "In-Text" (e.g., `(Author, Year)`) formats.
- **Visuals**:
     - Publication Type badges (Journal, Conference, etc.).
     - Open Access status indicators.
     - Automated Dark/Light mode theming using VS Code variables.

### Changed

- **Project Structure**: Renamed from "Research Gate" to "Research Link".
- **Styling**: Migrated to Tailwind CSS v4 with semantic VS Code color mappings for high contrast.
