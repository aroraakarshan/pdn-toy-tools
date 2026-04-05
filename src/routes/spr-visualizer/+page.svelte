<script lang="ts">
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
let showWinner = $state(false);

// ── Narration state ──
type NarrationPhase = 'idle' | 'intro' | 'tracing' | 'pathDone' | 'allDone';
let narrationPhase = $state<NarrationPhase>('idle');
let narrationPathIdx = $state(0);
let narrationTotalPaths = $state(0);
let narrationSegR = $state(0);
let narrationRunning = $state(0);
let narrationFinalR = $state(0);
let completedPathResistances = $state<number[]>([]);

function handleInstanceClick(inst: Instance) {
selectedSource = inst;
paths = [];
showWinner = false;
narrationPhase = 'idle';
completedPathResistances = [];
}

function handleDomainClick(domain: Domain) {
selectedTarget = domain;
paths = [];
showWinner = false;
narrationPhase = 'idle';
completedPathResistances = [];
}

function selectSource(instId: string) {
selectedSource = grid.instances.find((i) => i.id === instId) ?? null;
paths = [];
showWinner = false;
narrationPhase = 'idle';
completedPathResistances = [];
}

function selectTarget(val: string) {
if (val === 'auto') {
selectedTarget = null;
findPathAuto();
return;
}
selectedTarget = grid.domains.find((d) => d.id === parseInt(val)) ?? null;
paths = [];
showWinner = false;
narrationPhase = 'idle';
completedPathResistances = [];
}

function findPath() {
if (!selectedSource) return;
showWinner = false;
completedPathResistances = [];
if (!selectedTarget) { findPathAuto(); return; }
const result = dijkstraSPR(grid, selectedSource, selectedTarget);
if (result) {
animating = true;
narrationPhase = 'intro';
narrationTotalPaths = 1;
paths = [result];
}
}

function findPathAuto() {
if (!selectedSource) return;
showWinner = false;
completedPathResistances = [];
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
narrationPhase = 'intro';
narrationTotalPaths = 1;
paths = [best];
}
}

function findAllPaths() {
if (!selectedSource) return;
showWinner = false;
completedPathResistances = [];
if (!selectedTarget) {
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
narrationPhase = 'intro';
narrationTotalPaths = results.length;
paths = results;
}
}

function handleAnimStep(step: { phase: string; pathIdx: number; totalPaths: number; segmentR?: number; runningTotal: number; finalR?: number }) {
narrationTotalPaths = step.totalPaths;

if (step.phase === 'started') {
narrationPhase = 'intro';
} else if (step.phase === 'tracing') {
narrationPhase = 'tracing';
narrationPathIdx = step.pathIdx;
narrationSegR = step.segmentR ?? 0;
narrationRunning = step.runningTotal;
} else if (step.phase === 'pathDone') {
narrationPhase = 'pathDone';
narrationPathIdx = step.pathIdx;
narrationFinalR = step.finalR ?? step.runningTotal;
completedPathResistances = [...completedPathResistances, narrationFinalR];
} else if (step.phase === 'allDone') {
narrationPhase = 'allDone';
}
}

function handleAnimDone() {
animating = false;
if (paths.length > 1) showWinner = true;
narrationPhase = 'allDone';
}

function reset() {
selectedSource = null;
selectedTarget = null;
paths = [];
animating = false;
showWinner = false;
narrationPhase = 'idle';
completedPathResistances = [];
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
<h2>What is Shortest Path Resistance (SPR)?</h2>
<p>
Imagine you need to deliver electricity from a power supply (bump) at the top
of a chip to a circuit (instance) at the bottom. The electricity must travel
through metal wires — and each wire has <strong>resistance</strong>.
</p>
<p>
There are <strong>many possible routes</strong> through the metal layers.
Each route adds up the resistance of every wire segment along the way.
<strong>SPR is the route with the lowest total resistance.</strong>
</p>
<h3>Why does it matter?</h3>
<p>
Resistance causes <strong>voltage drop</strong> (IR drop). If the path
resistance is too high, the circuit doesn't get enough voltage and may
malfunction. Finding the SPR tells us the <em>best-case</em> power delivery
to each circuit.
</p>
<h3>What you see in the 3D view</h3>
<ul>
<li><strong>Purple cubes (bottom)</strong> — Instances: circuits that need power</li>
<li><strong>Colored cylinders (top)</strong> — Bumps: power supply connections</li>
<li><strong>4 metal layers (M1–M4)</strong> — Wires the current travels through</li>
<li><strong>Gold particle</strong> — Traces the path, adding up resistance</li>
<li><strong>Floating numbers</strong> — Resistance of each wire segment</li>
</ul>
<h3>How to use</h3>
<ol>
<li>Pick a source instance (purple cube) and a target domain</li>
<li>Click <strong>"Compare K Paths"</strong> to find multiple routes</li>
<li>Watch the gold particle trace each route, showing resistance at each step</li>
<li>See which route has the <strong>lowest total resistance = SPR</strong></li>
</ol>
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
<option value="">— Click a purple cube on the grid —</option>
{#each grid.instances as inst}
<option value={inst.id}>
I{inst.id.split('-')[1]} — ({inst.row},{inst.col}) — {inst.resistance.toFixed(3)}Ω
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
</div>

<div class="control-group">
<label class="control-label" for="path-count">
Paths to compare: <strong>{pathCount}</strong>
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
<button class="btn btn-primary" onclick={findPath} disabled={!selectedSource || animating}>
⚡ Shortest Path
</button>
<button class="btn btn-accent" onclick={findAllPaths} disabled={!selectedSource || animating}>
🔀 Compare {pathCount} Paths
</button>
</div>

<div class="button-group">
<button class="btn btn-ghost" onclick={reset}>✕ Clear</button>
<button class="btn btn-ghost" onclick={newGrid}>🔄 New Grid</button>
</div>

<!-- ── NARRATION PANEL — the teaching engine ── -->
{#if narrationPhase !== 'idle'}
<div class="narration">
{#if narrationPhase === 'intro'}
<div class="narr-step">
<div class="narr-icon">🔍</div>
<div class="narr-body">
<div class="narr-title">Finding routes from Instance to Bump</div>
<div class="narr-text">
We need to find how current travels from
<strong style="color:#22c55e">{selectedSource?.id}</strong>
(bottom) through the metal layers up to a
<strong style="color:{selectedTarget?.color ?? '#fff'}">{selectedTarget?.name ?? 'power supply'}</strong>
bump (top).
</div>
<div class="narr-text dim">
Each wire segment has resistance. We're looking for the path
with the <strong>lowest total resistance</strong> — that's the SPR.
</div>
</div>
</div>
{:else if narrationPhase === 'tracing'}
<div class="narr-step">
<div class="narr-icon" style="color:{PATH_COLORS_HEX[narrationPathIdx % PATH_COLORS_HEX.length]}">📐</div>
<div class="narr-body">
<div class="narr-title">Tracing Path {narrationPathIdx + 1} of {narrationTotalPaths}</div>
<div class="narr-meter">
<div class="narr-meter-label">Running total:</div>
<div class="narr-meter-value">{narrationRunning.toFixed(4)} Ω</div>
<div class="narr-meter-bar">
<div class="narr-meter-fill"
style="width: {Math.min(100, (narrationRunning / 0.8) * 100)}%;
background: {PATH_COLORS_HEX[narrationPathIdx % PATH_COLORS_HEX.length]}">
</div>
</div>
</div>
{#if narrationSegR > 0}
<div class="narr-text dim">
Last segment added: +{narrationSegR.toFixed(4)} Ω
</div>
{/if}
<div class="narr-text dim">
Each segment's resistance adds to the total path cost.
</div>
</div>
</div>
{:else if narrationPhase === 'pathDone'}
<div class="narr-step">
<div class="narr-icon">✅</div>
<div class="narr-body">
<div class="narr-title">Path {narrationPathIdx + 1} complete</div>
<div class="narr-text">
Total resistance:
<strong style="color:{PATH_COLORS_HEX[narrationPathIdx % PATH_COLORS_HEX.length]}">
{narrationFinalR.toFixed(4)} Ω
</strong>
</div>
{#if completedPathResistances.length > 1}
<div class="narr-text dim">
Comparing so far:
{#each completedPathResistances as r, i}
<span style="color:{PATH_COLORS_HEX[i % PATH_COLORS_HEX.length]}">
P{i+1}={r.toFixed(3)}Ω{i < completedPathResistances.length - 1 ? ' vs ' : ''}
</span>
{/each}
</div>
{/if}
{#if narrationPathIdx + 1 < narrationTotalPaths}
<div class="narr-text dim">
Trying next route to see if we can find lower resistance…
</div>
{/if}
</div>
</div>
{:else if narrationPhase === 'allDone'}
<div class="narr-step winner-step">
<div class="narr-icon">⭐</div>
<div class="narr-body">
<div class="narr-title">SPR Found!</div>
{#if paths.length === 1}
<div class="narr-text">
The shortest path resistance is
<strong style="color:#ffd700">{paths[0].totalResistance.toFixed(4)} Ω</strong>.
</div>
<div class="narr-text dim">
This is the minimum resistance from this instance to its nearest power supply.
Lower resistance = less voltage drop = better power delivery.
</div>
{:else}
<div class="narr-text">
We compared <strong>{paths.length} different routes</strong>. The one with
the <strong>lowest total resistance wins</strong>:
</div>
<div class="narr-comparison">
{#each paths as path, i}
<div class="narr-row" class:narr-winner={i === 0}>
<span class="narr-dot" style="background:{PATH_COLORS_HEX[i % PATH_COLORS_HEX.length]}"></span>
<span class="narr-path-label">Path {i + 1}</span>
<span class="narr-path-r">{path.totalResistance.toFixed(4)} Ω</span>
{#if i === 0}
<span class="narr-badge">SPR ⭐</span>
{:else}
<span class="narr-diff">+{(path.totalResistance - paths[0].totalResistance).toFixed(4)}</span>
{/if}
</div>
{/each}
</div>
<div class="narr-text dim">
Path 1 is the <strong>Shortest Path Resistance</strong> —
it has {((1 - paths[0].totalResistance / paths[paths.length - 1].totalResistance) * 100).toFixed(1)}%
less resistance than the worst route.
</div>
{/if}
</div>
</div>
{/if}
</div>
{/if}

{#if paths.length > 0 && !animating}
<div class="legend">
<h4 class="legend-title">Metal Stack (bottom → top)</h4>
<div class="legend-item">
<span class="legend-swatch" style="background: #9B59B6; border-radius: 2px"></span>
Instances (bottom)
</div>
<div class="legend-item">
<span class="legend-swatch" style="background: #e85d3a"></span>
M1 — Horizontal (copper)
</div>
<div class="legend-item">
<span class="legend-swatch" style="background: #3dc4c4"></span>
M2 — Vertical (copper)
</div>
<div class="legend-item">
<span class="legend-swatch" style="background: #d4a017"></span>
M3 — Horizontal (aluminum)
</div>
<div class="legend-item">
<span class="legend-swatch" style="background: #7b68ee"></span>
M4 — Vertical (aluminum)
</div>
{#each grid.domains as domain}
<div class="legend-item">
<span class="legend-swatch" style="background: {domain.color}; border-radius: 50%"></span>
{domain.name} bumps (top)
</div>
{/each}
</div>
{:else}
<div class="legend">
<h4 class="legend-title">What is SPR?</h4>
<p class="spr-explainer">
<strong>Shortest Path Resistance</strong> finds the route with the
lowest total resistance from an instance (circuit at bottom)
to a power bump (supply at top) through the metal layers.
</p>
<p class="spr-explainer dim">
Select an instance and click "Compare Paths" to see it in action.
</p>
</div>
{/if}

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
onAnimationStep={handleAnimStep}
/>
</div>
</div>

<style>
.tool-layout {
display: flex;
height: calc(100vh - var(--nav-height));
overflow: hidden;
}

.canvas-area { flex: 1; min-width: 0; }
.control-group { margin-bottom: 1rem; }

.label-row {
display: flex; justify-content: space-between;
align-items: center; margin-bottom: 0.4rem;
}

.control-label {
display: block; font-size: 0.78rem; font-weight: 600;
color: var(--color-text-muted); text-transform: uppercase;
letter-spacing: 0.04em; margin-bottom: 0.4rem;
}
.label-row .control-label { margin-bottom: 0; }

.help-btn {
width: 22px; height: 22px; border-radius: 50%;
border: 1px solid var(--color-border);
background: var(--color-bg-tertiary);
color: var(--color-text-muted);
font-size: 0.75rem; font-weight: 700; cursor: pointer;
display: flex; align-items: center; justify-content: center;
transition: all 0.15s;
}
.help-btn:hover { border-color: var(--color-accent-blue); color: var(--color-accent-blue); }

.dropdown {
width: 100%; padding: 0.55rem 0.75rem;
background: var(--color-bg-tertiary);
border: 1px solid var(--color-border);
border-radius: 6px; color: var(--color-text-primary);
font-size: 0.82rem; cursor: pointer; appearance: none;
background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%236b7294' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");
background-repeat: no-repeat; background-position: right 0.75rem center;
padding-right: 2rem;
}
.dropdown:focus { outline: none; border-color: var(--color-accent-blue); }

.slider { width: 100%; accent-color: var(--color-accent-blue); }
.button-group { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }

.btn {
flex: 1; padding: 0.6rem 0.5rem;
border-radius: 6px; border: none;
font-size: 0.78rem; font-weight: 600;
cursor: pointer; transition: all 0.15s ease; white-space: nowrap;
}
.btn:disabled { opacity: 0.35; cursor: not-allowed; }
.btn-primary { background: var(--color-accent-blue); color: #fff; }
.btn-primary:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
.btn-accent { background: var(--color-accent-purple); color: #fff; }
.btn-accent:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
.btn-ghost { background: transparent; color: var(--color-text-secondary); border: 1px solid var(--color-border); }
.btn-ghost:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }

/* ── Narration panel ── */
.narration {
margin-bottom: 0.75rem;
border: 1px solid var(--color-border);
border-radius: 8px;
background: var(--color-bg-tertiary);
overflow: hidden;
}

.narr-step {
display: flex; gap: 0.6rem;
padding: 0.75rem;
}

.narr-step.winner-step {
background: rgba(255, 215, 0, 0.05);
border-top: 2px solid rgba(255, 215, 0, 0.3);
}

.narr-icon { font-size: 1.2rem; flex-shrink: 0; margin-top: 0.1rem; }
.narr-body { flex: 1; min-width: 0; }
.narr-title { font-size: 0.82rem; font-weight: 700; color: var(--color-text-primary); margin-bottom: 0.3rem; }
.narr-text { font-size: 0.78rem; line-height: 1.55; color: var(--color-text-secondary); margin-bottom: 0.25rem; }
.narr-text.dim { color: var(--color-text-muted); font-size: 0.74rem; font-style: italic; }

/* Running total meter */
.narr-meter { margin: 0.4rem 0; }
.narr-meter-label { font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.narr-meter-value { font-size: 1.1rem; font-weight: 800; color: var(--color-text-primary); font-family: 'JetBrains Mono', monospace; }
.narr-meter-bar {
height: 6px; background: var(--color-bg-secondary);
border-radius: 3px; margin-top: 0.3rem; overflow: hidden;
}
.narr-meter-fill {
height: 100%; border-radius: 3px;
transition: width 0.15s ease;
}

/* Comparison table */
.narr-comparison { margin: 0.4rem 0; }
.narr-row {
display: flex; align-items: center; gap: 0.4rem;
padding: 0.25rem 0.4rem; font-size: 0.78rem; border-radius: 4px;
}
.narr-row.narr-winner {
background: rgba(255, 215, 0, 0.08);
font-weight: 700;
}
.narr-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.narr-path-label { color: var(--color-text-secondary); }
.narr-path-r { flex: 1; text-align: right; font-family: 'JetBrains Mono', monospace; color: var(--color-text-primary); }
.narr-badge { font-size: 0.68rem; font-weight: 800; color: #ffd700; }
.narr-diff { font-size: 0.7rem; color: var(--color-text-muted); font-family: 'JetBrains Mono', monospace; }

/* Legend */
.legend {
margin-top: 1rem; padding-top: 0.75rem;
border-top: 1px solid var(--color-border);
}
.legend-title {
font-size: 0.7rem; text-transform: uppercase;
letter-spacing: 0.06em; color: var(--color-text-muted);
margin: 0 0 0.5rem;
}
.legend-item {
display: flex; align-items: center; gap: 0.5rem;
font-size: 0.78rem; color: var(--color-text-secondary); padding: 0.15rem 0;
}
.legend-swatch { width: 12px; height: 12px; flex-shrink: 0; border-radius: 3px; }

.spr-explainer {
font-size: 0.8rem; line-height: 1.6;
color: var(--color-text-secondary); margin: 0 0 0.4rem;
}
.spr-explainer.dim { color: var(--color-text-muted); font-size: 0.76rem; font-style: italic; }

.tip {
margin-top: 0.75rem; font-size: 0.72rem;
color: var(--color-text-muted); text-align: center; line-height: 1.5;
}

/* Help modal */
.modal-overlay {
position: fixed; inset: 0; z-index: 100;
background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px);
display: flex; align-items: center; justify-content: center; padding: 2rem;
}
.modal {
background: var(--color-bg-secondary);
border: 1px solid var(--color-border);
border-radius: 12px; padding: 2rem;
max-width: 600px; width: 100%;
max-height: 80vh; overflow-y: auto; position: relative;
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
