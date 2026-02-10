# ResearchLink Extension - Development Memory

## Project Overview

ResearchLink is a VS Code extension that integrates academic research into the developer's workflow. It enables searching, previewing, and managing academic papers directly within the IDE, leveraging CrossRef and Semantic Scholar APIs.

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
     - Use `postcss` plugin in `esbuild` to process styles.

### Component Structure

1. **Sidebar (Research Library)**:
      - Entry: `src/webview/index.tsx`
      - Provider: `ResearchLibraryProvider.ts`
      - Helper: `LibraryStore.ts` (Handles JSON persistence).
2. **Editor Panel (Paper Details)**:
      - Entry: `src/webview/panel.tsx`
      - Command: `research-gate.openPaper`
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
     - Citation generator (APA, MLA, Harvard).
     - **AI Reference**: Exports structured markdown to `docs/` for RAG/LLM usage.
- [x] **Styling System**:
     - Integrated Tailwind CSS v4.
     - Solved build issues by using `@tailwindcss/postcss` plugin.
     - Configured correct CSS injection into Webviews (`<link href="...">`).
- [x] **Refactoring**:
     - Cleaned up `esbuild.js` to handle multiple entry points and CSS efficiently.
     - Centralized CSS in `media/main.css`.

### Usage Instructions

1. **Build**: Run `npm run compile`.
2. **Debug**: Press `F5` to launch Extension Host.
3. **Search**: Open "ResearchLink" sidebar, type query (e.g., "Transformers").
4. **Save**: Click "Save to Library".
5. **Read**: Go to "Library" tab, click "Read" on a paper.
6. **AI Export**: In the reading view, click "Generate AI Reference" to create a local markdown file.

## Known Issues (Resolved)

- **CSS Injection**: Initially, styles were not applying because the `<link>` tag was missing in the HTML template. Fixed by properly resolving `styleUri` in `extension.ts` and `ResearchLibraryProvider.ts`.
- **Tailwind v4 Build**: `esbuild-style-plugin` had issues without the dedicated `@tailwindcss/postcss` package. Fixed by installing the package and updating `esbuild.js` plugins.

## Next Steps

- **Metadata Extraction**: Integrate the `MetadataExtractor` module (currently scaffolding) to clean/enrich data before saving.
- **PDF Viewing**: Investigate embedding a PDF viewer (e.g., PDF.js) for papers with open-access URLs.
- **Graph View**: Visualize connections between saved papers (citations/references).
