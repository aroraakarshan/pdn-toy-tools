<script lang="ts">
	import IRDropGrid3D, { type PathStep } from '$lib/three/IRDropGrid3D.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import ResultsPanel from '$lib/components/ResultsPanel.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { generateGrid, solveIRDrop, DEFAULT_CONFIG } from '$lib/engine';
	import type { Grid, CurrentSource, IRDropResult, GridConfig } from '$lib/engine';

	// IR Drop needs few power supplies, many potential loads
	const IR_DROP_CONFIG: GridConfig = {
		...DEFAULT_CONFIG,
		numDomains: 1,
		bumpsPerDomain: [4, 4],   // just 4 bumps (power entry points)
		numInstances: 30,          // many potential loads across the grid
		seed: 42
	};

	let grid = $state(generateGrid(IR_DROP_CONFIG));
	let activeSources = $state<Map<string, number>>(new Map());
	let result = $state<IRDropResult | null>(null);
	let selectedLoadId = $state<string | null>(null);
	let pathSteps = $state<PathStep[] | null>(null);
	let showHeatmap = $state(true);
	let showFlow = $state(true);
	let showHelp = $state(false);
	let guideDismissed = $state(false);

	// Tooltip
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipText = $state('');

	// Monotonic tutorial progress — only moves forward, never back
	let tutorialProgress = $state(0); // 0→1→2→3→4

	const GUIDE_STEPS: Record<number, { step: number; total: number; icon: string; text: string }> = {
		0: { step: 1, total: 4, icon: '👇', text: 'Click a purple cube to activate a load — it will start drawing current from the power bumps through the wire mesh.' },
		1: { step: 2, total: 4, icon: '⚡', text: 'Load activated! Click the same cube again to inspect the V=IR path. Use the Current slider in the sidebar to increase the load.' },
		2: { step: 3, total: 4, icon: '🔍', text: 'The yellow path shows voltage dropping hop by hop — check the V=IR table in the sidebar! Try clicking loads far from bumps for bigger drops.' },
		3: { step: 4, total: 4, icon: '🌡️', text: 'Great! Try adding more loads to see how they affect each other. Toggle Heatmap in the sidebar to see voltage as wire color (green=good, red=drop).' }
	};

	let guideStep = $derived.by(() => {
		if (guideDismissed || tutorialProgress >= 4) return null;
		return GUIDE_STEPS[tutorialProgress] ?? null;
	});

	function toggleSource(instanceId: string) {
		const inst = grid.instances.find((i) => i.id === instanceId);
		if (!inst) return;

		const newMap = new Map(activeSources);
		if (newMap.has(instanceId)) {
			newMap.delete(instanceId);
		} else {
			newMap.set(instanceId, 50);
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

	function handleInstanceClick(inst: { id: string }) {
		if (activeSources.has(inst.id)) {
			// Already active — toggle selection for path view
			selectedLoadId = selectedLoadId === inst.id ? null : inst.id;
		} else {
			// Activate this load
			toggleSource(inst.id);
			// Advance tutorial forward (never backward)
			if (tutorialProgress === 0) tutorialProgress = 1;
			else if (activeSources.size >= 2 && tutorialProgress < 3) tutorialProgress = 3;
		}
	}

	function handleInstanceDblClick(inst: { id: string }) {
		if (activeSources.has(inst.id)) {
			// Deactivate load
			if (selectedLoadId === inst.id) selectedLoadId = null;
			toggleSource(inst.id);
		}
	}

	function handleNodeHover(info: { row: number; col: number; voltage: number; drop: number; resistance?: number; current?: number; segDrop?: number } | null) {
		if (info) {
			if (info.resistance !== undefined && info.current !== undefined) {
				// Wire hover — show V = I × R breakdown
				const rMΩ = (info.resistance * 1000).toFixed(0);
				const iMA = (info.current * 1000).toFixed(1);
				const dvMV = ((info.segDrop ?? 0) * 1000).toFixed(2);
				tooltipText = `Wire: R=${rMΩ}mΩ  I=${iMA}mA  ΔV = I×R = ${dvMV}mV`;
			} else {
				tooltipText = `Node (${info.row},${info.col}) — V: ${info.voltage.toFixed(4)}V — Drop: ${(info.drop * 1000).toFixed(1)}mV`;
			}
			tooltipVisible = true;
		} else {
			tooltipVisible = false;
		}
	}

	function newGrid() {
		grid = generateGrid({ ...IR_DROP_CONFIG, seed: Math.floor(Math.random() * 100000) });
		activeSources = new Map();
		result = null;
		selectedLoadId = null;
		pathSteps = null;
	}
</script>

<svelte:head>
	<title>3D IR Drop Visualizer — PDN Toy Tools</title>
</svelte:head>

{#if showHelp}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={() => (showHelp = false)} onkeydown={(e) => e.key === 'Escape' && (showHelp = false)}>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
<button class="modal-close" onclick={() => (showHelp = false)}>✕</button>
<h2>📘 What is IR Drop?</h2>
<p>
Every circuit on a chip needs electricity. Power enters through <strong>bumps</strong> (the colored cylinders on top
of the wire mesh) at a fixed supply voltage (e.g., 1.0V).
</p>
<p>
But wires aren't perfect — they resist the flow a little. When current passes through this resistance,
some voltage is lost along the way. This lost voltage is called <strong>IR Drop</strong>
(I × R = voltage drop). Think of it like water pressure dropping as it flows through a long, thin pipe.
</p>
<h3>What you'll see in the 3D view</h3>
<ol>
<li><strong>Wire mesh</strong> = the flat grid of power wires. Thicker wires = lower resistance (better conductors).</li>
<li><strong>Purple cubes</strong> below the mesh = circuit blocks (loads). Click them to make them draw power.</li>
<li><strong>Colored cylinders</strong> on top of the mesh = power supply bumps at full voltage.</li>
<li><strong>Green columns</strong> rising from each node = voltage level. Tall green = healthy, short red = bad drop.</li>
<li><strong>Hover any wire</strong> to see the V=IR math: resistance, current, and the voltage drop on that segment.</li>
<li><strong>Pulsing red ring</strong> = the worst IR drop location on the entire grid.</li>
<li><strong>Blue particles</strong> = current flowing through wires (faster = more current).</li>
</ol>
<h3>Why does this matter?</h3>
<p>
If voltage drops too much, circuits may run too slowly or produce incorrect results.
Chip designers must carefully plan the power network to keep voltage healthy everywhere — that's why
tools like this one exist!
</p>
<h3>🧪 Try this experiment</h3>
<p>
1. Notice all columns start tall and green — every node at full voltage.<br/>
2. Click a load <strong>near a bump</strong> — columns barely change (short path, low R).<br/>
3. Click a load <strong>far from any bump</strong> — watch columns shrink and turn red!<br/>
4. Increase the current slider — the drop gets worse. This is V=IR in action.
</p>
</div>
</div>
{/if}

<div class="tool-layout">
	<Sidebar title="3D IR Drop Visualizer">
		<div class="control-group">
			<div class="label-row">
				<span class="control-label">Active Loads</span>
				<button class="help-btn" onclick={() => (showHelp = true)} title="What is IR Drop?">?</button>
			</div>
			<p class="hint">Click purple cubes on the 3D grid to add loads (circuit blocks drawing power):</p>
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
					<span class="result-label">Active Loads</span>
					<span class="result-value">{activeSources.size}</span>
				</div>
			</ResultsPanel>

			<div class="heatmap-legend">
				<span class="legend-label">Low drop</span>
				<div class="heatmap-bar"></div>
				<span class="legend-label">High drop</span>
			</div>
		{/if}

		{#if pathSteps && pathSteps.length > 0}
		<div class="vir-panel">
			<h3>⚡ V = I × R — Path Breakdown</h3>
			<div class="path-table">
				<div class="path-header">
					<span>Segment</span><span>R (Ω)</span><span>I (mA)</span><span>ΔV (mV)</span><span>V after</span>
				</div>
				{#each pathSteps as step}
				<div class="path-row">
					<span class="seg-label">({step.fromR},{step.fromC})→({step.toR},{step.toC})</span>
					<span>{step.resistance.toFixed(3)}</span>
					<span>{(step.current * 1000).toFixed(1)}</span>
					<span class="drop-val">{(step.segmentDrop * 1000).toFixed(1)}</span>
					<span class="volt-val" style="color: {step.voltageAfter > 0.99 ? '#44ff66' : step.voltageAfter > 0.97 ? '#ffcc00' : '#ff4444'}">{step.voltageAfter.toFixed(4)}V</span>
				</div>
				{/each}
			</div>
			<div class="path-summary">
				Total drop: <strong>{(pathSteps.reduce((s, p) => s + p.segmentDrop, 0) * 1000).toFixed(1)} mV</strong> over {pathSteps.length} segments
			</div>
		</div>
		{/if}

		<!-- Narration panel -->
		{#if !result}
		<div class="narration">
			<div class="narr-step">
				<div class="narr-icon">💡</div>
				<div class="narr-body">
					<div class="narr-title">Ready to Explore</div>
					<div class="narr-explain">
						The grid represents a chip's power network. <strong>Colored cylinders</strong> on the mesh are power entry points (bumps at {grid.config.vdd}V).
						<strong>Purple cubes</strong> below are circuit blocks that can draw power.
						Right now, no blocks are drawing power, so voltage is healthy everywhere.
					</div>
					<div class="narr-text dim">
						Click a purple cube to place a load and watch the voltage landscape respond!
					</div>
				</div>
			</div>
		</div>
		{:else}
		<div class="narration">
			<div class="narr-step">
				<div class="narr-icon">{result.statistics.maxIRDrop > 0.05 ? '⚠️' : '✅'}</div>
				<div class="narr-body">
					<div class="narr-title">
						{result.statistics.maxIRDrop > 0.05 ? 'Significant Voltage Drop!' : 'Voltage Looks Healthy'}
					</div>
					<div class="narr-explain">
						{#if result.statistics.maxIRDrop > 0.05}
							The worst drop is <strong>{(result.statistics.maxIRDrop * 1000).toFixed(1)} mV</strong> — 
							look for red-tinted wires on the mesh; those areas aren't getting enough voltage.
							On a real chip, this could make circuits run incorrectly or too slowly.
							Try reducing the current or clicking a load to see its V=IR path breakdown.
						{:else}
							The worst drop is only <strong>{(result.statistics.maxIRDrop * 1000).toFixed(1)} mV</strong> — 
							the power network is handling this load well. Try adding more loads
							or increasing the current slider to see when things start going red!
						{/if}
					</div>
				</div>
			</div>
		</div>
		{/if}

		<p class="tip">Drag to rotate · Scroll to zoom · Click to activate/select · Double-click to deactivate</p>
	</Sidebar>

	<div class="canvas-area">
		{#if guideStep}
		<div class="guide-banner">
			<div class="guide-step-indicator">
				{#each [1, 2, 3, 4] as s, i}
					{#if i > 0}<span class="guide-line" class:done={guideStep.step > s - 1}></span>{/if}
					<span class="guide-dot" class:active={guideStep.step >= s} class:done={guideStep.step > s}></span>
				{/each}
			</div>
			<div class="guide-content">
				<span class="guide-icon">{guideStep.icon}</span>
				<span class="guide-text">Step {guideStep.step}/{guideStep.total}: {guideStep.text}</span>
			</div>
			<button class="guide-dismiss" onclick={() => guideDismissed = true} title="Dismiss">✕</button>
		</div>
		{/if}

		<div class="scene-legend">
			<div class="legend-item"><span class="legend-swatch wire-thick"></span> Thick wire = low R</div>
			<div class="legend-item"><span class="legend-swatch wire-thin"></span> Thin wire = high R</div>
			<div class="legend-item"><span class="legend-swatch" style="background:#66ffaa"></span> Green = healthy V</div>
			<div class="legend-item"><span class="legend-swatch" style="background:#ff6666"></span> Red = voltage drop</div>
			<div class="legend-item"><span class="legend-swatch" style="background:#44ccff; clip-path: polygon(50% 0%, 0% 100%, 100% 100%)"></span> Arrows = current direction</div>
			<div class="legend-item"><span class="legend-swatch" style="background:#fbbf24"></span> Yellow path = V=IR trace</div>
		</div>
		<IRDropGrid3D
			{grid}
			{result}
			{activeSources}
			{selectedLoadId}
			{showHeatmap}
			{showFlow}
			onInstanceClick={handleInstanceClick}
			onInstanceDblClick={handleInstanceDblClick}
			onNodeHover={handleNodeHover}
			onPathUpdate={(steps) => {
				pathSteps = steps;
				// Advance tutorial: 1→2 when path first appears
				if (steps && steps.length > 0 && tutorialProgress < 2) tutorialProgress = 2;
			}}
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
		min-width: 0;
		height: 100%;
		position: relative;
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
		}
	}

	/* Guide banner */
	.guide-banner {
		position: absolute; top: 1rem; left: 50%; transform: translateX(-50%);
		z-index: 20; display: flex; align-items: center; gap: 1rem;
		background: rgba(15, 17, 23, 0.92); backdrop-filter: blur(12px);
		border: 1px solid var(--color-accent-blue); border-radius: 12px;
		padding: 0.75rem 1.25rem; max-width: 90%; box-shadow: 0 0 24px rgba(79, 143, 247, 0.2);
		animation: guideSlideIn 0.4s ease-out;
	}
	@keyframes guideSlideIn {
		from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
		to   { opacity: 1; transform: translateX(-50%) translateY(0); }
	}
	.guide-step-indicator { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
	.guide-dot {
		width: 10px; height: 10px; border-radius: 50%;
		background: var(--color-bg-tertiary); border: 2px solid var(--color-border);
		transition: all 0.3s ease;
	}
	.guide-dot.active { border-color: var(--color-accent-blue); background: var(--color-accent-blue); box-shadow: 0 0 8px rgba(79, 143, 247, 0.5); }
	.guide-dot.done { border-color: var(--color-accent-green, #22c55e); background: var(--color-accent-green, #22c55e); }
	.guide-line { width: 16px; height: 2px; background: var(--color-border); transition: background 0.3s ease; }
	.guide-line.done { background: var(--color-accent-green, #22c55e); }
	.guide-content { display: flex; align-items: center; gap: 0.5rem; }
	.guide-icon { font-size: 1.3rem; }
	.guide-text { font-size: 0.9rem; color: var(--color-text-primary); font-weight: 500; }
	.guide-dismiss {
		background: none; border: none; color: var(--color-text-muted);
		cursor: pointer; font-size: 1rem; padding: 0.25rem; flex-shrink: 0;
		transition: color 0.15s;
	}
	.guide-dismiss:hover { color: var(--color-text-primary); }

	/* Modal */
	.modal-overlay {
		position: fixed; inset: 0; z-index: 200;
		background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px);
		display: flex; align-items: center; justify-content: center; padding: 1rem;
	}
	.modal {
		background: var(--color-bg-secondary, #1a1d27); border: 1px solid var(--color-border);
		border-radius: 16px; padding: 2rem; max-width: 560px; width: 100%;
		position: relative; max-height: 80vh; overflow-y: auto;
		color: var(--color-text-primary);
	}
	.modal h2 { margin: 0 0 1rem; font-size: 1.5rem; }
	.modal h3 { margin: 1.2rem 0 0.5rem; font-size: 1.1rem; color: var(--color-accent-blue); }
	.modal p, .modal li { font-size: 0.95rem; line-height: 1.7; color: var(--color-text-secondary); }
	.modal ol { padding-left: 1.2rem; }
	.modal-close {
		position: absolute; top: 1rem; right: 1rem; background: none; border: none;
		color: var(--color-text-muted); font-size: 1.2rem; cursor: pointer;
	}

	/* Narration */
	.narration { margin-top: 1rem; }
	.narr-step {
		display: flex; gap: 0.65rem; padding: 0.75rem;
		background: rgba(26, 29, 39, 0.8); border: 1px solid var(--color-border);
		border-radius: 10px;
	}
	.narr-icon { font-size: 1.3rem; flex-shrink: 0; }
	.narr-body { flex: 1; }
	.narr-title { font-weight: 700; font-size: 0.9rem; margin-bottom: 0.3rem; }
	.narr-text { font-size: 0.82rem; line-height: 1.55; color: var(--color-text-secondary); margin-bottom: 0.2rem; }
	.narr-text.dim { color: var(--color-text-muted); font-style: italic; }
	.narr-explain {
		font-size: 0.82rem; line-height: 1.6; color: var(--color-text-muted);
		background: rgba(79, 143, 247, 0.06); border-left: 2px solid var(--color-accent-blue);
		padding: 0.5rem 0.65rem; border-radius: 0 6px 6px 0; margin-bottom: 0.5rem;
	}

	.label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; }
	.label-row .control-label { margin-bottom: 0; }
	.help-btn {
		width: 22px; height: 22px; border-radius: 50%;
		border: 1px solid var(--color-border); background: var(--color-bg-tertiary);
		color: var(--color-text-muted); font-size: 0.84rem; font-weight: 700;
		cursor: pointer; display: flex; align-items: center; justify-content: center;
	}
	.help-btn:hover { border-color: var(--color-accent-blue); color: var(--color-accent-blue); }
	.tip {
		font-size: 0.75rem; color: var(--color-text-muted); text-align: center;
		margin-top: 0.75rem; font-style: italic;
	}

	/* V=IR Path Panel */
	.vir-panel {
		margin-top: 1rem;
		padding: 0.75rem;
		background: rgba(251, 191, 36, 0.08);
		border: 1px solid rgba(251, 191, 36, 0.3);
		border-radius: 8px;
	}
	.vir-panel h3 {
		margin: 0 0 0.5rem;
		font-size: 0.85rem;
		color: #fbbf24;
	}
	.path-table {
		font-size: 0.72rem;
		font-family: monospace;
	}
	.path-header {
		display: grid;
		grid-template-columns: 1.8fr 1fr 1fr 1fr 1.2fr;
		gap: 0.25rem;
		padding-bottom: 0.3rem;
		border-bottom: 1px solid rgba(255,255,255,0.1);
		color: #8899aa;
		font-weight: 600;
	}
	.path-row {
		display: grid;
		grid-template-columns: 1.8fr 1fr 1fr 1fr 1.2fr;
		gap: 0.25rem;
		padding: 0.15rem 0;
		color: #ccd;
	}
	.seg-label { color: #8899bb; }
	.drop-val { color: #ff6b6b; }
	.path-summary {
		margin-top: 0.5rem;
		font-size: 0.8rem;
		color: #ddd;
	}

	/* Scene legend */
	.scene-legend {
		position: absolute; bottom: 1rem; left: 1rem; z-index: 10;
		background: rgba(10, 14, 26, 0.85); backdrop-filter: blur(8px);
		border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
		padding: 0.5rem 0.7rem; font-size: 0.72rem; color: #aabbcc;
		display: flex; flex-direction: column; gap: 0.25rem;
		pointer-events: none;
	}
	.legend-item { display: flex; align-items: center; gap: 0.4rem; }
	.legend-swatch {
		width: 18px; height: 6px; border-radius: 2px; flex-shrink: 0;
	}
	.wire-thick { background: #8eaacc; height: 8px; }
	.wire-thin { background: #8eaacc; height: 3px; }
</style>
