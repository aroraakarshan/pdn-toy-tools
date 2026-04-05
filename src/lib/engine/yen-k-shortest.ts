import type { Grid, PathResult, Instance, Domain } from './types';
import { dijkstraSPR } from './dijkstra';

/**
 * Yen's k-shortest paths algorithm adapted for SPR.
 *
 * Finds the k shortest (lowest resistance) paths from a source instance
 * to a target domain. Unlike the previous random-blocking heuristic,
 * this gives deterministic, ranked results.
 */
export function yenKShortest(
	grid: Grid,
	source: Instance,
	targetDomain: Domain,
	k: number
): PathResult[] {
	const A: PathResult[] = []; // k-shortest paths found
	const B: PathResult[] = []; // candidate paths

	// Step 1: Find the shortest path
	const shortest = dijkstraSPR(grid, source, targetDomain);
	if (!shortest) return [];
	A.push(shortest);

	for (let ki = 1; ki < k; ki++) {
		const prevPath = A[ki - 1].path;

		// For each spur node in the previous k-shortest path
		for (let i = 0; i < prevPath.length - 1; i++) {
			const spurNode = prevPath[i];
			const rootPath = prevPath.slice(0, i + 1);

			// Block edges that share the same root path prefix in already-found paths
			const blockedNodes = new Set<string>();
			for (const p of A) {
				if (p.path.length > i && pathPrefixMatches(p.path, rootPath)) {
					// Block the node after the spur in this path
					if (i + 1 < p.path.length) {
						const blocked = p.path[i + 1];
						blockedNodes.add(`${blocked.row},${blocked.col}`);
					}
				}
			}

			// Also block nodes in root path (except spur node) to avoid loops
			for (let j = 0; j < i; j++) {
				blockedNodes.add(`${rootPath[j].row},${rootPath[j].col}`);
			}

			// Create a temporary source at the spur node
			const spurSource: Instance = {
				id: `spur-${i}`,
				row: spurNode.row,
				col: spurNode.col,
				resistance: 0 // No additional source resistance for spur
			};

			const spurResult = dijkstraSPR(grid, spurSource, targetDomain, blockedNodes);
			if (spurResult) {
				// Calculate root path resistance
				let rootResistance = source.resistance;
				for (let j = 0; j < rootPath.length - 1; j++) {
					rootResistance += getSegmentResistance(grid, rootPath[j], rootPath[j + 1]);
				}

				// Combine root + spur path
				const totalPath = [...rootPath.slice(0, -1), ...spurResult.path];
				const totalResistance = rootResistance + spurResult.totalResistance;

				// Check for duplicates
				if (!isDuplicatePath(B, totalPath) && !isDuplicatePath(A, totalPath)) {
					B.push({ path: totalPath, totalResistance });
				}
			}
		}

		if (B.length === 0) break;

		// Sort candidates by resistance and pick the best
		B.sort((a, b) => a.totalResistance - b.totalResistance);
		A.push(B.shift()!);
	}

	return A;
}

function pathPrefixMatches(
	path: { row: number; col: number }[],
	prefix: { row: number; col: number }[]
): boolean {
	if (path.length < prefix.length) return false;
	for (let i = 0; i < prefix.length; i++) {
		if (path[i].row !== prefix[i].row || path[i].col !== prefix[i].col) return false;
	}
	return true;
}

function isDuplicatePath(
	paths: PathResult[],
	newPath: { row: number; col: number }[]
): boolean {
	return paths.some(
		(p) =>
			p.path.length === newPath.length &&
			p.path.every((node, i) => node.row === newPath[i].row && node.col === newPath[i].col)
	);
}

function getSegmentResistance(
	grid: Grid,
	p1: { row: number; col: number },
	p2: { row: number; col: number }
): number {
	const dr = p2.row - p1.row;
	const dc = p2.col - p1.col;
	const res = grid.resistances;

	if (dr === 0 && dc === 1) return res[p1.row][p1.col].right ?? 0;
	if (dr === 0 && dc === -1) return res[p1.row][p2.col].right ?? 0;
	if (dr === 1 && dc === 0) return res[p1.row][p1.col].down ?? 0;
	if (dr === -1 && dc === 0) return res[p2.row][p1.col].down ?? 0;

	return 0;
}
