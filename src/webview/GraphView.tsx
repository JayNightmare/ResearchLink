import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Paper } from "../types";

declare global {
	interface Window {
		acquireVsCodeApi: () => any;
	}
}

const vscode = window.acquireVsCodeApi ? window.acquireVsCodeApi() : null;

interface GraphNode {
	id: string;
	title: string;
	x: number;
	y: number;
	vx: number;
	vy: number;
	paper: Paper;
}

interface GraphEdge {
	source: string;
	target: string;
}

interface TooltipState {
	visible: boolean;
	x: number;
	y: number;
	text: string;
}

const NODE_RADIUS = 8;
const COLORS = [
	"#6366f1",
	"#8b5cf6",
	"#ec4899",
	"#f43f5e",
	"#f59e0b",
	"#10b981",
	"#06b6d4",
	"#3b82f6",
];

const GraphView: React.FC = () => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [nodes, setNodes] = useState<GraphNode[]>([]);
	const [edges, setEdges] = useState<GraphEdge[]>([]);
	const [loading, setLoading] = useState(true);
	const [tooltip, setTooltip] = useState<TooltipState>({
		visible: false,
		x: 0,
		y: 0,
		text: "",
	});
	const [zoom, setZoom] = useState(1);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const dragRef = useRef<{
		nodeId: string | null;
		panning: boolean;
		startX: number;
		startY: number;
	}>({
		nodeId: null,
		panning: false,
		startX: 0,
		startY: 0,
	});
	const animRef = useRef<number>(0);

	// Listen for graph data from extension
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			if (event.data.type === "graphData") {
				const papers: Paper[] = event.data.papers;
				const edgeData: GraphEdge[] = event.data.edges;

				// Initialize nodes with random positions
				const width = window.innerWidth;
				const height = window.innerHeight;
				const graphNodes: GraphNode[] = papers.map(
					(p, i) => ({
						id: p.id,
						title:
							p.title.length > 40
								? p.title.substring(
										0,
										40,
									) +
									"..."
								: p.title,
						x:
							width / 2 +
							(Math.random() - 0.5) *
								300,
						y:
							height / 2 +
							(Math.random() - 0.5) *
								300,
						vx: 0,
						vy: 0,
						paper: p,
					}),
				);

				setNodes(graphNodes);
				setEdges(edgeData);
				setLoading(false);
			}
		};

		window.addEventListener("message", handleMessage);
		if (vscode) {
			vscode.postMessage({ type: "ready" });
		}
		return () =>
			window.removeEventListener("message", handleMessage);
	}, []);

	// Force simulation
	const simulate = useCallback(() => {
		setNodes((prevNodes) => {
			const next = prevNodes.map((n) => ({ ...n }));
			const center = {
				x: window.innerWidth / 2,
				y: window.innerHeight / 2,
			};

			// Repulsion between all nodes
			for (let i = 0; i < next.length; i++) {
				for (let j = i + 1; j < next.length; j++) {
					const dx = next[j].x - next[i].x;
					const dy = next[j].y - next[i].y;
					const dist = Math.sqrt(
						dx * dx + dy * dy,
					);
					if (dist < 1) continue;
					const force = 2000 / (dist * dist);
					const fx = (dx / dist) * force;
					const fy = (dy / dist) * force;
					next[i].vx -= fx;
					next[i].vy -= fy;
					next[j].vx += fx;
					next[j].vy += fy;
				}
			}

			// Attraction along edges
			for (const edge of edges) {
				const source = next.find(
					(n) => n.id === edge.source,
				);
				const target = next.find(
					(n) => n.id === edge.target,
				);
				if (!source || !target) continue;

				const dx = target.x - source.x;
				const dy = target.y - source.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < 1) continue;

				const force = (dist - 120) * 0.01;
				const fx = (dx / dist) * force;
				const fy = (dy / dist) * force;
				source.vx += fx;
				source.vy += fy;
				target.vx -= fx;
				target.vy -= fy;
			}

			// Center gravity
			for (const node of next) {
				node.vx += (center.x - node.x) * 0.002;
				node.vy += (center.y - node.y) * 0.002;
			}

			// Apply velocities with damping
			for (const node of next) {
				if (dragRef.current.nodeId === node.id)
					continue;
				node.vx *= 0.85;
				node.vy *= 0.85;
				node.x += node.vx;
				node.y += node.vy;
			}

			return next;
		});
	}, [edges]);

	// Animation loop
	useEffect(() => {
		if (nodes.length === 0) return;

		const tick = () => {
			simulate();
			animRef.current = requestAnimationFrame(tick);
		};
		animRef.current = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(animRef.current);
	}, [nodes.length > 0, simulate]);

	// Draw on canvas
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || nodes.length === 0) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.save();
		ctx.translate(pan.x, pan.y);
		ctx.scale(zoom, zoom);

		// Draw edges
		ctx.strokeStyle = "rgba(128, 128, 128, 0.3)";
		ctx.lineWidth = 1.5;
		for (const edge of edges) {
			const source = nodes.find((n) => n.id === edge.source);
			const target = nodes.find((n) => n.id === edge.target);
			if (!source || !target) continue;
			ctx.beginPath();
			ctx.moveTo(source.x, source.y);
			ctx.lineTo(target.x, target.y);
			ctx.stroke();
		}

		// Draw nodes
		for (let i = 0; i < nodes.length; i++) {
			const node = nodes[i];
			const color = COLORS[i % COLORS.length];

			// Glow
			ctx.beginPath();
			ctx.arc(
				node.x,
				node.y,
				NODE_RADIUS + 4,
				0,
				Math.PI * 2,
			);
			ctx.fillStyle = color + "30";
			ctx.fill();

			// Node circle
			ctx.beginPath();
			ctx.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2);
			ctx.fillStyle = color;
			ctx.fill();
			ctx.strokeStyle = "#fff";
			ctx.lineWidth = 2;
			ctx.stroke();

			// Label
			ctx.fillStyle =
				getComputedStyle(
					document.documentElement,
				).getPropertyValue("--foreground") || "#ccc";
			ctx.font = "11px sans-serif";
			ctx.textAlign = "center";
			ctx.fillText(
				node.title,
				node.x,
				node.y + NODE_RADIUS + 15,
			);
		}

		ctx.restore();
	});

	// Screen to world coordinates
	const screenToWorld = (sx: number, sy: number) => ({
		x: (sx - pan.x) / zoom,
		y: (sy - pan.y) / zoom,
	});

	// Find node at position
	const findNodeAt = (sx: number, sy: number) => {
		const { x, y } = screenToWorld(sx, sy);
		return nodes.find((n) => {
			const dx = n.x - x;
			const dy = n.y - y;
			return Math.sqrt(dx * dx + dy * dy) < NODE_RADIUS + 4;
		});
	};

	const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return;
		const sx = e.clientX - rect.left;
		const sy = e.clientY - rect.top;
		const node = findNodeAt(sx, sy);

		if (node) {
			dragRef.current = {
				nodeId: node.id,
				panning: false,
				startX: sx,
				startY: sy,
			};
		} else {
			dragRef.current = {
				nodeId: null,
				panning: true,
				startX: e.clientX - pan.x,
				startY: e.clientY - pan.y,
			};
		}
	};

	const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return;
		const sx = e.clientX - rect.left;
		const sy = e.clientY - rect.top;

		if (dragRef.current.nodeId) {
			const { x, y } = screenToWorld(sx, sy);
			setNodes((prev) =>
				prev.map((n) =>
					n.id === dragRef.current.nodeId
						? {
								...n,
								x,
								y,
								vx: 0,
								vy: 0,
							}
						: n,
				),
			);
			return;
		}

		if (dragRef.current.panning) {
			setPan({
				x: e.clientX - dragRef.current.startX,
				y: e.clientY - dragRef.current.startY,
			});
			return;
		}

		// Tooltip
		const node = findNodeAt(sx, sy);
		if (node) {
			setTooltip({
				visible: true,
				x: e.clientX + 12,
				y: e.clientY - 8,
				text: node.paper.title,
			});
		} else {
			setTooltip((prev) =>
				prev.visible
					? { ...prev, visible: false }
					: prev,
			);
		}
	};

	const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return;

		// Check if it was a click (not drag)
		if (
			dragRef.current.nodeId &&
			Math.abs(
				e.clientX - rect.left - dragRef.current.startX,
			) < 3 &&
			Math.abs(
				e.clientY - rect.top - dragRef.current.startY,
			) < 3
		) {
			const node = nodes.find(
				(n) => n.id === dragRef.current.nodeId,
			);
			if (node && vscode) {
				vscode.postMessage({
					type: "openPaper",
					paper: node.paper,
				});
			}
		}

		dragRef.current = {
			nodeId: null,
			panning: false,
			startX: 0,
			startY: 0,
		};
	};

	const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
		e.preventDefault();
		const delta = e.deltaY > 0 ? 0.9 : 1.1;
		setZoom((prev) => Math.min(Math.max(prev * delta, 0.2), 5));
	};

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center h-screen text-center">
				<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
				<p className="text-muted-foreground">
					Building research graph...
				</p>
			</div>
		);
	}

	if (nodes.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-screen text-center p-8">
				<div className="text-5xl mb-4">🕸️</div>
				<p className="font-semibold text-lg text-foreground">
					No papers in library
				</p>
				<p className="text-sm text-muted-foreground mt-2 max-w-md">
					Save papers from the search tab to
					visualise connections between them.
				</p>
			</div>
		);
	}

	return (
		<div className="relative h-screen w-screen overflow-hidden bg-background">
			{/* Controls */}
			<div className="absolute top-4 left-4 z-10 flex gap-2 bg-card border border-border rounded-lg px-3 py-2 shadow-md">
				<span className="text-xs text-muted-foreground font-medium">
					{nodes.length} papers • {edges.length}{" "}
					connections
				</span>
				<span className="text-xs text-muted-foreground">
					|
				</span>
				<span className="text-xs text-muted-foreground">
					{Math.round(zoom * 100)}%
				</span>
			</div>

			{/* Legend */}
			<div className="absolute bottom-4 left-4 z-10 bg-card border border-border rounded-lg px-3 py-2 shadow-md">
				<p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">
					Controls
				</p>
				<p className="text-xs text-muted-foreground">
					Drag: move node • Scroll: zoom • Click:
					open paper
				</p>
			</div>

			{/* Tooltip */}
			{tooltip.visible && (
				<div
					className="absolute z-20 px-3 py-1.5 bg-popover text-popover-foreground text-xs rounded-md shadow-lg border border-border max-w-xs pointer-events-none"
					style={{
						left: tooltip.x,
						top: tooltip.y,
					}}
				>
					{tooltip.text}
				</div>
			)}

			<canvas
				ref={canvasRef}
				className="block cursor-grab active:cursor-grabbing"
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onWheel={handleWheel}
			/>
		</div>
	);
};

export default GraphView;
