import type { Grid, PathResult, PathNode, Instance, Domain, Bump } from './types';
import { getEdgeResistance, findBumpAt } from './grid';

interface DijkstraNode {
	id: string;
	row: number;
	col: number;
	type: 'grid' | 'virtual';
}

/**
 * Dijkstra's algorithm for Shortest Path Resistance (SPR).
 *
 * Finds the lowest-resistance path from a source instance to the nearest
 * bump in a target domain, using a virtual target node that all domain bumps
 * connect to with their bump resistance.
 */
export function dijkstraSPR(
	grid: Grid,
	source: Instance,
	targetDomain: Domain,
	blockedNodes?: Set<string>
): PathResult | null {
	const { rows, cols } = grid.config;

	const distances = new Map<string, number>();
	const previous = new Map<string, string>();
	const visited = new Set<string>();

	// Initialize all grid nodes
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			distances.set(`${r},${c}`, Infinity);
		}
	}

	// Virtual target node
	const virtualId = `virtual-${targetDomain.id}`;
	distances.set(virtualId, Infinity);

	// Source gets its own resistance as starting cost
	const sourceId = `${source.row},${source.col}`;
	distances.set(sourceId, source.resistance);

	// Simple priority queue via linear scan (fine for 10×10 grids)
	while (true) {
		// Find unvisited node with minimum distance
		let currentId: string | null = null;
		let minDist = Infinity;
		for (const [id, dist] of distances) {
			if (!visited.has(id) && dist < minDist) {
				minDist = dist;
				currentId = id;
			}
		}

		if (currentId === null || minDist === Infinity) break;

		visited.add(currentId);

		// Reached virtual target — done
		if (currentId === virtualId) break;

		// Parse current position
		const [rowStr, colStr] = currentId.split(',');
		const row = parseInt(rowStr);
		const col = parseInt(colStr);

		// Check 4 grid neighbors
		const directions = [
			[0, 1],
			[0, -1],
			[1, 0],
			[-1, 0]
		];

		for (const [dr, dc] of directions) {
			const nr = row + dr;
			const nc = col + dc;
			if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

			const neighborId = `${nr},${nc}`;
			if (visited.has(neighborId)) continue;
			if (blockedNodes?.has(neighborId)) continue;

			// Skip positions occupied by non-target bumps or non-source instances
			if (isBlocked(grid, nr, nc, source, targetDomain)) continue;

			const edgeR = getEdgeResistance(grid, row, col, nr, nc);
			if (edgeR === null) continue;

			const alt = minDist + edgeR;
			if (alt < (distances.get(neighborId) ?? Infinity)) {
				distances.set(neighborId, alt);
				previous.set(neighborId, currentId);
			}
		}

		// Check if current position is a bump in target domain → connect to virtual node
		const bump = findBumpAt(grid, row, col, targetDomain.id);
		if (bump) {
			const alt = minDist + bump.resistance;
			if (alt < (distances.get(virtualId) ?? Infinity)) {
				distances.set(virtualId, alt);
				previous.set(virtualId, currentId);
			}
		}
	}

	const totalResistance = distances.get(virtualId) ?? Infinity;
	if (totalResistance === Infinity) return null;

	// Reconstruct path (skip the virtual node itself)
	const path: PathNode[] = [];
	let cur: string | undefined = virtualId;

	while (cur && previous.has(cur)) {
		if (cur !== virtualId) {
			const [r, c] = cur.split(',').map(Number);
			path.unshift({ row: r, col: c });
		}
		cur = previous.get(cur);
	}
	// Add source
	path.unshift({ row: source.row, col: source.col });

	// Add the actual bump we connected through as the final visual point
	const lastNode = path[path.length - 1];
	const terminalBump = findBumpAt(grid, lastNode.row, lastNode.col, targetDomain.id);
	if (!terminalBump) {
		// Last path node wasn't the bump itself — find which bump connected
		const prevOfVirtual = previous.get(virtualId);
		if (prevOfVirtual && prevOfVirtual !== virtualId) {
			const [br, bc] = prevOfVirtual.split(',').map(Number);
			if (br !== lastNode.row || bc !== lastNode.col) {
				path.push({ row: br, col: bc });
			}
		}
	}

	return { path, totalResistance };
}

/**
 * Find shortest path from source to EACH bump in a domain individually.
 * Returns one PathResult per reachable bump, sorted by resistance (lowest first).
 */
export function dijkstraToAllBumps(
	grid: Grid,
	source: Instance,
	targetDomain: Domain
): PathResult[] {
	const { rows, cols } = grid.config;

	// Run Dijkstra once from source to get distances to all grid nodes
	const distances = new Map<string, number>();
	const previous = new Map<string, string>();
	const visited = new Set<string>();

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			distances.set(`${r},${c}`, Infinity);
		}
	}

	const sourceId = `${source.row},${source.col}`;
	distances.set(sourceId, source.resistance);

	while (true) {
		let currentId: string | null = null;
		let minDist = Infinity;
		for (const [id, dist] of distances) {
			if (!visited.has(id) && dist < minDist) {
				minDist = dist;
				currentId = id;
			}
		}
		if (currentId === null || minDist === Infinity) break;
		visited.add(currentId);

		const [rowStr, colStr] = currentId.split(',');
		const row = parseInt(rowStr);
		const col = parseInt(colStr);

		for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
			const nr = row + dr;
			const nc = col + dc;
			if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
			const neighborId = `${nr},${nc}`;
			if (visited.has(neighborId)) continue;
			if (isBlocked(grid, nr, nc, source, targetDomain)) continue;

			const edgeR = getEdgeResistance(grid, row, col, nr, nc);
			if (edgeR === null) continue;

			const alt = minDist + edgeR;
			if (alt < (distances.get(neighborId) ?? Infinity)) {
				distances.set(neighborId, alt);
				previous.set(neighborId, currentId);
			}
		}
	}

	// Reconstruct path to each bump
	const results: PathResult[] = [];
	for (const bump of targetDomain.bumps) {
		const bumpId = `${bump.row},${bump.col}`;
		const gridDist = distances.get(bumpId);
		if (gridDist === undefined || gridDist === Infinity) continue;

		const totalResistance = gridDist + bump.resistance;

		// Reconstruct path
		const path: PathNode[] = [];
		let cur: string | undefined = bumpId;
		while (cur) {
			const [r, c] = cur.split(',').map(Number);
			path.unshift({ row: r, col: c });
			cur = previous.get(cur);
		}

		results.push({
			path,
			totalResistance,
			bumpId: bump.id,
			bumpLabel: `Bump (${bump.row},${bump.col})`
		});
	}

	results.sort((a, b) => a.totalResistance - b.totalResistance);
	return results;
}

/** Check if a grid cell is blocked for pathfinding */
function isBlocked(
	grid: Grid,
	row: number,
	col: number,
	source: Instance,
	targetDomain: Domain
): boolean {
	// Allow source position
	if (row === source.row && col === source.col) return false;

	// Allow target domain bumps
	if (findBumpAt(grid, row, col, targetDomain.id)) return false;

	// Block other domain bumps
	for (const domain of grid.domains) {
		if (domain.id === targetDomain.id) continue;
		for (const bump of domain.bumps) {
			if (bump.row === row && bump.col === col) return true;
		}
	}

	// Block other instances
	for (const inst of grid.instances) {
		if (inst.id === source.id) continue;
		if (inst.row === row && inst.col === col) return true;
	}

	return false;
}
