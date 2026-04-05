<script lang="ts">
import { onMount } from 'svelte';
import type { Grid, Instance, Domain, PathResult, PathNode } from '$lib/engine/types';
import { findBumpAt, findInstanceAt } from '$lib/engine/grid';

let {
grid,
selectedSource = null,
selectedTarget = null,
paths = [],
animSpeed = 1.0,
showLabels = false,
onInstanceClick,
onDomainClick,
onAnimationDone
}: {
grid: Grid;
selectedSource?: Instance | null;
selectedTarget?: Domain | null;
paths?: PathResult[];
animSpeed?: number;
showLabels?: boolean;
onInstanceClick?: (inst: Instance) => void;
onDomainClick?: (domain: Domain) => void;
onAnimationDone?: () => void;
} = $props();

let container: HTMLDivElement;
let sceneReady = $state(false);

let api: {
rebuild: () => void;
updateSelection: () => void;
animatePaths: (p: PathResult[]) => void;
clearPaths: () => void;
setSpeed: (s: number) => void;
} | null = null;

let cleanup: (() => void) | null = null;

onMount(() => {
init();
return () => cleanup?.();
});

async function init() {
const THREE = await import('three');
const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

// ── Layer constants ──
const L1_Y = 0.10;   // Layer 1: horizontal traces (M1 — copper)
const L2_Y = 0.42;   // Layer 2: vertical traces   (M2 — aluminum)
const VIA_GAP = L2_Y - L1_Y;
const BUMP_BASE = L2_Y + 0.06;
const BUMP_H = 0.32;
const INST_H = 0.20;
const PATH_LIFT = 0.03; // path floats slightly above traces
const L1_COLOR = 0xc07830; // warm copper
const L2_COLOR = 0x8898b8; // cool silver

const { rows, cols } = grid.config;
const rect = container.getBoundingClientRect();
let w = rect.width;
let h = rect.height;

// ── Scene ──
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060a14);

const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 200);
camera.position.set(15, 9, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;
container.appendChild(renderer.domElement);

const cx = (cols - 1) / 2, cz = (rows - 1) / 2;
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(cx, (L1_Y + L2_Y) / 2, cz);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 4;
controls.maxDistance = 45;
controls.maxPolarAngle = Math.PI / 2.05;
controls.update();

// ── Lighting — brighter for visibility ──
scene.add(new THREE.AmbientLight(0x4060a0, 1.0));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(12, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
const sc = dirLight.shadow.camera;
sc.near = 1; sc.far = 50; sc.left = -15; sc.right = 15; sc.top = 15; sc.bottom = -15;
scene.add(dirLight);
const accent = new THREE.PointLight(0x4f8ff7, 0.6, 45);
accent.position.set(cx, 10, cz);
scene.add(accent);
// warm fill from below
const warm = new THREE.PointLight(0xc07830, 0.25, 30);
warm.position.set(cx, -2, cz);
scene.add(warm);

// ── Groups ──
const gridGroup = new THREE.Group();
const pathGroup = new THREE.Group();
scene.add(gridGroup);
scene.add(pathGroup);

// ── Shared geo ──
const viaGeo = new THREE.CylinderGeometry(0.03, 0.03, VIA_GAP, 8);
const viaMat = new THREE.MeshStandardMaterial({ color: 0x606878, metalness: 0.9, roughness: 0.2 });
const bumpGeo = new THREE.CylinderGeometry(0.14, 0.17, BUMP_H, 20);
const instanceGeo = new THREE.BoxGeometry(0.28, INST_H, 0.28);
const particleGeo = new THREE.SphereGeometry(0.10, 14, 14);

let clickables: any[] = [];

// ── Build grid ──
function buildGrid() {
gridGroup.clear();
clickables = [];
const r = rows, c = cols;

// Ground plane
const gndGeo = new THREE.PlaneGeometry(c + 5, r + 5);
const gndMat = new THREE.MeshStandardMaterial({ color: 0x080e1c, roughness: 0.95, metalness: 0.1 });
const gnd = new THREE.Mesh(gndGeo, gndMat);
gnd.rotation.x = -Math.PI / 2;
gnd.position.set(cx, -0.02, cz);
gnd.receiveShadow = true;
gridGroup.add(gnd);

// Grid helpers at each layer
for (const [y, col] of [[L1_Y - 0.005, 0x201a10], [L2_Y - 0.005, 0x101520]] as [number, number][]) {
const gh = new THREE.GridHelper(Math.max(r, c) - 1, Math.max(r, c) - 1, col, col);
gh.position.set(cx, y, cz);
(gh.material as any).opacity = 0.25;
(gh.material as any).transparent = true;
gridGroup.add(gh);
}

// Semi-transparent layer planes
for (const [y, color, label] of [
[L1_Y - 0.008, L1_COLOR, 'M1 — Horizontal'],
[L2_Y - 0.008, L2_COLOR, 'M2 — Vertical']
] as [number, number, string][]) {
const pGeo = new THREE.PlaneGeometry(c + 0.5, r + 0.5);
const pMat = new THREE.MeshBasicMaterial({
color, transparent: true, opacity: 0.04, side: THREE.DoubleSide, depthWrite: false
});
const plane = new THREE.Mesh(pGeo, pMat);
plane.rotation.x = -Math.PI / 2;
plane.position.set(cx, y, cz);
gridGroup.add(plane);

// Layer label sprite
const canvas = document.createElement('canvas');
canvas.width = 512; canvas.height = 64;
const ctx2 = canvas.getContext('2d')!;
ctx2.font = 'bold 30px Inter, sans-serif';
ctx2.fillStyle = '#' + color.toString(16).padStart(6, '0');
ctx2.globalAlpha = 0.8;
ctx2.fillText(label, 8, 42);
const tex = new THREE.CanvasTexture(canvas);
const spMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
const sp = new THREE.Sprite(spMat);
sp.scale.set(3.5, 0.45, 1);
sp.position.set(-1.8, y + 0.02, cz);
gridGroup.add(sp);
}

// Layer 1 — horizontal traces (copper)
for (let row = 0; row < r; row++) {
for (let col = 0; col < c - 1; col++) {
const res = grid.resistances[row][col].right;
if (res !== null) addTrace(col, row, col + 1, row, res, true);
}
}

// Layer 2 — vertical traces (silver)
for (let row = 0; row < r - 1; row++) {
for (let col = 0; col < c; col++) {
const res = grid.resistances[row][col].down;
if (res !== null) addTrace(col, row, col, row + 1, res, false);
}
}

// Vias at every intersection
for (let row = 0; row < r; row++) {
for (let col = 0; col < c; col++) {
const v = new THREE.Mesh(viaGeo, viaMat);
v.position.set(col, L1_Y + VIA_GAP / 2, row);
gridGroup.add(v);
}
}

// Bumps — rise above Layer 2
for (const domain of grid.domains) {
const clr = new THREE.Color(domain.color);
for (const bump of domain.bumps) {
const mat = new THREE.MeshStandardMaterial({
color: clr, roughness: 0.2, metalness: 0.7,
emissive: clr, emissiveIntensity: 0.25
});
const m = new THREE.Mesh(bumpGeo, mat);
m.position.set(bump.col, BUMP_BASE + BUMP_H / 2, bump.row);
m.castShadow = true;
m.userData = { type: 'bump', bump, domain };
gridGroup.add(m);
clickables.push(m);
}
}

// Instances — sit at ground level below Layer 1
for (const inst of grid.instances) {
const mat = new THREE.MeshStandardMaterial({
color: 0x9b59b6, roughness: 0.25, metalness: 0.55,
emissive: 0x9b59b6, emissiveIntensity: 0.15
});
const m = new THREE.Mesh(instanceGeo, mat);
m.position.set(inst.col, INST_H / 2, inst.row);
m.castShadow = true;
m.userData = { type: 'instance', instance: inst };
gridGroup.add(m);
clickables.push(m);
}
}

function addTrace(c1: number, r1: number, c2: number, r2: number, resistance: number, horiz: boolean) {
const maxR = 0.2, minR = 0.05;
const t = 1 - Math.min(1, Math.max(0, (resistance - minR) / (maxR - minR)));
const tw = 0.05 + t * 0.10;  // thicker for visibility
const th = 0.022 + t * 0.014;
const baseColor = horiz ? L1_COLOR : L2_COLOR;
const y = horiz ? L1_Y : L2_Y;

const geo = new THREE.BoxGeometry(horiz ? 1.0 : tw, th, horiz ? tw : 1.0);
const mat = new THREE.MeshStandardMaterial({
color: baseColor, roughness: 0.3, metalness: 0.85,
emissive: baseColor, emissiveIntensity: 0.08
});
const m = new THREE.Mesh(geo, mat);
m.position.set((c1 + c2) / 2, y + th / 2, (r1 + r2) / 2);
m.castShadow = true;
m.receiveShadow = true;
gridGroup.add(m);
}

// ── Selection ──
function updateSelection() {
gridGroup.traverse((obj: any) => {
if (!(obj instanceof THREE.Mesh) || !obj.userData.type) return;
const mat = obj.material as any;
if (obj.userData.type === 'instance') {
const inst = obj.userData.instance as Instance;
const sel = selectedSource?.id === inst.id;
mat.color.set(sel ? 0x22c55e : 0x9b59b6);
mat.emissive.set(sel ? 0x22c55e : 0x9b59b6);
mat.emissiveIntensity = sel ? 0.7 : 0.15;
obj.scale.setScalar(sel ? 1.2 : 1.0);
}
if (obj.userData.type === 'bump') {
const domain = obj.userData.domain as Domain;
const sel = selectedTarget?.id === domain.id;
mat.emissiveIntensity = sel ? 0.6 : 0.25;
obj.scale.setScalar(sel ? 1.3 : 1.0);
}
});
}

// ── Convert flat path → 3D multi-layer coordinates ──
function pathTo3D(path: PathNode[]) {
if (path.length < 2) return [new THREE.Vector3(path[0].col, L1_Y + PATH_LIFT, path[0].row)];
const pts: InstanceType<typeof THREE.Vector3>[] = [];
for (let i = 0; i < path.length; i++) {
const n = path[i];
if (i === 0) {
// match first segment direction
const nxt = path[1];
const horiz = n.row === nxt.row;
pts.push(new THREE.Vector3(n.col, (horiz ? L1_Y : L2_Y) + PATH_LIFT, n.row));
continue;
}
const prev = path[i - 1];
const horiz = n.row === prev.row;
const targetY = (horiz ? L1_Y : L2_Y) + PATH_LIFT;
const lastY = pts[pts.length - 1].y;
// via transition if changing layer
if (Math.abs(targetY - lastY) > 0.01) {
pts.push(new THREE.Vector3(prev.col, targetY, prev.row));
}
pts.push(new THREE.Vector3(n.col, targetY, n.row));
}
return pts;
}

// ── Path animation ──
const PATH_COLORS = [0xff6b6b, 0x4f8ff7, 0x22c55e, 0xfbbf24, 0xa78bfa, 0xf472b6, 0x22d3ee, 0xfb923c];
let animActive = false;
let currentAnimPaths: PathResult[] = [];
let currentPathIdx = 0;
let segIdx = 0;
let segProgress = 0;
let animPts: InstanceType<typeof THREE.Vector3>[] = [];  // 3D points for current path
let completedPathMeshes: any[] = [];
let trailLine: any = null;
let trailPositions: Float32Array | null = null;
let trailGeo: any = null;
let particle: any = null;
let interPathDelay = 0;
let nodePause = 0; // pause at each node
let localAnimSpeed = 1.0;
let flowParticles: { mesh: any; pts: InstanceType<typeof THREE.Vector3>[]; phase: number; speed: number }[] = [];

function clearPathGroup() {
pathGroup.clear();
trailLine = null; trailGeo = null; trailPositions = null; particle = null;
completedPathMeshes = []; flowParticles = [];
animActive = false; animPts = [];
}

function startAnimation(paths: PathResult[]) {
clearPathGroup();
if (!paths.length) return;
currentAnimPaths = paths;
currentPathIdx = 0;
interPathDelay = 0;
animActive = true;
setupTrailForPath(0);
}

function setupTrailForPath(idx: number) {
if (trailLine) pathGroup.remove(trailLine);
if (particle) pathGroup.remove(particle);

const flatPath = currentAnimPaths[idx].path;
animPts = pathTo3D(flatPath);
const maxV = animPts.length + 1;
trailPositions = new Float32Array(maxV * 3);
trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
trailGeo.setDrawRange(0, 0);

const color = PATH_COLORS[idx % PATH_COLORS.length];
trailLine = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color, linewidth: 2 }));
pathGroup.add(trailLine);

const pMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
particle = new THREE.Mesh(particleGeo, pMat);
particle.position.copy(animPts[0]);
pathGroup.add(particle);

// Add a point light on the particle for local glow
const pLight = new THREE.PointLight(0xffd700, 0.6, 2.5);
particle.add(pLight);

segIdx = 0; segProgress = 0; nodePause = 0;
}

function addCompletedPath(idx: number) {
const pts = pathTo3D(currentAnimPaths[idx].path);
const color = PATH_COLORS[idx % PATH_COLORS.length];

const curvePath = new (THREE.CurvePath as any)();
for (let i = 0; i < pts.length - 1; i++) {
curvePath.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
}
const tubeGeo = new THREE.TubeGeometry(curvePath, pts.length * 5, 0.04, 8, false);
const tubeMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 });
const tube = new THREE.Mesh(tubeGeo, tubeMat);
pathGroup.add(tube);
completedPathMeshes.push(tube);

// Flowing particles
for (let p = 0; p < 4; p++) {
const fpMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
const fp = new THREE.Mesh(particleGeo, fpMat);
fp.scale.setScalar(0.6);
const fpLight = new THREE.PointLight(0xffd700, 0.3, 1.5);
fp.add(fpLight);
pathGroup.add(fp);
flowParticles.push({ mesh: fp, pts, phase: p / 4, speed: 0.0004 + Math.random() * 0.0002 });
}
}

function tickAnimation(dt: number) {
if (!animActive || !currentAnimPaths.length) return;

if (interPathDelay > 0) { interPathDelay -= dt; return; }

// Pause briefly at each node for clarity
if (nodePause > 0) { nodePause -= dt; return; }

const pts = animPts;
const totalSegs = pts.length - 1;
// MUCH slower: base 0.012 per frame (was 0.035) → ~5s per segment at 60fps
const speed = 0.012 * localAnimSpeed;

segProgress += speed;

if (segProgress >= 1) {
segProgress = 0;
segIdx++;
nodePause = 120 / localAnimSpeed; // 120ms pause at each node

if (segIdx >= totalSegs) {
if (trailLine) pathGroup.remove(trailLine);
if (particle) pathGroup.remove(particle);
trailLine = null; particle = null;
addCompletedPath(currentPathIdx);
currentPathIdx++;
if (currentPathIdx < currentAnimPaths.length) {
interPathDelay = 1200 / localAnimSpeed; // longer gap between paths
setupTrailForPath(currentPathIdx);
} else {
animActive = false;
onAnimationDone?.();
}
return;
}
}

// Update trail
if (trailPositions && trailGeo) {
for (let i = 0; i <= segIdx && i < pts.length; i++) {
trailPositions[i * 3]     = pts[i].x;
trailPositions[i * 3 + 1] = pts[i].y;
trailPositions[i * 3 + 2] = pts[i].z;
}
const vi = segIdx + 1;
const c = pts[segIdx];
const n = pts[Math.min(segIdx + 1, totalSegs)];
trailPositions[vi * 3]     = c.x + (n.x - c.x) * segProgress;
trailPositions[vi * 3 + 1] = c.y + (n.y - c.y) * segProgress;
trailPositions[vi * 3 + 2] = c.z + (n.z - c.z) * segProgress;
trailGeo.setDrawRange(0, vi + 1);
trailGeo.attributes.position.needsUpdate = true;
}

if (particle && segIdx < pts.length - 1) {
const c = pts[segIdx];
const n = pts[Math.min(segIdx + 1, pts.length - 1)];
particle.position.set(
c.x + (n.x - c.x) * segProgress,
c.y + (n.y - c.y) * segProgress,
c.z + (n.z - c.z) * segProgress
);
}
}

function tickFlowParticles() {
for (const fp of flowParticles) {
const pts = fp.pts;
if (!pts || pts.length < 2) continue;
fp.phase = (fp.phase + fp.speed * localAnimSpeed) % 1;
const totalSegs = pts.length - 1;
const pos = fp.phase * totalSegs;
const si = Math.min(Math.floor(pos), totalSegs - 1);
const sp = pos - si;
const c = pts[si], n = pts[si + 1];
fp.mesh.position.set(
c.x + (n.x - c.x) * sp,
c.y + (n.y - c.y) * sp,
c.z + (n.z - c.z) * sp
);
}
}

// ── Click detection ──
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let pDown = { x: 0, y: 0 };
function onPD(e: PointerEvent) { pDown.x = e.clientX; pDown.y = e.clientY; }
function onPU(e: PointerEvent) {
if ((e.clientX - pDown.x) ** 2 + (e.clientY - pDown.y) ** 2 > 36) return;
const r2 = renderer.domElement.getBoundingClientRect();
mouse.x = ((e.clientX - r2.left) / r2.width) * 2 - 1;
mouse.y = -((e.clientY - r2.top) / r2.height) * 2 + 1;
raycaster.setFromCamera(mouse, camera);
const hits = raycaster.intersectObjects(clickables);
if (!hits.length) return;
const d = hits[0].object.userData;
if (d.type === 'instance') onInstanceClick?.(d.instance as Instance);
else if (d.type === 'bump') onDomainClick?.(d.domain as Domain);
}
renderer.domElement.addEventListener('pointerdown', onPD);
renderer.domElement.addEventListener('pointerup', onPU);

// ── Resize ──
function onResize() {
const r2 = container.getBoundingClientRect();
w = r2.width; h = r2.height;
camera.aspect = w / h;
camera.updateProjectionMatrix();
renderer.setSize(w, h);
}
const ro = new ResizeObserver(onResize);
ro.observe(container);

// ── Render loop ──
let lastTime = performance.now();
let running = true;
function loop() {
if (!running) return;
requestAnimationFrame(loop);
const now = performance.now();
const dt = now - lastTime;
lastTime = now;
controls.update();
tickAnimation(dt);
tickFlowParticles();
renderer.render(scene, camera);
}

buildGrid();
updateSelection();
loop();

api = {
rebuild: () => { buildGrid(); updateSelection(); },
updateSelection,
animatePaths: startAnimation,
clearPaths: clearPathGroup,
setSpeed: (s) => { localAnimSpeed = s; }
};
sceneReady = true;

cleanup = () => {
running = false;
renderer.domElement.removeEventListener('pointerdown', onPD);
renderer.domElement.removeEventListener('pointerup', onPU);
ro.disconnect(); controls.dispose(); renderer.dispose();
};
}

// ── Reactive bridges ──
$effect(() => { if (!sceneReady) return; void grid; api?.rebuild(); });
$effect(() => { if (!sceneReady) return; void selectedSource; void selectedTarget; api?.updateSelection(); });
$effect(() => {
if (!sceneReady) return;
const p = paths;
if (p && p.length > 0) api?.animatePaths(p); else api?.clearPaths();
});
$effect(() => { api?.setSpeed(animSpeed); });
</script>

<div class="scene-container" bind:this={container}>
{#if !sceneReady}
<div class="loading">Initializing 3D view…</div>
{/if}
</div>

<style>
.scene-container {
width: 100%; height: 100%; min-height: 400px;
position: relative; border-radius: 12px; overflow: hidden;
background: #060a14;
}
.scene-container :global(canvas) { display: block; cursor: grab; }
.scene-container :global(canvas:active) { cursor: grabbing; }
.loading {
position: absolute; inset: 0;
display: flex; align-items: center; justify-content: center;
color: #6b7294; font-size: 0.9rem;
}
</style>
