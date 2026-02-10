# Research Link

**Research Link** brings academic research directly into your VS Code workflow. Search, preview, manage, and cite papers from CrossRef and Semantic Scholar without leaving your editor.

![Research Link Screenshot](media/screenshot.png)

## Features

- **Integrated Search**: Query millions of academic papers via CrossRef and Semantic Scholar.
- **Personal Library**: Save papers to a local JSON-based library for quick access.
- **Reader View**: Read abstracts and metadata in a dedicated, distraction-free panel.
- **Citation Generator**: Copy citations in APA, MLA, Harvard, or Chicago formats.
- **AI-Ready Workflow**: Export structured markdown files (`docs/*.md`) containing paper metadata and abstracts, optimized for RAG (Retrieval-Augmented Generation) and LLM context.
- **Visual Indicators**: Badges for Open Access status and Publication Type (Journal, Conference, Pre-print).

## Usage

1. **Open Sidebar**: Click the **Research Link** icon in the Activity Bar.
2. **Search**: Enter a query (e.g., "Transformers", "DOI:10.1038/s41586-020-2649-2") in the search bar.
3. **Save**: Click "Save to Library" on any result to add it to your personal collection.
4. **Read & Cite**:
      - Click "Read" on a saved paper to open the details panel.
      - Use the **Reference** tab to generate and copy citations.
      - Click **Generate AI Reference** to create a markdown file for your AI contexts.

## Configuration

Research Link works out of the box. No API keys are required for basic usage.

## AI Integration

Research Link is designed to work alongside AI coding assistants. By generating structured markdown files of your research, you can easily provide context to your LLM:

1. Open a paper in Research Link.
2. Click **Generate AI Reference**.
3. A file is created in `docs/<DOI_or_ID>.md`.
4. Reference this file in your AI chat (e.g., `@docs/10.1038_s41586-020-2649-2.md`) to ask questions about the paper.

## Extension Settings

This extension contributes the following settings:

- `research-link.libraryPath`: (Optional) Custom path for the library JSON file.

## Known Issues

- PDF viewing is currently handled via external browser links.
- Rate limits apply to Semantic Scholar API requests.

## Release Notes

### 0.0.1

- Initial release.
- Search CrossRef & Semantic Scholar.
- Local Library management.
- Markdown export for AI context.
- Dark/Light mode support.

---

**Enjoying Research Link?**  
Please leave a review on the Marketplace!
