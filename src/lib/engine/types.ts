// Core types for the PDN grid simulation

export interface GridConfig {
	rows: number;
	cols: number;
	numDomains: number;
	bumpsPerDomain: [number, number]; // [min, max]
	numInstances: number;
	resistanceRange: {
		edge: [number, number]; // grid edge resistance range (Ω)
		bump: [number, number]; // bump resistance range (Ω)
		instance: [number, number]; // instance resistance range (Ω)
		virtual: number; // virtual node resistance (Ω)
	};
	vdd: number; // supply voltage (V)
	seed?: number; // for reproducible layouts
}

export const DEFAULT_CONFIG: GridConfig = {
	rows: 10,
	cols: 10,
	numDomains: 3,
	bumpsPerDomain: [2, 6],
	numInstances: 7,
	resistanceRange: {
		edge: [0.05, 0.2],
		bump: [0.01, 0.05],
		instance: [0.3, 2.0],
		virtual: 0.001
	},
	vdd: 1.0
};

export interface Position {
	row: number;
	col: number;
}

export interface EdgeResistance {
	right: number | null; // resistance to (row, col+1)
	down: number | null; // resistance to (row+1, col)
}

export interface Bump {
	id: string;
	domainId: number;
	row: number;
	col: number;
	resistance: number;
}

export interface VirtualNode {
	id: string;
	domainId: number;
}

export interface Domain {
	id: number;
	name: string;
	color: string;
	bumps: Bump[];
	virtualNode: VirtualNode;
}

export interface Instance {
	id: string;
	row: number;
	col: number;
	resistance: number;
}

export interface Grid {
	config: GridConfig;
	resistances: EdgeResistance[][];
	domains: Domain[];
	instances: Instance[];
}

// Pathfinding types

export interface PathNode {
	row: number;
	col: number;
}

export interface PathResult {
	path: PathNode[];
	totalResistance: number;
}

// IR Drop types

export interface CurrentSource {
	instanceId: string;
	row: number;
	col: number;
	currentMa: number;
}

export interface IRDropResult {
	voltageMap: number[][];
	currentDensity: { horizontal: number; vertical: number }[][];
	powerLossMap: number[][];
	statistics: {
		minVoltage: number;
		maxVoltage: number;
		maxIRDrop: number;
		totalPowerLoss: number;
		voltageDrop: number;
	};
	converged: boolean;
	iterations: number;
}

// Canvas interaction types

export interface CanvasHitResult {
	type: 'node' | 'bump' | 'instance' | 'edge' | 'none';
	row: number;
	col: number;
	id?: string;
	domainId?: number;
}
