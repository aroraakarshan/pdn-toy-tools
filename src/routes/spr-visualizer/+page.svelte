<script lang="ts">
	import { onMount } from 'svelte';
	import Canvas from '$lib/components/Canvas.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import ResultsPanel from '$lib/components/ResultsPanel.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import {
		generateGrid,
		dijkstraSPR,
		yenKShortest,
		findBumpAt,
		findInstanceAt,
		DEFAULT_CONFIG
	} from '$lib/engine';
	import type { Grid, Instance, Domain, PathResult } from '$lib/engine';
	import {
		renderGrid,
		renderPath,
		canvasToGrid,
		type GridRenderOptions
	} from '$lib/canvas/renderers';

	let grid = $state(generateGrid({ ...DEFAULT_CONFIG, seed: 42 }));
	let selectedSource = $state<Instance | null>(null);
	let selectedTarget = $state<Domain | null>(null);
	let paths = $state<PathResult[]>([]);
	let pathCount = $state(3);
	let animating = $state(false);
	let animProgress = $state(-1); // -1 = not animating, 0..1 = progress
	let showLabels = $state(false);
	let hoveredNode = $state<{ row: number; col: number } | null>(null);
	let canvasW = $state(800);
	let canvasH = $state(600);

	// Tooltip state
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipText = $state('');

	const PATH_COLORS = ['#4f8ff7', '#a78bfa', '#34d399', '#fbbf24', '#f87171'];

	function handleRender(ctx: CanvasRenderingContext2D, w: number, h: number) {
		const opts: Partial<GridRenderOptions> = {
			showResistanceLabels: showLabels,
			highlightedNode: hoveredNode,
			selectedSource,
			selectedTarget
		};

		renderGrid(ctx, grid, w, h, opts);

		// Draw paths
		for (let i = paths.length - 1; i >= 0; i--) {
			const color = PATH_COLORS[i % PATH_COLORS.length];
			const progress = i === 0 && animating ? animProgress : undefined;
			renderPath(ctx, grid, paths[i].path, w, h, 48, color, progress);
		}
	}

	function handleClick(e: MouseEvent, canvas: HTMLCanvasElement) {
		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		const pos = canvasToGrid(x, y, canvasW, canvasH, grid, 48);
		if (!pos) return;

		const inst = findInstanceAt(grid, pos.row, pos.col);
		const bump = findBumpAt(grid, pos.row, pos.col);

		if (inst && !selectedSource) {
			selectedSource = inst;
		} else if (inst && selectedSource && inst.id !== selectedSource.id) {
			selectedSource = inst;
			paths = [];
		} else if (bump && !selectedTarget) {
			selectedTarget = grid.domains.find((d) => d.id === bump.domainId) ?? null;
		} else if (bump && selectedTarget && bump.domainId !== selectedTarget.id) {
			selectedTarget = grid.domains.find((d) => d.id === bump.domainId) ?? null;
			paths = [];
		}
	}

	function handleMouseMove(e: MouseEvent, canvas: HTMLCanvasElement) {
		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		const pos = canvasToGrid(x, y, canvasW, canvasH, grid, 48);

		hoveredNode = pos;

		if (pos) {
			const inst = findInstanceAt(grid, pos.row, pos.col);
			const bump = findBumpAt(grid, pos.row, pos.col);

			if (inst) {
				tooltipText = `Instance ${inst.id.split('-')[1]} — R: ${inst.resistance.toFixed(3)}Ω`;
				tooltipVisible = true;
			} else if (bump) {
				const domain = grid.domains.find((d) => d.id === bump.domainId);
				tooltipText = `${domain?.name} Bump — R: ${bump.resistance.toFixed(3)}Ω`;
				tooltipVisible = true;
			} else {
				const res = grid.resistances[pos.row][pos.col];
				tooltipText = `Node (${pos.row},${pos.col})`;
				if (res.right !== null) tooltipText += ` — R→: ${res.right.toFixed(3)}Ω`;
				if (res.down !== null) tooltipText += ` — R↓: ${res.down.toFixed(3)}Ω`;
				tooltipVisible = true;
			}
			tooltipX = e.clientX;
			tooltipY = e.clientY;
		} else {
			tooltipVisible = false;
		}
	}

	function handleMouseLeave() {
		hoveredNode = null;
		tooltipVisible = false;
	}

	function findPath() {
		if (!selectedSource || !selectedTarget) return;
		const result = dijkstraSPR(grid, selectedSource, selectedTarget);
		if (result) {
			paths = [result];
			animatePath();
		}
	}

	function findAllPaths() {
		if (!selectedSource || !selectedTarget) return;
		const results = yenKShortest(grid, selectedSource, selectedTarget, pathCount);
		if (results.length > 0) {
			paths = results;
			animatePath();
		}
	}

	function animatePath() {
		animating = true;
		animProgress = 0;
		const start = performance.now();
		const duration = 1500;

		function step(now: number) {
			const elapsed = now - start;
			animProgress = Math.min(1, elapsed / duration);

			if (animProgress < 1) {
				requestAnimationFrame(step);
			} else {
				animating = false;
				animProgress = -1;
			}
		}

		requestAnimationFrame(step);
	}

	function reset() {
		selectedSource = null;
		selectedTarget = null;
		paths = [];
		animating = false;
		animProgress = -1;
	}

	function newGrid() {
		grid = generateGrid({ ...DEFAULT_CONFIG, seed: Math.floor(Math.random() * 100000) });
		reset();
	}
</script>

<svelte:head>
	<title>SPR Visualizer — PDN Toy Tools</title>
</svelte:head>

<div class="tool-layout">
	<Sidebar title="SPR Controls">
		<div class="control-group">
			<span class="control-label">Source Instance</span>
			<div class="selection-display" class:active={selectedSource !== null}>
				{#if selectedSource}
					<span class="selection-badge source">I{selectedSource.id.split('-')[1]}</span>
					<span class="selection-detail"
						>({selectedSource.row},{selectedSource.col}) — {selectedSource.resistance.toFixed(3)}Ω</span
					>
				{:else}
					<span class="selection-hint">Click an instance (□) on the grid</span>
				{/if}
			</div>
		</div>

		<div class="control-group">
			<span class="control-label">Target Domain</span>
			<div class="selection-display" class:active={selectedTarget !== null}>
				{#if selectedTarget}
					<span class="selection-badge" style="background: {selectedTarget.color}"
						>{selectedTarget.name}</span
					>
					<span class="selection-detail">{selectedTarget.bumps.length} bumps</span>
				{:else}
					<span class="selection-hint">Click a domain bump (●) on the grid</span>
				{/if}
			</div>
		</div>

		<div class="control-group">
			<label class="control-label" for="path-count">
				Number of Paths: <strong>{pathCount}</strong>
			</label>
			<input id="path-count" type="range" min="1" max="5" bind:value={pathCount} class="slider" />
		</div>

		<div class="button-group">
			<button
				class="btn btn-primary"
				onclick={findPath}
				disabled={!selectedSource || !selectedTarget || animating}
			>
				Find Shortest Path
			</button>
			<button
				class="btn btn-secondary"
				onclick={findAllPaths}
				disabled={!selectedSource || !selectedTarget || animating}
			>
				Find {pathCount} Paths
			</button>
		</div>

		<div class="button-group">
			<button class="btn btn-ghost" onclick={reset}>Clear Selection</button>
			<button class="btn btn-ghost" onclick={newGrid}>New Grid</button>
		</div>

		<div class="control-group">
			<label class="toggle-label">
				<input type="checkbox" bind:checked={showLabels} />
				Show Resistance Labels
			</label>
		</div>

		{#if paths.length > 0}
			<ResultsPanel title="Path Results">
				{#each paths as path, i}
					<div class="result-row">
						<span class="path-dot" style="background: {PATH_COLORS[i % PATH_COLORS.length]}"
						></span>
						<span class="result-label">Path {i + 1}</span>
						<span class="result-value mono">{path.totalResistance.toFixed(3)} Ω</span>
					</div>
					<div class="result-row sub">
						<span class="result-label">Current (@ {grid.config.vdd}V)</span>
						<span class="result-value mono"
							>{(grid.config.vdd / path.totalResistance).toFixed(3)} A</span
						>
					</div>
					<div class="result-row sub">
						<span class="result-label">Segments</span>
						<span class="result-value">{path.path.length - 1}</span>
					</div>
				{/each}
			</ResultsPanel>
		{/if}

		<div class="legend">
			<h4 class="legend-title">Legend</h4>
			<div class="legend-item">
				<span class="legend-icon instance-icon"></span>
				<span>Instance (current sink)</span>
			</div>
			{#each grid.domains as domain}
				<div class="legend-item">
					<span class="legend-icon bump-icon" style="background: {domain.color}"></span>
					<span>{domain.name} Bump</span>
				</div>
			{/each}
		</div>
	</Sidebar>

	<div class="canvas-area">
		<Canvas
			{grid}
			bind:width={canvasW}
			bind:height={canvasH}
			onrender={handleRender}
			onclick={handleClick}
			onmousemove={handleMouseMove}
			onmouseleave={handleMouseLeave}
		/>
	</div>
</div>

<Tooltip visible={tooltipVisible} x={tooltipX} y={tooltipY}>
	{tooltipText}
</Tooltip>

<style>
	.tool-layout {
		display: flex;
		height: calc(100vh - var(--nav-height));
		overflow: hidden;
	}

	.canvas-area {
		flex: 1;
		padding: 1rem;
		min-width: 0;
	}

	/* Controls */
	.control-group {
		margin-bottom: 1rem;
	}

	.control-label {
		display: block;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
		margin-bottom: 0.4rem;
	}

	.selection-display {
		padding: 0.6rem 0.75rem;
		background: var(--color-bg-tertiary);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		font-size: 0.85rem;
		min-height: 42px;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.selection-display.active {
		border-color: var(--color-accent-blue);
	}

	.selection-badge {
		padding: 0.15rem 0.5rem;
		border-radius: 4px;
		font-weight: 600;
		font-size: 0.75rem;
		color: #fff;
	}

	.selection-badge.source {
		background: #22d3ee;
		color: #000;
	}

	.selection-detail {
		color: var(--color-text-secondary);
		font-size: 0.8rem;
	}

	.selection-hint {
		color: var(--color-text-muted);
		font-size: 0.8rem;
		font-style: italic;
	}

	.slider {
		width: 100%;
		accent-color: var(--color-accent-blue);
	}

	.button-group {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.btn {
		flex: 1;
		padding: 0.6rem 0.75rem;
		border-radius: 6px;
		border: none;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.btn-primary {
		background: var(--color-accent-blue);
		color: #fff;
	}

	.btn-primary:hover:not(:disabled) {
		background: #3a7ae0;
	}

	.btn-secondary {
		background: var(--color-bg-tertiary);
		color: var(--color-text-primary);
		border: 1px solid var(--color-border);
	}

	.btn-secondary:hover:not(:disabled) {
		border-color: var(--color-border-hover);
	}

	.btn-ghost {
		background: transparent;
		color: var(--color-text-secondary);
		border: 1px solid var(--color-border);
	}

	.btn-ghost:hover {
		background: var(--color-bg-tertiary);
		color: var(--color-text-primary);
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: var(--color-text-secondary);
		cursor: pointer;
	}

	/* Results */
	.result-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.3rem 0;
	}

	.result-row.sub {
		padding-left: 1.25rem;
		font-size: 0.8rem;
	}

	.path-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.result-label {
		flex: 1;
		color: var(--color-text-secondary);
		font-size: 0.85rem;
	}

	.result-value {
		font-weight: 600;
		font-size: 0.85rem;
	}

	.mono {
		font-family: 'JetBrains Mono', monospace;
	}

	/* Legend */
	.legend {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}

	.legend-title {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
		margin: 0 0 0.5rem;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		padding: 0.2rem 0;
	}

	.legend-icon {
		width: 12px;
		height: 12px;
		flex-shrink: 0;
	}

	.instance-icon {
		background: #22d3ee;
		border-radius: 2px;
	}

	.bump-icon {
		border-radius: 50%;
	}

	@media (max-width: 768px) {
		.tool-layout {
			flex-direction: column;
		}

		.canvas-area {
			height: 50vh;
			padding: 0.5rem;
		}
	}
</style>
