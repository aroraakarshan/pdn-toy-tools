<script lang="ts">
import Sidebar from '$lib/components/Sidebar.svelte';
import PDNGrid3D from '$lib/three/PDNGrid3D.svelte';
import {
generateGrid,
dijkstraToAllBumps,
getEdgeResistance,
DEFAULT_CONFIG
} from '$lib/engine';
import type { Grid, Instance, Domain, PathResult } from '$lib/engine';

const PATH_COLORS_HEX = ['#FF6B6B', '#4f8ff7', '#22c55e', '#fbbf24', '#a78bfa', '#f472b6', '#22d3ee', '#fb923c'];
const LAYER_HORIZ = [true, false, true, false];
const LAYER_CSS = ['#e85d3a', '#3dc4c4', '#d4a017', '#7b68ee'];
const LAYER_SHORT = ['M1', 'M2', 'M3', 'M4'];

let grid = $state(generateGrid({ ...DEFAULT_CONFIG, seed: 42 }));
let selectedSource = $state<Instance | null>(null);
let selectedTarget = $state<Domain | null>(null);
let paths = $state<PathResult[]>([]);
let animSpeed = $state(1.0);
let animating = $state(false);
let showHelp = $state(false);
let followMode = $state(false);
let followingPath = $state<{idx: number; label: string; r: number} | null>(null);
let breakdownIdx = $state<number | null>(null);
let guideDismissed = $state(false);

// Guided onboarding step
let guideStep = $derived.by(() => {
if (guideDismissed) return null;
if (!selectedSource) return { step: 1, total: 4, icon: '👇', text: 'Click a purple cube at the bottom — that\'s an instance (circuit that needs power)' };
if (!selectedTarget) return { step: 2, total: 4, icon: '👆', text: 'Now click a colored sphere at the top — that\'s a bump (power supply domain)' };
if (phase === 'idle' && paths.length === 0) return { step: 3, total: 4, icon: '⚡', text: 'Hit "Find SPR to All Bumps" in the sidebar to trace the shortest resistance path' };
if (phase === 'done' && !followMode) return { step: 4, total: 4, icon: '🎥', text: 'Enable "Follow Path Camera" in the sidebar, then click any path tube to fly along it' };
return null;
});

interface Segment {
layer: string;
layerColor: string;
dir: string;
from: string;
to: string;
resistance: number;
cumulative: number;
}

function computeBreakdown(pathIdx: number): Segment[] {
const p = paths[pathIdx];
if (!p) return [];
const segs: Segment[] = [];
let cumR = 0;
let currentLayer = 0;

for (let i = 1; i < p.path.length; i++) {
const prev = p.path[i - 1];
const curr = p.path[i];
const isHoriz = curr.row === prev.row;

// Track layer (upward only, matching pathTo3D logic)
if (isHoriz !== LAYER_HORIZ[currentLayer]) {
for (let L = currentLayer + 1; L < 4; L++) {
if (LAYER_HORIZ[L] === isHoriz) { currentLayer = L; break; }
}
}

const res = getEdgeResistance(grid, prev.row, prev.col, curr.row, curr.col);
if (res === null) continue;
cumR += res;

segs.push({
layer: LAYER_SHORT[currentLayer],
layerColor: LAYER_CSS[currentLayer],
dir: isHoriz ? '→' : '↓',
from: `(${prev.row},${prev.col})`,
to: `(${curr.row},${curr.col})`,
resistance: res,
cumulative: cumR
});
}
return segs;
}

function toggleBreakdown(pathIdx: number) {
breakdownIdx = breakdownIdx === pathIdx ? null : pathIdx;
}

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

function handlePathClick(idx: number, label: string, r: number) {
followingPath = { idx, label, r };
breakdownIdx = idx;
}

function reset() {
selectedSource = null; selectedTarget = null;
paths = []; animating = false;
phase = 'idle'; donePaths = []; doneCount = 0;
followingPath = null;
breakdownIdx = null;
}

function newGrid() {
grid = generateGrid({ ...DEFAULT_CONFIG, seed: Math.floor(Math.random() * 100000) });
reset();
}
</script>

<svelte:head>
<title>3D SPR Visualizer — PDN Toy Tools</title>
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
<Sidebar title="3D SPR Visualizer">
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

<div class="control-group switch-group">
<label class="switch-row">
<span class="switch-text">🎥 Follow Path Camera</span>
<label class="switch">
<input type="checkbox" bind:checked={followMode} />
<span class="switch-slider"></span>
</label>
</label>
{#if followMode}
<div class="switch-hint">After animation completes, click any path tube to fly along it</div>
{/if}
{#if followingPath}
<div class="follow-badge">
Following: <strong>{followingPath.label}</strong> — {followingPath.r.toFixed(3)}Ω
</div>
{/if}
</div>

<!-- ── NARRATION ── -->
{#if phase === 'idle'}
<div class="narration">
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
</div>
{/if}

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
<PDNGrid3D
{grid}
{selectedSource}
{selectedTarget}
{paths}
{animSpeed}
{followMode}
onInstanceClick={handleInstanceClick}
onDomainClick={handleDomainClick}
onAnimationDone={handleAnimDone}
onAnimationStep={handleAnimStep}
onPathClick={handlePathClick}
/>

{#if phase !== 'idle'}
<div class="narr-overlay">
{#if phase === 'intro'}
<div class="narr-step">
<div class="narr-icon">🔍</div>
<div class="narr-body">
<div class="narr-title">Searching {totalBumps} bumps in {selectedTarget?.name}</div>
<div class="narr-text">
Finding path from
<strong style="color:#22c55e">{selectedSource?.id}</strong>
to each of <strong>{totalBumps} bumps</strong> simultaneously.
</div>
<div class="narr-explain">
Each <strong>ball</strong> represents current trying to reach a different power bump.
It travels upward through the metal stack (M1→M2→M3→M4) — the same path
real current takes in a chip.
</div>
</div>
</div>
{:else if phase === 'racing'}
<div class="narr-step">
<div class="narr-icon">🏁</div>
<div class="narr-body">
<div class="narr-title">Racing to {totalBumps} bumps — each ball is a different route</div>
<div class="narr-explain">
The balls travel through metal wires. Each wire segment has <strong>resistance</strong> —
longer wires and thinner layers have more. The ball that arrives first found
the <strong>lowest total resistance</strong> path.
</div>
<div class="narr-meter-bar">
<div class="narr-meter-fill" style="width: {(doneCount / totalBumps) * 100}%"></div>
</div>
<div class="narr-text">{doneCount} / {totalBumps} complete</div>
{#if donePaths.length > 0}
<div class="narr-results">
{#each donePaths.slice(0, 8) as dp, i}
<div class="narr-row" class:narr-best={i === 0 && donePaths.length > 1}>
<span class="narr-dot" style="background:{PATH_COLORS_HEX[dp.idx % PATH_COLORS_HEX.length]}"></span>
<span class="narr-label">{dp.label}</span>
<span class="narr-r">{dp.r.toFixed(3)}Ω</span>
{#if i === 0 && donePaths.length > 1}
<span class="narr-best-tag">best</span>
{/if}
</div>
{/each}
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
<div class="narr-explain">
The <strong style="color:#ffd700">golden path</strong> is the winner — it has the lowest total
resistance from the instance to a bump. In a real chip, this is where most current
would naturally flow. Lower resistance = less voltage drop = cleaner power delivery.
</div>
<div class="narr-winner-value">{donePaths[0].r.toFixed(4)} Ω</div>
<div class="narr-text">
<strong style="color:#ffd700">{donePaths[0].label}</strong> — lowest resistance of {donePaths.length} bumps.
</div>
{#if donePaths.length > 1}
<div class="narr-comparison">
{#each donePaths as dp, i}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="narr-row narr-row-click" class:narr-winner={i === 0} class:narr-row-active={breakdownIdx === dp.idx}
onclick={() => toggleBreakdown(dp.idx)} onkeydown={() => {}}>
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
<div class="narr-text dim">
{((1 - donePaths[0].r / donePaths[donePaths.length - 1].r) * 100).toFixed(1)}%
less resistance than worst path.
</div>
<div class="narr-text dim" style="margin-top:0.3rem">Click any path row to see resistance breakdown</div>
{/if}

<!-- Resistance Breakdown Panel -->
{#if breakdownIdx !== null}
{@const segs = computeBreakdown(breakdownIdx)}
{@const totalR = paths[breakdownIdx]?.totalResistance ?? 1}
{@const bLabel = paths[breakdownIdx]?.bumpLabel ?? ''}
<div class="breakdown-panel">
<div class="breakdown-header">
<span class="breakdown-title">🔬 Breakdown: {bLabel}</span>
<button class="breakdown-close" onclick={() => (breakdownIdx = null)}>✕</button>
</div>
<div class="breakdown-bar">
{#each segs as seg}
<div class="breakdown-bar-seg"
style="width:{(seg.resistance / totalR) * 100}%;background:{seg.layerColor}"
title="{seg.layer}: {seg.resistance.toFixed(3)}Ω ({((seg.resistance/totalR)*100).toFixed(0)}%)">
</div>
{/each}
</div>
<div class="breakdown-legend-row">
{#each ['M1','M2','M3','M4'] as lbl, li}
<span class="breakdown-legend-chip">
<span class="bd-chip-dot" style="background:{LAYER_CSS[li]}"></span>{lbl}
</span>
{/each}
</div>
<div class="breakdown-table">
{#each segs as seg, i}
<div class="bd-row">
<span class="bd-num">{i+1}</span>
<span class="bd-chip" style="background:{seg.layerColor}">{seg.layer}</span>
<span class="bd-dir">{seg.dir}</span>
<span class="bd-coords">{seg.from}{seg.dir}{seg.to}</span>
<span class="bd-r">{seg.resistance.toFixed(3)}</span>
<span class="bd-cum">Σ {seg.cumulative.toFixed(3)}</span>
</div>
{/each}
</div>
<div class="breakdown-total">
Total: <strong>{totalR.toFixed(4)} Ω</strong> across {segs.length} segments
</div>
</div>
{/if}
{/if}
</div>
</div>
{/if}
</div>
{/if}
</div>
</div>

<style>
.tool-layout { display: flex; height: calc(100vh - var(--nav-height)); overflow: hidden; }
.canvas-area { flex: 1; min-width: 0; position: relative; }

/* Guided onboarding banner */
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

.control-group { margin-bottom: 1rem; }
.label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; }
.control-label {
display: block; font-size: 0.88rem; font-weight: 600;
color: var(--color-text-muted); text-transform: uppercase;
letter-spacing: 0.04em; margin-bottom: 0.4rem;
}
.label-row .control-label { margin-bottom: 0; }
.help-btn {
width: 22px; height: 22px; border-radius: 50%;
border: 1px solid var(--color-border); background: var(--color-bg-tertiary);
color: var(--color-text-muted); font-size: 0.84rem; font-weight: 700;
cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.help-btn:hover { border-color: var(--color-accent-blue); color: var(--color-accent-blue); }
.dropdown {
width: 100%; padding: 0.55rem 0.75rem;
background: var(--color-bg-tertiary); border: 1px solid var(--color-border);
border-radius: 6px; color: var(--color-text-primary);
font-size: 0.9rem; cursor: pointer; appearance: none;
background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%236b7294' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");
background-repeat: no-repeat; background-position: right 0.75rem center; padding-right: 2rem;
}
.dropdown:focus { outline: none; border-color: var(--color-accent-blue); }
.slider { width: 100%; accent-color: var(--color-accent-blue); }
.button-group { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
.btn {
flex: 1; padding: 0.6rem 0.5rem; border-radius: 6px; border: none;
font-size: 0.88rem; font-weight: 600; cursor: pointer;
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

/* Follow mode toggle */
.switch-group { margin-top: 0.25rem; }
.switch-row {
display: flex; justify-content: space-between; align-items: center;
padding: 0.3rem 0; cursor: pointer;
}
.switch-text { font-size: 0.88rem; font-weight: 600; color: var(--color-text-secondary); }
.switch {
position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0;
}
.switch input { opacity: 0; width: 0; height: 0; }
.switch-slider {
position: absolute; inset: 0; border-radius: 22px;
background: var(--color-bg-tertiary); border: 1px solid var(--color-border);
transition: all 0.25s ease; cursor: pointer;
}
.switch-slider::before {
content: ''; position: absolute; left: 2px; bottom: 2px;
width: 16px; height: 16px; border-radius: 50%;
background: var(--color-text-muted);
transition: transform 0.25s ease, background 0.25s ease;
}
.switch input:checked + .switch-slider {
background: rgba(79, 143, 247, 0.2); border-color: var(--color-accent-blue);
}
.switch input:checked + .switch-slider::before {
transform: translateX(18px); background: var(--color-accent-blue);
}
.switch-hint {
font-size: 0.82rem; color: var(--color-text-muted); font-style: italic;
margin-top: 0.15rem;
}
.follow-badge {
margin-top: 0.35rem; padding: 0.4rem 0.6rem;
background: rgba(79, 143, 247, 0.1); border: 1px solid rgba(79, 143, 247, 0.25);
border-radius: 6px; font-size: 0.86rem; color: var(--color-accent-blue);
animation: fadeIn 0.3s ease;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

/* Clickable path rows */
.narr-row-click { cursor: pointer; transition: background 0.15s; }
.narr-row-click:hover { background: rgba(79, 143, 247, 0.08); }
.narr-row-active { background: rgba(79, 143, 247, 0.12); border-left: 2px solid var(--color-accent-blue); }

/* Resistance Breakdown Panel */
.breakdown-panel {
margin-top: 0.6rem; padding: 0.6rem;
background: rgba(6, 10, 20, 0.6); border: 1px solid rgba(79, 143, 247, 0.2);
border-radius: 8px; animation: fadeIn 0.25s ease;
}
.breakdown-header {
display: flex; justify-content: space-between; align-items: center;
margin-bottom: 0.4rem;
}
.breakdown-title { font-size: 0.88rem; font-weight: 700; color: var(--color-text-primary); }
.breakdown-close {
background: none; border: none; color: var(--color-text-muted);
font-size: 0.92rem; cursor: pointer; padding: 0 0.2rem;
}
.breakdown-close:hover { color: var(--color-text-primary); }
.breakdown-bar {
display: flex; height: 10px; border-radius: 5px; overflow: hidden;
margin-bottom: 0.35rem; background: rgba(255,255,255,0.05);
}
.breakdown-bar-seg {
min-width: 2px; transition: width 0.3s ease;
}
.breakdown-bar-seg:first-child { border-radius: 5px 0 0 5px; }
.breakdown-bar-seg:last-child { border-radius: 0 5px 5px 0; }
.breakdown-legend-row {
display: flex; gap: 0.5rem; margin-bottom: 0.4rem; flex-wrap: wrap;
}
.breakdown-legend-chip {
display: flex; align-items: center; gap: 0.2rem;
font-size: 0.88rem; color: var(--color-text-muted);
}
.bd-chip-dot { width: 6px; height: 6px; border-radius: 2px; }
.breakdown-table {
max-height: 160px; overflow-y: auto;
}
.bd-row {
display: flex; align-items: center; gap: 0.25rem;
padding: 0.15rem 0; font-size: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.03);
}
.bd-num { color: var(--color-text-muted); width: 1.2em; text-align: right; flex-shrink: 0; }
.bd-chip {
font-size: 0.75rem; font-weight: 700; color: #000;
padding: 0.05rem 0.3rem; border-radius: 3px; flex-shrink: 0;
}
.bd-dir { color: var(--color-text-muted); flex-shrink: 0; }
.bd-coords { color: var(--color-text-secondary); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bd-r { font-family: 'JetBrains Mono', monospace; color: var(--color-text-primary); font-size: 0.88rem; flex-shrink: 0; }
.bd-cum { font-family: 'JetBrains Mono', monospace; color: var(--color-text-muted); font-size: 0.86rem; flex-shrink: 0; }
.breakdown-total {
margin-top: 0.35rem; padding-top: 0.3rem;
border-top: 1px solid rgba(255,255,255,0.08);
font-size: 0.9rem; color: var(--color-text-secondary);
}

/* Narration */
.narration {
margin: 0.5rem 0; border: 1px solid var(--color-border);
border-radius: 8px; background: var(--color-bg-tertiary); overflow: hidden;
}
.narr-step { display: flex; gap: 0.6rem; padding: 0.75rem; }
.narr-step.winner-step { background: rgba(255, 215, 0, 0.04); border-top: 2px solid rgba(255, 215, 0, 0.25); }
.narr-icon { font-size: 1.1rem; flex-shrink: 0; }
.narr-body { flex: 1; min-width: 0; }
.narr-title { font-size: 0.9rem; font-weight: 700; color: var(--color-text-primary); margin-bottom: 0.3rem; }
.narr-text { font-size: 0.86rem; line-height: 1.55; color: var(--color-text-secondary); margin-bottom: 0.2rem; }
.narr-text.dim { color: var(--color-text-muted); font-size: 0.9rem; font-style: italic; }
.narr-explain {
	font-size: 0.82rem; line-height: 1.6; color: var(--color-text-muted);
	background: rgba(79, 143, 247, 0.06); border-left: 2px solid var(--color-accent-blue);
	padding: 0.5rem 0.65rem; border-radius: 0 6px 6px 0; margin-bottom: 0.5rem;
}
.narr-meter-bar { height: 5px; background: var(--color-bg-secondary); border-radius: 3px; margin-bottom: 0.3rem; overflow: hidden; }
.narr-meter-fill { height: 100%; border-radius: 3px; background: var(--color-accent-green); transition: width 0.3s ease; }
.narr-results { margin-top: 0.4rem; }
.narr-comparison { margin-top: 0.3rem; }
.narr-row {
display: flex; align-items: center; gap: 0.35rem;
padding: 0.2rem 0.3rem; font-size: 0.86rem; border-radius: 4px;
}
.narr-row.narr-best { background: rgba(34,197,94, 0.08); }
.narr-row.narr-winner { background: rgba(255, 215, 0, 0.08); font-weight: 700; }
.narr-rank { color: var(--color-text-muted); font-size: 0.82rem; width: 1.2em; }
.narr-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.narr-label { color: var(--color-text-secondary); flex: 1; }
.narr-r { font-family: 'JetBrains Mono', monospace; color: var(--color-text-primary); font-size: 0.84rem; }
.narr-best-tag { font-size: 0.88rem; color: var(--color-accent-green); font-weight: 700; }
.narr-badge { font-size: 0.88rem; font-weight: 800; color: #ffd700; }
.narr-diff { font-size: 0.8rem; color: var(--color-text-muted); font-family: 'JetBrains Mono', monospace; }
.narr-winner-value {
font-size: 1.4rem; font-weight: 900; color: #ffd700;
font-family: 'JetBrains Mono', monospace;
margin: 0.3rem 0;
}

/* Legend */
.legend { margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid var(--color-border); }
.legend-title { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-muted); margin: 0 0 0.4rem; }
.legend-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.84rem; color: var(--color-text-secondary); padding: 0.12rem 0; }
.legend-swatch { width: 10px; height: 10px; flex-shrink: 0; border-radius: 2px; }
.tip { margin-top: 0.5rem; font-size: 0.82rem; color: var(--color-text-muted); text-align: center; }

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


/* Narration overlay — right side of 3D canvas */
.narr-overlay {
position: absolute;
top: 1rem; right: 1rem;
width: 320px;
max-height: calc(100% - 2rem);
overflow-y: auto;
background: rgba(6, 10, 20, 0.88);
backdrop-filter: blur(12px);
border: 1px solid rgba(79, 143, 247, 0.25);
border-radius: 10px;
z-index: 10;
pointer-events: auto;
box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
from { opacity: 0; transform: translateX(20px); }
to { opacity: 1; transform: translateX(0); }
}

@media (max-width: 768px) {
.tool-layout { flex-direction: column; }
.canvas-area { height: 50vh; }
}
</style>
