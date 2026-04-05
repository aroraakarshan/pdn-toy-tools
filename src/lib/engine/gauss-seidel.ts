import type { Grid, CurrentSource, IRDropResult } from './types';
import { findBumpAt } from './grid';

/**
 * Gauss-Seidel iterative solver for static IR drop analysis.
 *
 * Solves the resistive network by iterating over the node voltage equations:
 *   V(i) = (Σ V(neighbor) / R(neighbor) + I_inject) / (Σ 1/R(neighbor))
 *
 * Domain bumps are held at VDD (boundary conditions).
 * Current sources inject current at instance locations.
 */
export function solveIRDrop(
	grid: Grid,
	currentSources: CurrentSource[],
	options?: {
		maxIterations?: number;
		convergenceThreshold?: number;
		onIteration?: (iteration: number, maxChange: number, voltages: number[][]) => void;
	}
): IRDropResult {
	const { rows, cols } = grid.config;
	const vdd = grid.config.vdd;
	const maxIter = options?.maxIterations ?? 1000;
	const threshold = options?.convergenceThreshold ?? 1e-6;
	const res = grid.resistances;

	// Build bump lookup for boundary conditions
	const bumpPositions = new Set<string>();
	for (const domain of grid.domains) {
		for (const bump of domain.bumps) {
			bumpPositions.add(`${bump.row},${bump.col}`);
		}
	}

	// Build current injection map (convert mA to A)
	const currentMap = new Map<string, number>();
	for (const src of currentSources) {
		const key = `${src.row},${src.col}`;
		currentMap.set(key, (currentMap.get(key) ?? 0) + src.currentMa / 1000);
	}

	// Initialize voltages — bumps at VDD, everything else at VDD (good initial guess)
	const voltages: number[][] = [];
	for (let r = 0; r < rows; r++) {
		voltages[r] = [];
		for (let c = 0; c < cols; c++) {
			voltages[r][c] = vdd;
		}
	}

	// Iterative Gauss-Seidel solve
	let iteration = 0;
	let converged = false;

	while (iteration < maxIter) {
		let maxChange = 0;

		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				// Skip bump nodes — held at VDD
				if (bumpPositions.has(`${r},${c}`)) continue;

				const oldV = voltages[r][c];

				// Sum neighbor contributions: V_neighbor / R_edge
				let sumVG = 0; // Σ V(neighbor) * G(edge)
				let sumG = 0; // Σ G(edge) where G = 1/R

				// Right neighbor
				if (c < cols - 1 && res[r][c].right !== null) {
					const g = 1 / res[r][c].right!;
					sumVG += voltages[r][c + 1] * g;
					sumG += g;
				}
				// Left neighbor
				if (c > 0 && res[r][c - 1].right !== null) {
					const g = 1 / res[r][c - 1].right!;
					sumVG += voltages[r][c - 1] * g;
					sumG += g;
				}
				// Down neighbor
				if (r < rows - 1 && res[r][c].down !== null) {
					const g = 1 / res[r][c].down!;
					sumVG += voltages[r + 1][c] * g;
					sumG += g;
				}
				// Up neighbor
				if (r > 0 && res[r - 1][c].down !== null) {
					const g = 1 / res[r - 1][c].down!;
					sumVG += voltages[r - 1][c] * g;
					sumG += g;
				}

				if (sumG === 0) continue;

				// Current injection: I flows OUT of the node (sinks current)
				// V = (sumVG - I_inject) / sumG
				const inject = currentMap.get(`${r},${c}`) ?? 0;
				const newV = (sumVG - inject) / sumG;

				voltages[r][c] = newV;
				const change = Math.abs(newV - oldV);
				if (change > maxChange) maxChange = change;
			}
		}

		iteration++;
		options?.onIteration?.(iteration, maxChange, voltages);

		if (maxChange < threshold) {
			converged = true;
			break;
		}
	}

	// Calculate current density on each edge
	const currentDensity: { horizontal: number; vertical: number }[][] = [];
	for (let r = 0; r < rows; r++) {
		currentDensity[r] = [];
		for (let c = 0; c < cols; c++) {
			currentDensity[r][c] = {
				horizontal:
					c < cols - 1 && res[r][c].right !== null
						? (voltages[r][c] - voltages[r][c + 1]) / res[r][c].right!
						: 0,
				vertical:
					r < rows - 1 && res[r][c].down !== null
						? (voltages[r][c] - voltages[r + 1][c]) / res[r][c].down!
						: 0
			};
		}
	}

	// Calculate power loss (I²R) on each edge
	const powerLossMap: number[][] = [];
	for (let r = 0; r < rows; r++) {
		powerLossMap[r] = [];
		for (let c = 0; c < cols; c++) {
			let loss = 0;
			if (c < cols - 1 && res[r][c].right !== null) {
				const i = currentDensity[r][c].horizontal;
				loss += i * i * res[r][c].right!;
			}
			if (r < rows - 1 && res[r][c].down !== null) {
				const i = currentDensity[r][c].vertical;
				loss += i * i * res[r][c].down!;
			}
			powerLossMap[r][c] = loss;
		}
	}

	// Statistics
	let minVoltage = Infinity;
	let maxVoltage = -Infinity;
	let maxIRDrop = 0;
	let totalPowerLoss = 0;

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const v = voltages[r][c];
			const drop = vdd - v;
			if (v < minVoltage) minVoltage = v;
			if (v > maxVoltage) maxVoltage = v;
			if (drop > maxIRDrop) maxIRDrop = drop;
			totalPowerLoss += powerLossMap[r][c];
		}
	}

	return {
		voltageMap: voltages,
		currentDensity,
		powerLossMap,
		statistics: {
			minVoltage,
			maxVoltage,
			maxIRDrop,
			totalPowerLoss,
			voltageDrop: maxVoltage - minVoltage
		},
		converged,
		iterations: iteration
	};
}
