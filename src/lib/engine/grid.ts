import type {
	Grid,
	GridConfig,
	EdgeResistance,
	Domain,
	Instance,
	Position,
	DEFAULT_CONFIG
} from './types';
export { DEFAULT_CONFIG } from './types';

const DOMAIN_COLORS = ['#FF6B6B', '#FFA500', '#4CAF50', '#4f8ff7', '#a78bfa', '#22d3ee'];
const DOMAIN_NAMES = ['Domain A', 'Domain B', 'Domain C', 'Domain D', 'Domain E', 'Domain F'];

/** Simple seeded PRNG (xorshift32) for reproducible grids */
function createRng(seed?: number): () => number {
	let state = seed ?? (Math.random() * 0xffffffff) >>> 0;
	if (state === 0) state = 1;
	return () => {
		state ^= state << 13;
		state ^= state >> 17;
		state ^= state << 5;
		return (state >>> 0) / 0xffffffff;
	};
}

function randRange(rng: () => number, min: number, max: number): number {
	return min + rng() * (max - min);
}

function randInt(rng: () => number, min: number, max: number): number {
	return Math.floor(randRange(rng, min, max + 1));
}

function getAvailablePosition(
	rng: () => number,
	rows: number,
	cols: number,
	occupied: Set<string>
): Position | null {
	// Try random positions first
	for (let attempt = 0; attempt < 50; attempt++) {
		const row = Math.floor(rng() * rows);
		const col = Math.floor(rng() * cols);
		if (!occupied.has(`${row},${col}`)) {
			return { row, col };
		}
	}
	// Systematic fallback
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			if (!occupied.has(`${row},${col}`)) {
				return { row, col };
			}
		}
	}
	return null;
}

/** Generate a complete PDN grid with domains, bumps, and instances */
export function generateGrid(config: GridConfig): Grid {
	const rng = createRng(config.seed);
	const { rows, cols } = config;

	// Generate edge resistances
	const resistances: EdgeResistance[][] = [];
	for (let row = 0; row < rows; row++) {
		resistances[row] = [];
		for (let col = 0; col < cols; col++) {
			resistances[row][col] = {
				right:
					col < cols - 1
						? randRange(rng, config.resistanceRange.edge[0], config.resistanceRange.edge[1])
						: null,
				down:
					row < rows - 1
						? randRange(rng, config.resistanceRange.edge[0], config.resistanceRange.edge[1])
						: null
			};
		}
	}

	const occupied = new Set<string>();

	// Generate domains with bumps
	const domains: Domain[] = [];
	for (let d = 0; d < config.numDomains; d++) {
		const numBumps = randInt(rng, config.bumpsPerDomain[0], config.bumpsPerDomain[1]);
		const bumps = [];

		for (let b = 0; b < numBumps; b++) {
			const pos = getAvailablePosition(rng, rows, cols, occupied);
			if (!pos) break;
			bumps.push({
				id: `bump-${d}-${b}`,
				domainId: d,
				row: pos.row,
				col: pos.col,
				resistance: randRange(
					rng,
					config.resistanceRange.bump[0],
					config.resistanceRange.bump[1]
				)
			});
			occupied.add(`${pos.row},${pos.col}`);
		}

		domains.push({
			id: d,
			name: DOMAIN_NAMES[d] ?? `Domain ${d}`,
			color: DOMAIN_COLORS[d] ?? `hsl(${(d * 60) % 360}, 70%, 60%)`,
			bumps,
			virtualNode: {
				id: `virtual-${d}`,
				domainId: d
			}
		});
	}

	// Generate instances
	const instances: Instance[] = [];
	for (let i = 0; i < config.numInstances; i++) {
		const pos = getAvailablePosition(rng, rows, cols, occupied);
		if (!pos) break;
		instances.push({
			id: `instance-${i}`,
			row: pos.row,
			col: pos.col,
			resistance: randRange(
				rng,
				config.resistanceRange.instance[0],
				config.resistanceRange.instance[1]
			)
		});
		occupied.add(`${pos.row},${pos.col}`);
	}

	return { config, resistances, domains, instances };
}

/** Get the edge resistance between two adjacent nodes */
export function getEdgeResistance(
	grid: Grid,
	r1: number,
	c1: number,
	r2: number,
	c2: number
): number | null {
	const dr = r2 - r1;
	const dc = c2 - c1;

	if (dr === 0 && dc === 1) return grid.resistances[r1][c1].right;
	if (dr === 0 && dc === -1) return grid.resistances[r1][c2].right;
	if (dr === 1 && dc === 0) return grid.resistances[r1][c1].down;
	if (dr === -1 && dc === 0) return grid.resistances[r2][c1].down;

	return null; // Not adjacent
}

/** Check if a position is a bump in a specific domain */
export function findBumpAt(grid: Grid, row: number, col: number, domainId?: number) {
	for (const domain of grid.domains) {
		if (domainId !== undefined && domain.id !== domainId) continue;
		for (const bump of domain.bumps) {
			if (bump.row === row && bump.col === col) return bump;
		}
	}
	return null;
}

/** Check if a position has an instance */
export function findInstanceAt(grid: Grid, row: number, col: number) {
	return grid.instances.find((inst) => inst.row === row && inst.col === col) ?? null;
}

/** Check if a position is occupied by any bump or instance */
export function isOccupied(grid: Grid, row: number, col: number): boolean {
	return findBumpAt(grid, row, col) !== null || findInstanceAt(grid, row, col) !== null;
}
