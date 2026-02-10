import "../../media/main.css";
import * as React from "react";
import { createRoot } from "react-dom/client";
import PaperCallback from "./PaperCallback";

const container = document.getElementById("root");
if (container) {
	const root = createRoot(container);
	root.render(<PaperCallback />);
}
