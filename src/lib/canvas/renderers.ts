import type { Grid, Domain, Instance, Bump, PathNode, IRDropResult } from '../engine/types';
import { findBumpAt, findInstanceAt } from '../engine/grid';

export interface GridRenderOptions {
	padding: number;
	nodeRadius: number;
	bumpRadius: number;
	instanceSize: number;
	edgeWidth: number;
	showResistanceLabels: boolean;
	highlightedNode?: { row: number; col: number } | null;
	selectedSource?: Instance | null;
	selectedTarget?: Domain | null;
}

const DEFAULTS: GridRenderOptions = {
	padding: 48,
	nodeRadius: 4,
	bumpRadius: 10,
	instanceSize: 14,
	edgeWidth: 1.5,
	showResistanceLabels: false
};

/** Convert grid coordinates to canvas pixel coordinates */
export function gridToCanvas(
	row: number,
	col: number,
	canvasWidth: number,
	canvasHeight: number,
	grid: Grid,
	padding: number
): { x: number; y: number } {
	const drawW = canvasWidth - padding * 2;
	const drawH = canvasHeight - padding * 2;
	const cellW = drawW / (grid.config.cols - 1);
	const cellH = drawH / (grid.config.rows - 1);
	return {
		x: padding + col * cellW,
		y: padding + row * cellH
	};
}

/** Convert canvas pixel coordinates to nearest grid coordinates */
export function canvasToGrid(
	x: number,
	y: number,
	canvasWidth: number,
	canvasHeight: number,
	grid: Grid,
	padding: number
): { row: number; col: number } | null {
	const drawW = canvasWidth - padding * 2;
	const drawH = canvasHeight - padding * 2;
	const cellW = drawW / (grid.config.cols - 1);
	const cellH = drawH / (grid.config.rows - 1);

	const col = Math.round((x - padding) / cellW);
	const row = Math.round((y - padding) / cellH);

	if (row < 0 || row >= grid.config.rows || col < 0 || col >= grid.config.cols) return null;

	// Check if close enough to snap
	const snapX = padding + col * cellW;
	const snapY = padding + row * cellH;
	const dist = Math.sqrt((x - snapX) ** 2 + (y - snapY) ** 2);
	if (dist > cellW * 0.45) return null;

	return { row, col };
}

/** Render the full grid onto a canvas */
export function renderGrid(
	ctx: CanvasRenderingContext2D,
	grid: Grid,
	width: number,
	height: number,
	opts: Partial<GridRenderOptions> = {}
) {
	const o = { ...DEFAULTS, ...opts };
	const { rows, cols } = grid.config;

	ctx.clearRect(0, 0, width, height);

	// Background
	ctx.fillStyle = '#141722';
	ctx.fillRect(0, 0, width, height);

	// Draw edges
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const from = gridToCanvas(r, c, width, height, grid, o.padding);
			const res = grid.resistances[r][c];

			// Right edge
			if (res.right !== null && c < cols - 1) {
				const to = gridToCanvas(r, c + 1, width, height, grid, o.padding);
				drawEdge(ctx, from, to, res.right, o);
			}
			// Down edge
			if (res.down !== null && r < rows - 1) {
				const to = gridToCanvas(r + 1, c, width, height, grid, o.padding);
				drawEdge(ctx, from, to, res.down, o);
			}
		}
	}

	// Draw grid nodes
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			// Skip if bump or instance (drawn separately)
			if (findBumpAt(grid, r, c) || findInstanceAt(grid, r, c)) continue;

			const pos = gridToCanvas(r, c, width, height, grid, o.padding);
			const isHighlighted =
				o.highlightedNode && o.highlightedNode.row === r && o.highlightedNode.col === c;

			ctx.beginPath();
			ctx.arc(pos.x, pos.y, isHighlighted ? o.nodeRadius + 2 : o.nodeRadius, 0, Math.PI * 2);
			ctx.fillStyle = isHighlighted ? '#6b7294' : '#4a5280';
			ctx.fill();
		}
	}

	// Draw domain bumps
	for (const domain of grid.domains) {
		for (const bump of domain.bumps) {
			const pos = gridToCanvas(bump.row, bump.col, width, height, grid, o.padding);
			const isSelectedTarget = o.selectedTarget?.id === domain.id;

			// Glow for selected target domain
			if (isSelectedTarget) {
				ctx.beginPath();
				ctx.arc(pos.x, pos.y, o.bumpRadius + 6, 0, Math.PI * 2);
				ctx.fillStyle = domain.color + '30';
				ctx.fill();
			}

			ctx.beginPath();
			ctx.arc(pos.x, pos.y, o.bumpRadius, 0, Math.PI * 2);
			ctx.fillStyle = domain.color;
			ctx.fill();
			ctx.strokeStyle = '#ffffff40';
			ctx.lineWidth = 1.5;
			ctx.stroke();

			// Label
			ctx.fillStyle = '#fff';
			ctx.font = '600 9px Inter, sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText('B', pos.x, pos.y);
		}
	}

	// Draw instances
	for (const inst of grid.instances) {
		const pos = gridToCanvas(inst.row, inst.col, width, height, grid, o.padding);
		const isSource = o.selectedSource?.id === inst.id;
		const half = o.instanceSize / 2;

		// Glow for selected source
		if (isSource) {
			ctx.beginPath();
			ctx.rect(pos.x - half - 4, pos.y - half - 4, o.instanceSize + 8, o.instanceSize + 8);
			ctx.fillStyle = '#fbbf2430';
			ctx.fill();
		}

		ctx.beginPath();
		ctx.rect(pos.x - half, pos.y - half, o.instanceSize, o.instanceSize);
		ctx.fillStyle = isSource ? '#fbbf24' : '#22d3ee';
		ctx.fill();
		ctx.strokeStyle = '#ffffff30';
		ctx.lineWidth = 1;
		ctx.stroke();

		// Label
		ctx.fillStyle = '#000';
		ctx.font = '700 8px Inter, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		const idx = inst.id.split('-')[1];
		ctx.fillText(`I${idx}`, pos.x, pos.y);
	}
}

function drawEdge(
	ctx: CanvasRenderingContext2D,
	from: { x: number; y: number },
	to: { x: number; y: number },
	resistance: number,
	opts: GridRenderOptions
) {
	// Thicker edges = lower resistance (better connections)
	const maxR = 0.2;
	const minR = 0.05;
	const t = 1 - Math.min(1, Math.max(0, (resistance - minR) / (maxR - minR)));
	const lineWidth = 0.5 + t * 2.5;

	ctx.beginPath();
	ctx.moveTo(from.x, from.y);
	ctx.lineTo(to.x, to.y);
	ctx.strokeStyle = `rgba(61, 68, 96, ${0.4 + t * 0.6})`;
	ctx.lineWidth = lineWidth;
	ctx.stroke();

	if (opts.showResistanceLabels) {
		const mx = (from.x + to.x) / 2;
		const my = (from.y + to.y) / 2;
		ctx.fillStyle = '#6b7294';
		ctx.font = '10px JetBrains Mono, monospace';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(`${resistance.toFixed(2)}Ω`, mx, my - 8);
	}
}

/** Render a path with animated particle */
export function renderPath(
	ctx: CanvasRenderingContext2D,
	grid: Grid,
	path: PathNode[],
	width: number,
	height: number,
	padding: number,
	color: string,
	particleProgress?: number // 0-1 along the path
) {
	if (path.length < 2) return;

	// Draw path line
	ctx.beginPath();
	const start = gridToCanvas(path[0].row, path[0].col, width, height, grid, padding);
	ctx.moveTo(start.x, start.y);

	for (let i = 1; i < path.length; i++) {
		const pt = gridToCanvas(path[i].row, path[i].col, width, height, grid, padding);
		ctx.lineTo(pt.x, pt.y);
	}

	ctx.strokeStyle = color;
	ctx.lineWidth = 3;
	ctx.shadowColor = color;
	ctx.shadowBlur = 8;
	ctx.stroke();
	ctx.shadowBlur = 0;

	// Draw particle at progress position
	if (particleProgress !== undefined && particleProgress >= 0) {
		const totalSegments = path.length - 1;
		const exactSegment = particleProgress * totalSegments;
		const segIndex = Math.min(Math.floor(exactSegment), totalSegments - 1);
		const segProgress = exactSegment - segIndex;

		const p1 = gridToCanvas(path[segIndex].row, path[segIndex].col, width, height, grid, padding);
		const p2 = gridToCanvas(
			path[segIndex + 1].row,
			path[segIndex + 1].col,
			width,
			height,
			grid,
			padding
		);

		const px = p1.x + (p2.x - p1.x) * segProgress;
		const py = p1.y + (p2.y - p1.y) * segProgress;

		// Outer glow
		ctx.beginPath();
		ctx.arc(px, py, 10, 0, Math.PI * 2);
		ctx.fillStyle = color + '30';
		ctx.fill();

		// Inner dot
		ctx.beginPath();
		ctx.arc(px, py, 5, 0, Math.PI * 2);
		ctx.fillStyle = '#FFD700';
		ctx.fill();
		ctx.strokeStyle = color;
		ctx.lineWidth = 2;
		ctx.stroke();
	}
}

/** Render voltage heatmap overlay */
export function renderHeatmap(
	ctx: CanvasRenderingContext2D,
	grid: Grid,
	result: IRDropResult,
	width: number,
	height: number,
	padding: number
) {
	const { rows, cols } = grid.config;
	const vdd = grid.config.vdd;
	const drawW = width - padding * 2;
	const drawH = height - padding * 2;
	const cellW = drawW / (cols - 1);
	const cellH = drawH / (rows - 1);

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const v = result.voltageMap[r][c];
			const drop = vdd - v;
			const maxDrop = result.statistics.maxIRDrop || 0.001;
			const t = Math.min(1, drop / maxDrop); // 0 = no drop (green), 1 = max drop (red)

			const pos = gridToCanvas(r, c, width, height, grid, padding);

			// Draw a soft rectangle centered on the node
			const hw = cellW / 2 + 2;
			const hh = cellH / 2 + 2;

			ctx.fillStyle = heatColor(t);
			ctx.globalAlpha = 0.5;
			ctx.fillRect(pos.x - hw, pos.y - hh, hw * 2, hh * 2);
			ctx.globalAlpha = 1;
		}
	}
}

/** Render current flow particles on edges */
export function renderCurrentFlow(
	ctx: CanvasRenderingContext2D,
	grid: Grid,
	result: IRDropResult,
	width: number,
	height: number,
	padding: number,
	time: number
) {
	const { rows, cols } = grid.config;
	const maxCurrent = getMaxCurrent(result);
	if (maxCurrent === 0) return;

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const cd = result.currentDensity[r][c];

			// Horizontal flow (right)
			if (c < cols - 1 && Math.abs(cd.horizontal) > maxCurrent * 0.01) {
				const from = gridToCanvas(r, c, width, height, grid, padding);
				const to = gridToCanvas(r, c + 1, width, height, grid, padding);
				const magnitude = Math.abs(cd.horizontal) / maxCurrent;
				const direction = cd.horizontal > 0 ? 1 : -1;
				drawFlowParticles(ctx, from, to, magnitude, direction, time);
			}

			// Vertical flow (down)
			if (r < rows - 1 && Math.abs(cd.vertical) > maxCurrent * 0.01) {
				const from = gridToCanvas(r, c, width, height, grid, padding);
				const to = gridToCanvas(r + 1, c, width, height, grid, padding);
				const magnitude = Math.abs(cd.vertical) / maxCurrent;
				const direction = cd.vertical > 0 ? 1 : -1;
				drawFlowParticles(ctx, from, to, magnitude, direction, time);
			}
		}
	}
}

function drawFlowParticles(
	ctx: CanvasRenderingContext2D,
	from: { x: number; y: number },
	to: { x: number; y: number },
	magnitude: number,
	direction: number,
	time: number
) {
	const numParticles = Math.max(1, Math.round(magnitude * 4));
	const speed = 0.001;

	for (let i = 0; i < numParticles; i++) {
		const phase = (i / numParticles + time * speed * direction) % 1;
		const t = phase < 0 ? phase + 1 : phase;

		const x = from.x + (to.x - from.x) * t;
		const y = from.y + (to.y - from.y) * t;

		const radius = 1.5 + magnitude * 2;

		ctx.beginPath();
		ctx.arc(x, y, radius, 0, Math.PI * 2);
		ctx.fillStyle = `rgba(79, 143, 247, ${0.3 + magnitude * 0.7})`;
		ctx.fill();
	}
}

function getMaxCurrent(result: IRDropResult): number {
	let max = 0;
	for (const row of result.currentDensity) {
		for (const cd of row) {
			max = Math.max(max, Math.abs(cd.horizontal), Math.abs(cd.vertical));
		}
	}
	return max;
}

/** Green → Yellow → Red heat color */
function heatColor(t: number): string {
	// t: 0 = low drop (green), 1 = high drop (red)
	if (t < 0.5) {
		const s = t * 2;
		const r = Math.round(52 + s * 199); // 34 → 251
		const g = Math.round(211 - s * 20); // 211 → 191
		const b = Math.round(153 - s * 117); // 153 → 36
		return `rgb(${r},${g},${b})`;
	} else {
		const s = (t - 0.5) * 2;
		const r = Math.round(251 - s * 3); // 251 → 248
		const g = Math.round(191 - s * 80); // 191 → 113
		const b = Math.round(36 - s * 36); // 36 → 0
		return `rgb(${r},${g},${b})`;
	}
}
