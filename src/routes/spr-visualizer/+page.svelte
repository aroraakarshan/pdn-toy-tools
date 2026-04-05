<script lang="ts">
	import { onMount } from 'svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import ResultsPanel from '$lib/components/ResultsPanel.svelte';
	import PDNGrid3D from '$lib/three/PDNGrid3D.svelte';
	import {
		generateGrid,
		dijkstraSPR,
		yenKShortest,
		DEFAULT_CONFIG
	} from '$lib/engine';
	import type { Grid, Instance, Domain, PathResult } from '$lib/engine';

	const PATH_COLORS_HEX = ['#FF6B6B', '#4f8ff7', '#22c55e', '#fbbf24', '#a78bfa', '#f472b6', '#22d3ee', '#fb923c'];

	let grid = $state(generateGrid({ ...DEFAULT_CONFIG, seed: 42 }));
	let selectedSource = $state<Instance | null>(null);
	let selectedTarget = $state<Domain | null>(null);
	let paths = $state<PathResult[]>([]);
	let pathCount = $state(3);
	let animSpeed = $state(1.0);
	let animating = $state(false);
	let showHelp = $state(false);

	function handleInstanceClick(inst: Instance) {
		selectedSource = inst;
		paths = [];
	}

	function handleDomainClick(domain: Domain) {
		selectedTarget = domain;
		paths = [];
	}

	function selectSource(instId: string) {
		selectedSource = grid.instances.find((i) => i.id === instId) ?? null;
		paths = [];
	}

	function selectTarget(val: string) {
		if (val === 'auto') {
			selectedTarget = null;
			// Auto-find will pick nearest domain when finding path
			findPathAuto();
			return;
		}
		selectedTarget = grid.domains.find((d) => d.id === parseInt(val)) ?? null;
		paths = [];
	}

	function findPath() {
		if (!selectedSource) return;
		if (!selectedTarget) {
			findPathAuto();
			return;
		}
		const result = dijkstraSPR(grid, selectedSource, selectedTarget);
		if (result) {
			animating = true;
			paths = [result];
		}
	}

	function findPathAuto() {
		if (!selectedSource) return;
		// Find shortest path across ALL domains, pick the best
		let best: PathResult | null = null;
		let bestDomain: Domain | null = null;
		for (const domain of grid.domains) {
			const result = dijkstraSPR(grid, selectedSource, domain);
			if (result && (!best || result.totalResistance < best.totalResistance)) {
				best = result;
				bestDomain = domain;
			}
		}
		if (best && bestDomain) {
			selectedTarget = bestDomain;
			animating = true;
			paths = [best];
		}
	}

	function findAllPaths() {
		if (!selectedSource) return;
		if (!selectedTarget) {
			// Auto-detect best domain first
			let bestR = Infinity;
			let bestDomain: Domain | null = null;
			for (const domain of grid.domains) {
				const r = dijkstraSPR(grid, selectedSource, domain);
				if (r && r.totalResistance < bestR) {
					bestR = r.totalResistance;
					bestDomain = domain;
				}
			}
			if (bestDomain) selectedTarget = bestDomain;
			else return;
		}
		const results = yenKShortest(grid, selectedSource, selectedTarget!, pathCount);
		if (results.length > 0) {
			animating = true;
			paths = results;
		}
	}

	function handleAnimDone() {
		animating = false;
	}

	function reset() {
		selectedSource = null;
		selectedTarget = null;
		paths = [];
		animating = false;
	}

	function newGrid() {
		grid = generateGrid({ ...DEFAULT_CONFIG, seed: Math.floor(Math.random() * 100000) });
		reset();
	}
</script>

<svelte:head>
	<title>SPR Visualizer — PDN Toy Tools</title>
</svelte:head>

{#if showHelp}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={() => (showHelp = false)} onkeydown={(e) => e.key === 'Escape' && (showHelp = false)}>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
			<button class="modal-close" onclick={() => (showHelp = false)}>✕</button>
			<h2>What is SPR?</h2>
			<p>
				<strong>Shortest Path Resistance (SPR)</strong> measures the minimum resistance
				from a current-consuming instance to a power supply bump in the PDN.
			</p>
			<h3>The 3D Grid</h3>
			<ul>
				<li><strong>Metal traces</strong> (silver bars) — resistive connections between nodes</li>
				<li><strong>Bumps</strong> (colored cylinders rising up) — power supply from the package above</li>
				<li><strong>Instances</strong> (purple cubes) — circuit blocks that consume current</li>
				<li>Thicker/taller traces = lower resistance = better conductors</li>
			</ul>
			<h3>How to Use</h3>
			<ol>
				<li>Select a <strong>source instance</strong> (click a purple cube or use dropdown)</li>
				<li>Optionally pick a target domain, or leave on <strong>Auto</strong></li>
				<li>Click <strong>Find Shortest Path</strong> — watch it animate through the grid</li>
				<li>Rotate the 3D view by dragging. Scroll to zoom.</li>
			</ol>
			<h3>Why Bumps?</h3>
			<p>
				In a real chip, power comes from the package through <strong>C4 bumps</strong> (solder balls).
				Current flows from bumps → through the metal grid → to instances.
				SPR tells you how "far" (electrically) an instance is from its power supply.
			</p>
		</div>
	</div>
{/if}

<div class="tool-layout">
	<Sidebar title="SPR Controls">
		<div class="control-group">
			<div class="label-row">
				<span class="control-label">Source Instance</span>
				<button class="help-btn" onclick={() => (showHelp = true)} title="What is SPR?">?</button>
			</div>
			<select
				class="dropdown"
				value={selectedSource?.id ?? ''}
				onchange={(e) => selectSource((e.target as HTMLSelectElement).value)}
			>
				<option value="">— Click a cube on the grid —</option>
				{#each grid.instances as inst}
					<option value={inst.id}>
						Instance {inst.id.split('-')[1]} — ({inst.row},{inst.col}) — {inst.resistance.toFixed(3)}Ω
					</option>
				{/each}
			</select>
		</div>

		<div class="control-group">
			<span class="control-label">Target Domain</span>
			<select
				class="dropdown"
				value={selectedTarget?.id?.toString() ?? ''}
				onchange={(e) => selectTarget((e.target as HTMLSelectElement).value)}
			>
				<option value="">Auto (nearest domain)</option>
				{#each grid.domains as domain}
					<option value={domain.id.toString()}>
						{domain.name} — {domain.bumps.length} bumps
					</option>
				{/each}
			</select>
			<span class="hint">Leave on "Auto" to find the closest power supply</span>
		</div>

		<div class="control-group">
			<label class="control-label" for="path-count">
				Paths: <strong>{pathCount}</strong>
			</label>
			<input id="path-count" type="range" min="1" max="8" bind:value={pathCount} class="slider" />
		</div>

		<div class="control-group">
			<label class="control-label" for="anim-speed">
				Speed: <strong>{animSpeed.toFixed(1)}x</strong>
			</label>
			<input id="anim-speed" type="range" min="0.3" max="3" step="0.1" bind:value={animSpeed} class="slider" />
		</div>

		<div class="button-group">
			<button
				class="btn btn-primary"
				onclick={findPath}
				disabled={!selectedSource || animating}
			>
				⚡ Shortest Path
			</button>
			<button
				class="btn btn-accent"
				onclick={findAllPaths}
				disabled={!selectedSource || animating}
			>
				🔀 {pathCount} Paths
			</button>
		</div>

		<div class="button-group">
			<button class="btn btn-ghost" onclick={reset}>✕ Clear</button>
			<button class="btn btn-ghost" onclick={newGrid}>🔄 New Grid</button>
		</div>

		{#if animating}
			<div class="anim-badge"><span class="pulse-dot"></span> Animating…</div>
		{/if}

		{#if paths.length > 0 && !animating}
			<ResultsPanel title="Results">
				{#each paths as path, i}
					<div class="result-row">
						<span class="path-dot" style="background: {PATH_COLORS_HEX[i % PATH_COLORS_HEX.length]}"></span>
						<span class="result-label">Path {i + 1}</span>
						<span class="result-value mono">{path.totalResistance.toFixed(4)} Ω</span>
					</div>
					<div class="result-row sub">
						<span class="result-label">Current @ {grid.config.vdd}V</span>
						<span class="result-value mono">{(grid.config.vdd / path.totalResistance).toFixed(4)} A</span>
					</div>
					<div class="result-row sub">
						<span class="result-label">Hops</span>
						<span class="result-value">{path.path.length - 1}</span>
					</div>
				{/each}
			</ResultsPanel>
		{/if}

		<div class="legend">
			<h4 class="legend-title">Legend</h4>
			<div class="legend-item">
				<span class="legend-swatch" style="background: #22c55e"></span>
				Selected source (green)
			</div>
			<div class="legend-item">
				<span class="legend-swatch" style="background: #9B59B6; border-radius: 2px"></span>
				Instance
			</div>
			{#each grid.domains as domain}
				<div class="legend-item">
					<span class="legend-swatch" style="background: {domain.color}; border-radius: 50%"></span>
					{domain.name}
				</div>
			{/each}
		</div>

		<p class="tip">Drag to rotate · Scroll to zoom · Click cubes/bumps to select</p>
	</Sidebar>

	<div class="canvas-area">
		<PDNGrid3D
			{grid}
			{selectedSource}
			{selectedTarget}
			{paths}
			{animSpeed}
			onInstanceClick={handleInstanceClick}
			onDomainClick={handleDomainClick}
			onAnimationDone={handleAnimDone}
		/>
	</div>
</div>

<style>
	.tool-layout {
		display: flex;
		height: calc(100vh - var(--nav-height));
		overflow: hidden;
	}

	.canvas-area {
		flex: 1;
		min-width: 0;
	}

	.control-group {
		margin-bottom: 1rem;
	}

	.label-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.4rem;
	}

	.control-label {
		display: block;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-bottom: 0.4rem;
	}

	.label-row .control-label { margin-bottom: 0; }

	.help-btn {
		width: 22px; height: 22px;
		border-radius: 50%;
		border: 1px solid var(--color-border);
		background: var(--color-bg-tertiary);
		color: var(--color-text-muted);
		font-size: 0.75rem; font-weight: 700;
		cursor: pointer;
		display: flex; align-items: center; justify-content: center;
		transition: all 0.15s;
	}

	.help-btn:hover {
		border-color: var(--color-accent-blue);
		color: var(--color-accent-blue);
	}

	.dropdown {
		width: 100%;
		padding: 0.55rem 0.75rem;
		background: var(--color-bg-tertiary);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		color: var(--color-text-primary);
		font-size: 0.82rem;
		cursor: pointer;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%236b7294' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.75rem center;
		padding-right: 2rem;
	}

	.dropdown:focus {
		outline: none;
		border-color: var(--color-accent-blue);
	}

	.hint {
		display: block;
		font-size: 0.72rem;
		color: var(--color-text-muted);
		margin-top: 0.3rem;
		font-style: italic;
	}

	.slider { width: 100%; accent-color: var(--color-accent-blue); }

	.button-group {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.btn {
		flex: 1;
		padding: 0.6rem 0.5rem;
		border-radius: 6px; border: none;
		font-size: 0.78rem; font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.btn:disabled { opacity: 0.35; cursor: not-allowed; }

	.btn-primary { background: var(--color-accent-blue); color: #fff; }
	.btn-primary:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }

	.btn-accent { background: var(--color-accent-purple); color: #fff; }
	.btn-accent:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }

	.btn-ghost {
		background: transparent;
		color: var(--color-text-secondary);
		border: 1px solid var(--color-border);
	}
	.btn-ghost:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }

	.anim-badge {
		display: flex; align-items: center; gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: var(--color-bg-tertiary);
		border: 1px solid var(--color-accent-green);
		border-radius: 6px;
		font-size: 0.82rem; font-weight: 600;
		color: var(--color-accent-green);
		margin-bottom: 0.75rem;
	}

	.pulse-dot {
		width: 8px; height: 8px; border-radius: 50%;
		background: var(--color-accent-green);
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

	.result-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0; }
	.result-row.sub { padding-left: 1.25rem; font-size: 0.8rem; }

	.path-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

	.result-label { flex: 1; color: var(--color-text-secondary); font-size: 0.83rem; }
	.result-value { font-weight: 600; font-size: 0.83rem; }
	.mono { font-family: 'JetBrains Mono', monospace; }

	.legend {
		margin-top: 1.5rem; padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}

	.legend-title {
		font-size: 0.7rem; text-transform: uppercase;
		letter-spacing: 0.06em; color: var(--color-text-muted);
		margin: 0 0 0.5rem;
	}

	.legend-item {
		display: flex; align-items: center; gap: 0.5rem;
		font-size: 0.8rem; color: var(--color-text-secondary); padding: 0.2rem 0;
	}

	.legend-swatch { width: 12px; height: 12px; flex-shrink: 0; border-radius: 3px; }

	.tip {
		margin-top: 1rem;
		font-size: 0.72rem;
		color: var(--color-text-muted);
		text-align: center;
		line-height: 1.5;
	}

	/* Help Modal */
	.modal-overlay {
		position: fixed; inset: 0; z-index: 100;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		display: flex; align-items: center; justify-content: center;
		padding: 2rem;
	}

	.modal {
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 12px; padding: 2rem;
		max-width: 560px; width: 100%;
		max-height: 80vh; overflow-y: auto;
		position: relative;
	}

	.modal h2 { font-size: 1.3rem; margin: 0 0 1rem; color: var(--color-accent-blue); }
	.modal h3 { font-size: 1rem; margin: 1.25rem 0 0.5rem; }
	.modal p, .modal li { color: var(--color-text-secondary); font-size: 0.9rem; line-height: 1.7; }
	.modal ul, .modal ol { padding-left: 1.25rem; margin: 0.5rem 0; }
	.modal li { margin-bottom: 0.3rem; }

	.modal-close {
		position: absolute; top: 1rem; right: 1rem;
		background: none; border: none;
		color: var(--color-text-muted); font-size: 1.2rem; cursor: pointer;
	}
	.modal-close:hover { color: var(--color-text-primary); }

	@media (max-width: 768px) {
		.tool-layout { flex-direction: column; }
		.canvas-area { height: 50vh; }
	}
</style>
