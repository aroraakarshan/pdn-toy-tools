<script lang="ts">
	import Canvas from '$lib/components/Canvas.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import ResultsPanel from '$lib/components/ResultsPanel.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { generateGrid, solveIRDrop, findBumpAt, findInstanceAt, DEFAULT_CONFIG } from '$lib/engine';
	import type { Grid, CurrentSource, IRDropResult } from '$lib/engine';
	import { renderGrid, renderHeatmap, renderCurrentFlow, canvasToGrid } from '$lib/canvas/renderers';

	let grid = $state(generateGrid({ ...DEFAULT_CONFIG, seed: 42 }));
	let activeSources = $state<Map<string, number>>(new Map());
	let result = $state<IRDropResult | null>(null);
	let showHeatmap = $state(true);
	let showFlow = $state(true);
	let flowTime = $state(0);
	let flowAnimFrame = $state(0);
	let canvasW = $state(800);
	let canvasH = $state(600);

	// Tooltip
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipText = $state('');

	function toggleSource(instanceId: string) {
		const inst = grid.instances.find((i) => i.id === instanceId);
		if (!inst) return;

		const newMap = new Map(activeSources);
		if (newMap.has(instanceId)) {
			newMap.delete(instanceId);
		} else {
			newMap.set(instanceId, 50); // default 50mA
		}
		activeSources = newMap;
		solve();
	}

	function updateCurrent(instanceId: string, value: number) {
		const newMap = new Map(activeSources);
		newMap.set(instanceId, value);
		activeSources = newMap;
		solve();
	}

	function solve() {
		if (activeSources.size === 0) {
			result = null;
			return;
		}

		const sources: CurrentSource[] = [];
		for (const [id, mA] of activeSources) {
			const inst = grid.instances.find((i) => i.id === id);
			if (inst) {
				sources.push({ instanceId: id, row: inst.row, col: inst.col, currentMa: mA });
			}
		}

		result = solveIRDrop(grid, sources);
	}

	function startFlowAnimation() {
		cancelAnimationFrame(flowAnimFrame);
		function animate() {
			flowTime += 16;
			flowAnimFrame = requestAnimationFrame(animate);
		}
		flowAnimFrame = requestAnimationFrame(animate);
	}

	function stopFlowAnimation() {
		cancelAnimationFrame(flowAnimFrame);
	}

	$effect(() => {
		if (showFlow && result) {
			startFlowAnimation();
		} else {
			stopFlowAnimation();
		}
		return () => stopFlowAnimation();
	});

	function handleRender(ctx: CanvasRenderingContext2D, w: number, h: number) {
		renderGrid(ctx, grid, w, h, {
			showResistanceLabels: false,
			selectedSource: null,
			selectedTarget: null
		});

		if (result && showHeatmap) {
			renderHeatmap(ctx, grid, result, w, h, 48);
			// Re-draw nodes on top of heatmap
			renderGrid(ctx, grid, w, h, { showResistanceLabels: false });
		}

		if (result && showFlow) {
			renderCurrentFlow(ctx, grid, result, w, h, 48, flowTime);
		}

		// Highlight active current sources
		for (const [id] of activeSources) {
			const inst = grid.instances.find((i) => i.id === id);
			if (inst) {
				const pos = canvasToPixel(inst.row, inst.col, w, h);
				ctx.beginPath();
				ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
				ctx.strokeStyle = '#f87171';
				ctx.lineWidth = 2;
				ctx.stroke();
			}
		}
	}

	// Inline the coordinate conversion for active source highlighting
	function canvasToPixel(row: number, col: number, w: number, h: number) {
		const padding = 48;
		const drawW = w - padding * 2;
		const drawH = h - padding * 2;
		const cellW = drawW / (grid.config.cols - 1);
		const cellH = drawH / (grid.config.rows - 1);
		return { x: padding + col * cellW, y: padding + row * cellH };
	}

	function handleClick(e: MouseEvent, canvas: HTMLCanvasElement) {
		const rect = canvas.getBoundingClientRect();
		const pos = canvasToGrid(e.clientX - rect.left, e.clientY - rect.top, canvasW, canvasH, grid, 48);
		if (!pos) return;

		const inst = findInstanceAt(grid, pos.row, pos.col);
		if (inst) {
			toggleSource(inst.id);
		}
	}

	function handleMouseMove(e: MouseEvent, canvas: HTMLCanvasElement) {
		const rect = canvas.getBoundingClientRect();
		const pos = canvasToGrid(e.clientX - rect.left, e.clientY - rect.top, canvasW, canvasH, grid, 48);

		if (pos) {
			const inst = findInstanceAt(grid, pos.row, pos.col);
			const bump = findBumpAt(grid, pos.row, pos.col);

			if (result) {
				const v = result.voltageMap[pos.row][pos.col];
				const drop = grid.config.vdd - v;
				tooltipText = `(${pos.row},${pos.col}) — V: ${v.toFixed(4)}V — Drop: ${(drop * 1000).toFixed(1)}mV`;
			} else if (inst) {
				tooltipText = `Instance ${inst.id.split('-')[1]} — Click to toggle current source`;
			} else if (bump) {
				const domain = grid.domains.find((d) => d.id === bump.domainId);
				tooltipText = `${domain?.name} Bump — Held at VDD (${grid.config.vdd}V)`;
			} else {
				tooltipText = `Node (${pos.row},${pos.col})`;
			}

			tooltipVisible = true;
			tooltipX = e.clientX;
			tooltipY = e.clientY;
		} else {
			tooltipVisible = false;
		}
	}

	function handleMouseLeave() {
		tooltipVisible = false;
	}

	function newGrid() {
		grid = generateGrid({ ...DEFAULT_CONFIG, seed: Math.floor(Math.random() * 100000) });
		activeSources = new Map();
		result = null;
	}
</script>

<svelte:head>
	<title>IR Drop Visualizer — PDN Toy Tools</title>
</svelte:head>

<div class="tool-layout">
	<Sidebar title="IR Drop Controls">
		<div class="control-group">
			<span class="control-label">Current Sources</span>
			<p class="hint">Click instances on the grid or toggle below:</p>
			<div class="source-list">
				{#each grid.instances as inst}
					{@const isActive = activeSources.has(inst.id)}
					<div class="source-item" class:active={isActive}>
						<label class="source-toggle">
							<input
								type="checkbox"
								checked={isActive}
								onchange={() => toggleSource(inst.id)}
							/>
							<span class="source-name">I{inst.id.split('-')[1]}</span>
							<span class="source-pos">({inst.row},{inst.col})</span>
						</label>
						{#if isActive}
							<div class="current-slider">
								<input
									type="range"
									min="1"
									max="200"
									value={activeSources.get(inst.id) ?? 50}
									oninput={(e) => updateCurrent(inst.id, parseInt(e.currentTarget.value))}
								/>
								<span class="current-value mono">{activeSources.get(inst.id)}mA</span>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<div class="control-group">
			<label class="toggle-label">
				<input type="checkbox" bind:checked={showHeatmap} />
				Show Voltage Heatmap
			</label>
			<label class="toggle-label">
				<input type="checkbox" bind:checked={showFlow} />
				Show Current Flow
			</label>
		</div>

		<div class="button-group">
			<button class="btn btn-ghost" onclick={newGrid}>New Grid</button>
		</div>

		{#if result}
			<ResultsPanel title="IR Drop Analysis">
				<div class="result-row">
					<span class="result-label">Max IR Drop</span>
					<span class="result-value mono"
						>{(result.statistics.maxIRDrop * 1000).toFixed(2)} mV</span
					>
				</div>
				<div class="result-row">
					<span class="result-label">Min Voltage</span>
					<span class="result-value mono">{result.statistics.minVoltage.toFixed(4)} V</span>
				</div>
				<div class="result-row">
					<span class="result-label">Total Power Loss</span>
					<span class="result-value mono"
						>{(result.statistics.totalPowerLoss * 1000).toFixed(3)} mW</span
					>
				</div>
				<div class="result-row">
					<span class="result-label">Converged</span>
					<span class="result-value" class:text-green={result.converged} class:text-red={!result.converged}>
						{result.converged ? `Yes (${result.iterations} iter)` : 'No'}
					</span>
				</div>
				<div class="result-row">
					<span class="result-label">Active Sources</span>
					<span class="result-value">{activeSources.size}</span>
				</div>
			</ResultsPanel>

			<div class="heatmap-legend">
				<span class="legend-label">Low drop</span>
				<div class="heatmap-bar"></div>
				<span class="legend-label">High drop</span>
			</div>
		{/if}
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

	.hint {
		font-size: 0.8rem;
		color: var(--color-text-muted);
		margin: 0 0 0.5rem;
	}

	.source-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		max-height: 280px;
		overflow-y: auto;
	}

	.source-item {
		padding: 0.5rem 0.6rem;
		background: var(--color-bg-tertiary);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		transition: all 0.15s ease;
	}

	.source-item.active {
		border-color: var(--color-accent-red);
		background: rgba(248, 113, 113, 0.05);
	}

	.source-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.source-name {
		font-weight: 600;
		color: var(--color-accent-cyan);
	}

	.source-pos {
		color: var(--color-text-muted);
		font-size: 0.75rem;
	}

	.current-slider {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.4rem;
		padding-left: 1.5rem;
	}

	.current-slider input[type='range'] {
		flex: 1;
		accent-color: var(--color-accent-red);
	}

	.current-value {
		font-size: 0.75rem;
		color: var(--color-accent-amber);
		min-width: 48px;
		text-align: right;
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: var(--color-text-secondary);
		cursor: pointer;
		margin-bottom: 0.4rem;
	}

	.button-group {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
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

	.btn-ghost {
		background: transparent;
		color: var(--color-text-secondary);
		border: 1px solid var(--color-border);
	}

	.btn-ghost:hover {
		background: var(--color-bg-tertiary);
		color: var(--color-text-primary);
	}

	.result-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.3rem 0;
	}

	.result-label {
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

	.text-green {
		color: var(--color-accent-green);
	}

	.text-red {
		color: var(--color-accent-red);
	}

	.heatmap-legend {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}

	.legend-label {
		font-size: 0.7rem;
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	.heatmap-bar {
		flex: 1;
		height: 12px;
		border-radius: 4px;
		background: linear-gradient(to right, #34d399, #fbbf24, #f87171);
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
