import { writable, derived } from 'svelte/store';
import type { Grid, GridConfig, Instance, Domain, PathResult, CurrentSource, IRDropResult } from '../engine/types';
import { DEFAULT_CONFIG } from '../engine/types';
import { generateGrid } from '../engine/grid';

// Grid configuration & state
export const gridConfig = writable<GridConfig>({ ...DEFAULT_CONFIG });
export const grid = writable<Grid>(generateGrid(DEFAULT_CONFIG));

export function regenerateGrid(config?: Partial<GridConfig>) {
	gridConfig.update((c) => {
		const newConfig = config ? { ...c, ...config } : c;
		grid.set(generateGrid(newConfig));
		return newConfig;
	});
}

// SPR state
export const selectedSource = writable<Instance | null>(null);
export const selectedTarget = writable<Domain | null>(null);
export const sprPaths = writable<PathResult[]>([]);
export const sprPathCount = writable(3);
export const sprAnimationSpeed = writable(1);
export const sprAnimating = writable(false);

// IR Drop state
export const currentSources = writable<CurrentSource[]>([]);
export const irDropResult = writable<IRDropResult | null>(null);
export const showHeatmap = writable(true);
export const showCurrentFlow = writable(true);

// UI state
export const hoveredNode = writable<{ row: number; col: number } | null>(null);
export const showResistanceLabels = writable(false);
