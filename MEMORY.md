# Research Link - Development Memory

## Project Overview

**Research Link** is a VS Code extension that integrates academic research into the developer's workflow. It enables searching, previewing, and managing academic papers directly within the IDE, leveraging CrossRef and Semantic Scholar APIs.

## AI Role

The AI operates as a **Lead Software Engineer** in a solo-dev partnership, utilizing specialized modes to maintain high architectural standards and academic rigor.

### 1. Lead Software Engineer (Core Persona)

Acts as the primary technical partner to the Stakeholder.

- **Mission**: Translate high-level prompts into production-ready technical specifications and maintainable code.
- **Approach**: Adopts a **skeptical, forward-thinking view**. Proactively identifies API limitations and questions "feature creep" to ensure a lean, scalable product.
- **Standards**: Clean, type-safe TypeScript/React code with minimal inline comments and comprehensive top-level file summaries.
- **Remember**: When thinking about or when you complete a task, always update the `MEMORY.md` file to reflect the changes. When you are done with a task, always update the `MEMORY.md` file to reflect the changes.
- **Maintain**: When finished with a new feature, always add a summary of the change to the `CHANGELOG.md` file.

### 2. Research Curator (Specialist Mode)

Focuses on the academic integrity of the data handled by the extension.

- **Mission**: Manage bibliometrics, DOI verification, and citation accuracy.
- **Responsibility**: Ensures metadata matches source records (CrossRef/Semantic Scholar) and manages exports for **LaTeX/BibTeX** compatibility.
- **Logic**: Analytical and precise. Prioritizes finding open-access versions (Unpaywall/ArXiv) over paywalled sources.

### 3. Functional Modes

To maintain project velocity, the AI shifts between the following operational modes:

- **Architect**: Designs database schemas, API communication layers, and system hierarchies.
- **Code**: Implements features, handles UI/UX via Tailwind v4, and manages VS Code API integrations.
- **Debug**: Performs root-cause analysis on extension host errors or API failures.
- **Orchestrator**: Summarizes project state and manages the `MEMORY.md` to ensure context remains sharp across sessions.

## Architecture

### Tech Stack

- **Core**: VS Code Extension API.
- **UI**: React (Webview) with **Tailwind CSS v4**.
- **Build System**: `esbuild` for bundling the extension and webviews.
- **Data Storage**: Local JSON file in `globalStorageUri` (simulating a lightweight database).
- **Styling**:
     - Uses `media/main.css` as the source of truth.
     - Includes `@import "tailwindcss";` for utility classes.
     - Integrated with VS Code theme variables (`var(--vscode-...)`) for native look and feel.
     - **Semantic Colors**: Mapped to VS Code tokens (e.g., `textBlockQuote-background` for muted backgrounds) to ensure high contrast in all themes.

### Component Structure

1. **Sidebar (Research Library)**:
      - Entry: `src/webview/index.tsx`
      - Provider: `ResearchLibraryProvider.ts`
      - Helper: `LibraryStore.ts` (Handles JSON persistence).
2. **Editor Panel (Paper Details)**:
      - Entry: `src/webview/panel.tsx`
      - Command: `research-link.openPaper`
      - Features: Abstract view, citation generation, AI reference creation (markdown export).
3. **PDF Viewer Panel**:
      - Entry: `src/webview/pdf.tsx`
      - Command: `research-link.openPdf`
      - Features: Canvas rendering via pdfjs-dist, page navigation, zoom controls.
4. **Graph View Panel**:
      - Entry: `src/webview/graph.tsx`
      - Command: `research-link.openGraph`
      - Features: Force-directed canvas layout, node drag, pan/zoom, click-to-open.

### Key Workflows

- **Search**: Query → S2 + CrossRef APIs in parallel → Smart deduplication (merge by DOI/title, prefer richer metadata) → Webview Display.
- **Save**: Webview `savePaper` message → `MetadataExtractor.enrich()` → `LibraryStore.addPaper` → Update Sidebar.
- **Read**: Sidebar "Read" button → `openPaper` message → Extension creates `WebviewPanel` → Inject CSS & React App.
- **PDF**: "Read PDF" → Extension host `fetch(url)` → Validate `%PDF` magic bytes → Base64 encode → Post to webview → pdfjs renders from `Uint8Array`.
- **Graph**: "🕸️" button → Fresh `LibraryStore` read → Shared-author edges (instant) → Citation edges (async S2 API) → Canvas render.

## Progress Tracking

### Completed Features

- [x] **Project Setup**: TypeScript, React, Esbuild configuration.
- [x] **API Integration**: Clients for CrossRef and Semantic Scholar.
- [x] **Library Sidebar**:
     - Search functionality.
     - Saving/Removing papers.
     - Persistent storage (JSON).
- [x] **Paper Details View**:
     - Dedicated editor tab for reading.
     - Abstract and metadata display.
     - Citation generator (APA, MLA, Harvard, Chicago).
     - **AI Reference**: Exports structured markdown to `docs/` for RAG/LLM usage.
- [x] **Styling System**:
     - Integrated Tailwind CSS v4.
     - Configured correct CSS injection into Webviews.
     - **High Contrast**: Implemented semantic color mappings for badges and text.
- [x] **Metadata**:
     - Added Publication Type and Open Access status.
     - In-text citation generation.
- [x] **Metadata Extraction**:
     - `MetadataExtractor` with strategy pattern.
     - Strategies: `BasicFormatter`, `AbstractCleaner`, `DOIValidator`, `AuthorNormalizer`.
     - Wired into save flow — papers are enriched before persistence.
- [x] **PDF Viewing**:
     - Embedded PDF viewer using `pdfjs-dist` canvas rendering.
     - Page navigation (prev/next), zoom controls.
     - Extension host fetches PDF binary, sends base64 to webview (VS Code webviews are sandboxed).
     - Bundled `pdf.worker.min.mjs` via esbuild copy step, injected as `window.__PDFJS_WORKER_SRC__`.
     - Validates `%PDF` magic bytes; auto-rewrites ArXiv `/abs/` → `/pdf/` URLs. Clear paywall error messages.
- [x] **Graph View**:
     - Custom canvas force-directed layout (zero external deps).
     - Nodes = saved papers, edges = citation refs + shared authors.
     - Drag nodes, pan/zoom, click to open paper, hover tooltip.
     - `SemanticScholarClient.getReferences()` fetches citation links.
     - Fresh `LibraryStore` on each invocation (avoids stale cache). Shared-author edges sent instantly, citation edges async.
     - **Second-degree references**: Fetches refs-of-refs (capped at 20 intermediates) to find indirect connections between saved papers. Second-degree edges rendered as dashed/lighter lines.
- [x] **Search Deduplication**:
     - S2 + CrossRef results merged by DOI/title; missing abstracts, DOIs, and PDF URLs filled from either source.
     - S2 now requests `externalIds` field for DOI matching.
- [x] **Enhanced Filtering**:
     - Publication type filter dropdown (derived from saved papers).
     - Author name filter input.
     - "Most Cited" sort option alongside existing newest/oldest/year/title sorts.
- [x] **PDF Annotation**:
     - Text layer overlay on PDF canvas for text selection.
     - Highlight creation with 5 color choices (yellow, green, blue, pink, orange).
     - Annotation notes sidebar panel with per-page highlight list, inline note editing.
     - Keyboard shortcut `⌘H` for quick highlighting.
     - `PdfAnnotation` type in `types.ts`; `annotations` field on `Paper`.
     - Annotations persisted to `LibraryStore` via `saveAnnotations` message handler.

### Usage Instructions

1. **Build**: Run `npm run compile`.
2. **Debug**: Press `F5` to launch Extension Host.
3. **Search**: Open "Research Link" sidebar, type query (e.g., "Transformers").
4. **Save**: Click "Save to Library".
5. **Read**: Go to "Library" tab, click "Read" on a paper.
6. **AI Export**: In the reading view, click "Generate AI Reference" to create a local markdown file.
7. **View PDF**: Open an Open Access paper detail → click "Read PDF 📄" to view in-editor.
8. **Graph View**: Click the 🕸️ button in the sidebar to visualise paper connections.

## Known Issues (Resolved)

- **Contrast**: Text was hard to read in some themes. Fixed by mapping CSS variables to specific VS Code theme tokens (`descriptionForeground`, etc.).
- **Missing Metadata**: Abstract/Type was missing. Fixed by updating `SemanticScholarClient`.
- **PDF "Failed to fetch"**: VS Code webviews are network-sandboxed. Fixed by moving PDF fetch to extension host.
- **PDF "Invalid PDF structure"**: Some URLs return HTML landing pages, not PDFs. Fixed with `%PDF` magic byte validation.
- **PDF worker error**: `workerSrc=""` is falsy in pdfjs v4. Fixed by bundling worker file locally.
- **Graph View blank**: `LibraryStore` was cached at registration time. Fixed by instantiating fresh on each command.
- **Missing abstracts**: Many S2 results lacked abstracts that CrossRef had. Fixed by deduplicating search results and merging fields.

## Next Steps

- **BibTeX Export**: One-click export of saved papers to `.bib` format.
- **Collections/Folders**: Group papers into named collections for project-specific organization.
- **Annotation Search**: Search across all annotations/highlights from the library view.
