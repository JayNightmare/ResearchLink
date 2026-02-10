# Research Link - Development Memory

## Project Overview

**Research Link** is a VS Code extension that integrates academic research into the developer's workflow. It enables searching, previewing, and managing academic papers directly within the IDE, leveraging CrossRef and Semantic Scholar APIs.

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

### Key Workflows

- **Search**: Query -> Semantic Scholar/CrossRef API -> Aggregated Results -> Webview Display.
- **Save**: Webview `savePaper` message -> `LibraryStore.addPaper` -> Update Sidebar.
- **Read**: Sidebar "Read" button -> `openPaper` message -> Extension creates `WebviewPanel` -> Inject CSS & React App.

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
- [x] **Refactoring**:
     - Renamed project to "Research Link".
     - Unified card styling across Search and Library views.

### Usage Instructions

1. **Build**: Run `npm run compile`.
2. **Debug**: Press `F5` to launch Extension Host.
3. **Search**: Open "Research Link" sidebar, type query (e.g., "Transformers").
4. **Save**: Click "Save to Library".
5. **Read**: Go to "Library" tab, click "Read" on a paper.
6. **AI Export**: In the reading view, click "Generate AI Reference" to create a local markdown file.

## Known Issues (Resolved)

- **Contrast**: Text was hard to read in some themes. Fixed by mapping CSS variables to specific VS Code theme tokens (`descriptionForeground`, etc.).
- **Missing Metadata**: Abstract/Type was missing. Fixed by updating `SemanticScholarClient`.

## Next Steps

- **Metadata Extraction**: Clean/enrich data before saving.
- **PDF Viewing**: Investigate embedding a PDF viewer (e.g., PDF.js).
- **Graph View**: Visualize connections between saved papers.
