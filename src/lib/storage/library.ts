import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Paper, LibraryStore as ILibraryStore } from "../../types";

export class LibraryStore {
	private _storagePath: string;
	private _libraryFile: string;
	private _data: ILibraryStore;

	constructor(storagePath: string) {
		this._storagePath = storagePath;
		this._libraryFile = path.join(storagePath, "library.json");

		// Ensure storage directory exists
		if (!fs.existsSync(this._storagePath)) {
			fs.mkdirSync(this._storagePath, { recursive: true });
		}

		this._data = this._load();
	}

	private _load(): ILibraryStore {
		try {
			if (fs.existsSync(this._libraryFile)) {
				const content = fs.readFileSync(
					this._libraryFile,
					"utf8",
				);
				return JSON.parse(content);
			}
		} catch (error) {
			console.error("Failed to load library:", error);
		}
		return { papers: {}, lastUpdated: Date.now() };
	}

	private _save() {
		try {
			this._data.lastUpdated = Date.now();
			fs.writeFileSync(
				this._libraryFile,
				JSON.stringify(this._data, null, 2),
				"utf8",
			);
		} catch (error) {
			console.error("Failed to save library:", error);
			vscode.window.showErrorMessage(
				"Failed to save library data.",
			);
		}
	}

	public addPaper(paper: Paper): void {
		this._data.papers[paper.id] = paper;
		this._save();
	}

	public removePaper(id: string): void {
		if (this._data.papers[id]) {
			delete this._data.papers[id];
			this._save();
		}
	}

	public getPaper(id: string): Paper | undefined {
		return this._data.papers[id];
	}

	public getAllPapers(): Paper[] {
		return Object.values(this._data.papers);
	}
}
