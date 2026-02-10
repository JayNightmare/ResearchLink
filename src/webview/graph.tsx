import "../../media/main.css";
import * as React from "react";
import { createRoot } from "react-dom/client";
import GraphView from "./GraphView";

const container = document.getElementById("root");
if (container) {
	const root = createRoot(container);
	root.render(<GraphView />);
}
