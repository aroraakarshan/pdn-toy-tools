<script lang="ts">
import Sidebar from '$lib/components/Sidebar.svelte';
import PDNGrid3D from '$lib/three/PDNGrid3D.svelte';
import {
generateGrid,
dijkstraToAllBumps,
DEFAULT_CONFIG
} from '$lib/engine';
import type { Grid, Instance, Domain, PathResult } from '$lib/engine';

const PATH_COLORS_HEX = ['#FF6B6B', '#4f8ff7', '#22c55e', '#fbbf24', '#a78bfa', '#f472b6', '#22d3ee', '#fb923c'];

let grid = $state(generateGrid({ ...DEFAULT_CONFIG, seed: 42 }));
let selectedSource = $state<Instance | null>(null);
let selectedTarget = $state<Domain | null>(null);
let paths = $state<PathResult[]>([]);
let animSpeed = $state(1.0);
let animating = $state(false);
let showHelp = $state(false);

// Narration
type Phase = 'idle' | 'intro' | 'racing' | 'done';
let phase = $state<Phase>('idle');
let doneCount = $state(0);
let totalBumps = $state(0);
let donePaths = $state<{label: string; r: number; idx: number}[]>([]);

function handleInstanceClick(inst: Instance) {
selectedSource = inst;
paths = []; phase = 'idle'; donePaths = [];
}

function handleDomainClick(domain: Domain) {
selectedTarget = domain;
paths = []; phase = 'idle'; donePaths = [];
}

function selectSource(instId: string) {
selectedSource = grid.instances.find((i) => i.id === instId) ?? null;
paths = []; phase = 'idle'; donePaths = [];
}

function selectTarget(domainId: string) {
selectedTarget = grid.domains.find((d) => d.id === parseInt(domainId)) ?? null;
paths = []; phase = 'idle'; donePaths = [];
}

function runSPR() {
if (!selectedSource || !selectedTarget) return;
const allBumpPaths = dijkstraToAllBumps(grid, selectedSource, selectedTarget);
if (!allBumpPaths.length) return;

totalBumps = allBumpPaths.length;
doneCount = 0;
donePaths = [];
phase = 'intro';
animating = true;
paths = allBumpPaths;
}

function autoRun() {
if (!selectedSource) return;
// Find best domain
let bestR = Infinity;
let bestDomain: Domain | null = null;
for (const domain of grid.domains) {
const bp = dijkstraToAllBumps(grid, selectedSource, domain);
if (bp.length > 0 && bp[0].totalResistance < bestR) {
bestR = bp[0].totalResistance;
bestDomain = domain;
}
}
if (bestDomain) {
selectedTarget = bestDomain;
// Small delay so the target selection renders before paths trigger
setTimeout(() => runSPR(), 50);
}
}

function handleAnimStep(step: { phase: string; pathIdx: number; totalPaths: number; segmentR?: number; runningTotal: number; finalR?: number }) {
if (step.phase === 'started') {
phase = 'racing';
} else if (step.phase === 'pathDone') {
doneCount = step.pathIdx + 1;
const p = paths[step.pathIdx];
if (p) {
donePaths = [...donePaths, {
label: p.bumpLabel ?? `Bump ${step.pathIdx + 1}`,
r: p.totalResistance,
idx: step.pathIdx
}].sort((a, b) => a.r - b.r);
}
} else if (step.phase === 'allDone') {
phase = 'done';
}
}

function handleAnimDone() {
animating = false;
phase = 'done';
}

function reset() {
selectedSource = null; selectedTarget = null;
paths = []; animating = false;
phase = 'idle'; donePaths = []; doneCount = 0;
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
<h2>What is SPR (Shortest Path Resistance)?</h2>
<p>
A chip needs electricity. Power comes from <strong>bumps</strong> at the top
and flows down through metal wires to <strong>instances</strong> (circuits) at the bottom.
</p>
<p>
Each wire has <strong>resistance</strong>. There are many bumps and many possible
routes. <strong>SPR finds the route with the lowest total resistance</strong> — the
path where current flows most easily.
</p>
<h3>What the animation shows</h3>
<ol>
<li>You pick an instance (circuit that needs power)</li>
<li>The tool finds paths to <strong>every bump</strong> in the target domain</li>
<li><strong>All paths animate simultaneously</strong> — a race through the metal layers</li>
<li>Each path ends at a different bump with its total resistance labeled</li>
<li>The <strong>winner glows</strong> — that's the SPR: the lowest-resistance route</li>
</ol>
<h3>Why it matters</h3>
<p>
Lower resistance → less voltage drop → the circuit gets cleaner power.
If SPR is too high, the chip may malfunction.
</p>
</div>
</div>
{/if}

<div class="tool-layout">
<Sidebar title="SPR Visualizer">
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
<option value="">— Click a purple cube —</option>
{#each grid.instances as inst}
<option value={inst.id}>
I{inst.id.split('-')[1]} at ({inst.row},{inst.col}) — {inst.resistance.toFixed(3)}Ω
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
<option value="">— Select domain —</option>
{#each grid.domains as domain}
<option value={domain.id.toString()}>
{domain.name} — {domain.bumps.length} bumps
</option>
{/each}
</select>
</div>

<div class="control-group">
<label class="control-label" for="anim-speed">
Speed: <strong>{animSpeed.toFixed(1)}x</strong>
</label>
<input id="anim-speed" type="range" min="0.3" max="3" step="0.1" bind:value={animSpeed} class="slider" />
</div>

<div class="button-group">
<button class="btn btn-primary" onclick={runSPR}
disabled={!selectedSource || !selectedTarget || animating}>
⚡ Find SPR to All Bumps
</button>
</div>
<div class="button-group">
<button class="btn btn-accent" onclick={autoRun}
disabled={!selectedSource || animating}>
🎯 Auto: Best Domain
</button>
</div>
<div class="button-group">
<button class="btn btn-ghost" onclick={reset}>✕ Clear</button>
<button class="btn btn-ghost" onclick={newGrid}>🔄 New Grid</button>
</div>
<div class="button-sep"></div>

<!-- ── NARRATION ── -->
<div class="narration">
{#if phase === 'idle'}
<div class="narr-step">
<div class="narr-icon">💡</div>
<div class="narr-body">
<div class="narr-title">How SPR Works</div>
<div class="narr-text">
<strong>Shortest Path Resistance</strong> answers: "What is the easiest
route for current to flow from this circuit to a power supply?"
</div>
<div class="narr-text dim">
Select an instance, pick a domain with bumps, then click
<strong>"Find SPR"</strong>. The tool will find paths to
<em>every bump</em> simultaneously and show you which one wins.
</div>
</div>
</div>
{:else if phase === 'intro'}
<div class="narr-step">
<div class="narr-icon">🔍</div>
<div class="narr-body">
<div class="narr-title">Searching {totalBumps} bumps in {selectedTarget?.name}…</div>
<div class="narr-text">
Instance <strong style="color:#22c55e">{selectedSource?.id}</strong> needs
power. The domain has <strong>{totalBumps} bumps</strong> it could
connect to. We'll find the path to each one — simultaneously.
</div>
<div class="narr-text dim">
Watch {totalBumps} colored paths race through the metal layers…
</div>
</div>
</div>
{:else if phase === 'racing'}
<div class="narr-step">
<div class="narr-icon">🏁</div>
<div class="narr-body">
<div class="narr-title">Racing to all {totalBumps} bumps…</div>
<div class="narr-meter-bar">
<div class="narr-meter-fill" style="width: {(doneCount / totalBumps) * 100}%"></div>
</div>
<div class="narr-text">{doneCount} of {totalBumps} paths complete</div>
{#if donePaths.length > 0}
<div class="narr-results">
{#each donePaths.slice(0, 5) as dp, i}
<div class="narr-row" class:narr-best={i === 0 && donePaths.length > 1}>
<span class="narr-dot" style="background:{PATH_COLORS_HEX[dp.idx % PATH_COLORS_HEX.length]}"></span>
<span class="narr-label">{dp.label}</span>
<span class="narr-r">{dp.r.toFixed(3)}Ω</span>
{#if i === 0 && donePaths.length > 1}
<span class="narr-best-tag">best so far</span>
{/if}
</div>
{/each}
{#if donePaths.length > 5}
<div class="narr-text dim">+{donePaths.length - 5} more…</div>
{/if}
</div>
{/if}
</div>
</div>
{:else if phase === 'done'}
<div class="narr-step winner-step">
<div class="narr-icon">⭐</div>
<div class="narr-body">
<div class="narr-title">SPR Found!</div>
{#if donePaths.length > 0}
<div class="narr-text">
Out of <strong>{donePaths.length} bumps</strong>, the path to
<strong style="color:#ffd700">{donePaths[0].label}</strong> has the
<strong>lowest total resistance</strong>:
</div>
<div class="narr-winner-value">{donePaths[0].r.toFixed(4)} Ω</div>
<div class="narr-text dim">That's the SPR — the best-case power delivery path.</div>

{#if donePaths.length > 1}
<div class="narr-comparison">
<div class="narr-text" style="font-weight:600; margin-top:0.5rem">All bumps ranked:</div>
{#each donePaths as dp, i}
<div class="narr-row" class:narr-winner={i === 0}>
<span class="narr-rank">{i + 1}.</span>
<span class="narr-dot" style="background:{PATH_COLORS_HEX[dp.idx % PATH_COLORS_HEX.length]}"></span>
<span class="narr-label">{dp.label}</span>
<span class="narr-r">{dp.r.toFixed(4)}Ω</span>
{#if i === 0}
<span class="narr-badge">SPR ⭐</span>
{:else}
<span class="narr-diff">+{(dp.r - donePaths[0].r).toFixed(4)}</span>
{/if}
</div>
{/each}
</div>
<div class="narr-text dim" style="margin-top:0.5rem">
The worst bump has {((1 - donePaths[0].r / donePaths[donePaths.length - 1].r) * 100).toFixed(1)}%
more resistance. Bump placement matters!
</div>
{/if}
{/if}
</div>
</div>
{/if}
</div>

<div class="legend">
<h4 class="legend-title">Metal Stack (bottom → top)</h4>
<div class="legend-item"><span class="legend-swatch" style="background: #9B59B6; border-radius: 2px"></span> Instances (bottom)</div>
<div class="legend-item"><span class="legend-swatch" style="background: #e85d3a"></span> M1 Horizontal</div>
<div class="legend-item"><span class="legend-swatch" style="background: #3dc4c4"></span> M2 Vertical</div>
<div class="legend-item"><span class="legend-swatch" style="background: #d4a017"></span> M3 Horizontal</div>
<div class="legend-item"><span class="legend-swatch" style="background: #7b68ee"></span> M4 Vertical</div>
{#each grid.domains as domain}
<div class="legend-item"><span class="legend-swatch" style="background: {domain.color}; border-radius: 50%"></span> {domain.name} bumps (top)</div>
{/each}
</div>
<p class="tip">Drag to rotate · Scroll to zoom · Click cubes/bumps</p>
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
.tool-layout { display: flex; height: calc(100vh - var(--nav-height)); overflow: hidden; }
.canvas-area { flex: 1; min-width: 0; }
.control-group { margin-bottom: 1rem; }
.label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; }
.control-label {
display: block; font-size: 0.78rem; font-weight: 600;
color: var(--color-text-muted); text-transform: uppercase;
letter-spacing: 0.04em; margin-bottom: 0.4rem;
}
.label-row .control-label { margin-bottom: 0; }
.help-btn {
width: 22px; height: 22px; border-radius: 50%;
border: 1px solid var(--color-border); background: var(--color-bg-tertiary);
color: var(--color-text-muted); font-size: 0.75rem; font-weight: 700;
cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.help-btn:hover { border-color: var(--color-accent-blue); color: var(--color-accent-blue); }
.dropdown {
width: 100%; padding: 0.55rem 0.75rem;
background: var(--color-bg-tertiary); border: 1px solid var(--color-border);
border-radius: 6px; color: var(--color-text-primary);
font-size: 0.82rem; cursor: pointer; appearance: none;
background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%236b7294' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");
background-repeat: no-repeat; background-position: right 0.75rem center; padding-right: 2rem;
}
.dropdown:focus { outline: none; border-color: var(--color-accent-blue); }
.slider { width: 100%; accent-color: var(--color-accent-blue); }
.button-group { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
.btn {
flex: 1; padding: 0.6rem 0.5rem; border-radius: 6px; border: none;
font-size: 0.78rem; font-weight: 600; cursor: pointer;
transition: all 0.15s ease; white-space: nowrap;
}
.btn:disabled { opacity: 0.35; cursor: not-allowed; }
.btn-primary { background: var(--color-accent-blue); color: #fff; }
.btn-primary:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
.btn-accent { background: var(--color-accent-purple); color: #fff; }
.btn-accent:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
.btn-ghost { background: transparent; color: var(--color-text-secondary); border: 1px solid var(--color-border); }
.btn-ghost:hover { background: var(--color-bg-tertiary); }
	.button-sep { height: 1px; background: var(--color-border); margin: 0.25rem 0 0.5rem; }

/* Narration */
.narration {
margin: 0.5rem 0; border: 1px solid var(--color-border);
border-radius: 8px; background: var(--color-bg-tertiary); overflow: hidden;
}
.narr-step { display: flex; gap: 0.6rem; padding: 0.75rem; }
.narr-step.winner-step { background: rgba(255, 215, 0, 0.04); border-top: 2px solid rgba(255, 215, 0, 0.25); }
.narr-icon { font-size: 1.1rem; flex-shrink: 0; }
.narr-body { flex: 1; min-width: 0; }
.narr-title { font-size: 0.82rem; font-weight: 700; color: var(--color-text-primary); margin-bottom: 0.3rem; }
.narr-text { font-size: 0.76rem; line-height: 1.55; color: var(--color-text-secondary); margin-bottom: 0.2rem; }
.narr-text.dim { color: var(--color-text-muted); font-size: 0.72rem; font-style: italic; }
.narr-meter-bar { height: 5px; background: var(--color-bg-secondary); border-radius: 3px; margin-bottom: 0.3rem; overflow: hidden; }
.narr-meter-fill { height: 100%; border-radius: 3px; background: var(--color-accent-green); transition: width 0.3s ease; }
.narr-results { margin-top: 0.4rem; }
.narr-comparison { margin-top: 0.3rem; }
.narr-row {
display: flex; align-items: center; gap: 0.35rem;
padding: 0.2rem 0.3rem; font-size: 0.76rem; border-radius: 4px;
}
.narr-row.narr-best { background: rgba(34,197,94, 0.08); }
.narr-row.narr-winner { background: rgba(255, 215, 0, 0.08); font-weight: 700; }
.narr-rank { color: var(--color-text-muted); font-size: 0.7rem; width: 1.2em; }
.narr-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.narr-label { color: var(--color-text-secondary); flex: 1; }
.narr-r { font-family: 'JetBrains Mono', monospace; color: var(--color-text-primary); font-size: 0.74rem; }
.narr-best-tag { font-size: 0.65rem; color: var(--color-accent-green); font-weight: 700; }
.narr-badge { font-size: 0.65rem; font-weight: 800; color: #ffd700; }
.narr-diff { font-size: 0.68rem; color: var(--color-text-muted); font-family: 'JetBrains Mono', monospace; }
.narr-winner-value {
font-size: 1.4rem; font-weight: 900; color: #ffd700;
font-family: 'JetBrains Mono', monospace;
margin: 0.3rem 0;
}

/* Legend */
.legend { margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid var(--color-border); }
.legend-title { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-muted); margin: 0 0 0.4rem; }
.legend-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.74rem; color: var(--color-text-secondary); padding: 0.12rem 0; }
.legend-swatch { width: 10px; height: 10px; flex-shrink: 0; border-radius: 2px; }
.tip { margin-top: 0.5rem; font-size: 0.7rem; color: var(--color-text-muted); text-align: center; }

/* Help modal */
.modal-overlay {
position: fixed; inset: 0; z-index: 100;
background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
display: flex; align-items: center; justify-content: center; padding: 2rem;
}
.modal {
background: var(--color-bg-secondary); border: 1px solid var(--color-border);
border-radius: 12px; padding: 2rem; max-width: 560px; width: 100%;
max-height: 80vh; overflow-y: auto; position: relative;
}
.modal h2 { font-size: 1.2rem; margin: 0 0 0.75rem; color: var(--color-accent-blue); }
.modal h3 { font-size: 0.95rem; margin: 1rem 0 0.4rem; }
.modal p, .modal li { color: var(--color-text-secondary); font-size: 0.88rem; line-height: 1.7; }
.modal ol, .modal ul { padding-left: 1.2rem; margin: 0.4rem 0; }
.modal li { margin-bottom: 0.2rem; }
.modal-close { position: absolute; top: 1rem; right: 1rem; background: none; border: none; color: var(--color-text-muted); font-size: 1.2rem; cursor: pointer; }
.modal-close:hover { color: var(--color-text-primary); }

@media (max-width: 768px) {
.tool-layout { flex-direction: column; }
.canvas-area { height: 50vh; }
}
</style>
