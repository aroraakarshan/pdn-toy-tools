<script lang="ts">
import { onMount } from 'svelte';
import type { Grid, Instance, Domain, PathResult, PathNode } from '$lib/engine/types';
import { findBumpAt, findInstanceAt, getEdgeResistance } from '$lib/engine/grid';

let {
grid,
selectedSource = null,
selectedTarget = null,
paths = [],
animSpeed = 1.0,
followMode = false,
onInstanceClick,
onDomainClick,
onAnimationDone,
onAnimationStep,
onPathClick
}: {
grid: Grid;
selectedSource?: Instance | null;
selectedTarget?: Domain | null;
paths?: PathResult[];
animSpeed?: number;
followMode?: boolean;
onInstanceClick?: (inst: Instance) => void;
onDomainClick?: (domain: Domain) => void;
onAnimationDone?: () => void;
onAnimationStep?: (step: { phase: string; pathIdx: number; totalPaths: number; segmentR?: number; runningTotal: number; finalR?: number }) => void;
onPathClick?: (pathIdx: number, bumpLabel: string, resistance: number) => void;
} = $props();

let container: HTMLDivElement;
let sceneReady = $state(false);

let api: {
rebuild: () => void;
updateSelection: () => void;
animatePaths: (p: PathResult[]) => void;
clearPaths: () => void;
setSpeed: (s: number) => void;
followPath: (idx: number) => void;
} | null = null;

let cleanup: (() => void) | null = null;

onMount(() => {
init();
return () => cleanup?.();
});

async function init() {
const THREE = await import('three');
const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

// ── Physical stack (bottom → top) ──
const INST_H = 0.28;
const M1_Y = 0.75;    // Metal 1 — horizontal (copper, finest)
const M2_Y = 1.55;    // Metal 2 — vertical   (copper)
const M3_Y = 2.35;    // Metal 3 — horizontal (aluminum)
const M4_Y = 3.15;    // Metal 4 — vertical   (aluminum, thickest)
const BUMP_H = 0.38;
const BUMP_BASE = 3.55;
const PATH_LIFT = 0.07;

const LAYER_YS = [M1_Y, M2_Y, M3_Y, M4_Y];
const LAYER_HORIZ = [true, false, true, false];
const LAYER_COLORS: number[] = [0xe85d3a, 0x3dc4c4, 0xd4a017, 0x7b68ee];
const LAYER_NAMES = [
'M1 — Horizontal (copper)',
'M2 — Vertical (copper)',
'M3 — Horizontal (aluminum)',
'M4 — Vertical (aluminum)'
];
const LAYER_THICK = [1.0, 1.25, 1.55, 1.85];

const { rows, cols } = grid.config;
const rect = container.getBoundingClientRect();
let w = rect.width;
let h = rect.height;

// ── Scene ──
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060a14);
scene.fog = new THREE.FogExp2(0x060a14, 0.014);

const camera = new THREE.PerspectiveCamera(36, w / h, 0.1, 300);
camera.position.set(20, 12, 26);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;
container.appendChild(renderer.domElement);

const cx = (cols - 1) / 2, cz = (rows - 1) / 2;
const midY = (M1_Y + M4_Y) / 2;
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(cx, midY, cz);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 5;
controls.maxDistance = 65;
controls.maxPolarAngle = Math.PI / 2.05;
controls.update();

// ── Smooth camera animation ──
let cameraTarget: { pos: InstanceType<typeof THREE.Vector3>; lookAt: InstanceType<typeof THREE.Vector3>; } | null = null;
let cameraAnimProgress = 1; // 1 = not animating
const CAMERA_SPEED = 0.015;

function smoothCameraTo(pos: InstanceType<typeof THREE.Vector3>, lookAt: InstanceType<typeof THREE.Vector3>) {
cameraTarget = { pos: pos.clone(), lookAt: lookAt.clone() };
cameraAnimProgress = 0;
}

function tickCamera() {
if (!cameraTarget || cameraAnimProgress >= 1) return;
cameraAnimProgress = Math.min(1, cameraAnimProgress + CAMERA_SPEED);
const t = cameraAnimProgress * cameraAnimProgress * (3 - 2 * cameraAnimProgress); // smoothstep
camera.position.lerp(cameraTarget.pos, t * 0.04);
controls.target.lerp(cameraTarget.lookAt, t * 0.04);
controls.update();
}

// ── Lighting ──
scene.add(new THREE.AmbientLight(0x4060a0, 1.1));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
dirLight.position.set(15, 28, 14);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
const sc = dirLight.shadow.camera;
sc.near = 1; sc.far = 65; sc.left = -20; sc.right = 20; sc.top = 20; sc.bottom = -20;
scene.add(dirLight);
const accentLight = new THREE.PointLight(0x4f8ff7, 0.5, 55);
accentLight.position.set(cx, 14, cz);
scene.add(accentLight);
const warmLight = new THREE.PointLight(0xc07830, 0.3, 35);
warmLight.position.set(cx, -2, cz);
scene.add(warmLight);

// ── Groups ──
const gridGroup = new THREE.Group();
const pathGroup = new THREE.Group();
const labelGroup = new THREE.Group();
scene.add(gridGroup);
scene.add(pathGroup);
scene.add(labelGroup);

// ── Shared geo ──
const bumpGeo = new THREE.CylinderGeometry(0.16, 0.20, BUMP_H, 20);
const instanceGeo = new THREE.BoxGeometry(0.32, INST_H, 0.32);
const particleGeo = new THREE.SphereGeometry(0.10, 14, 14);
const dummy = new THREE.Object3D();

let clickables: any[] = [];

// ── Text sprite helper ──
function makeTextSprite(text: string, cssColor: string, scale = 0.7): any {
const canvas = document.createElement('canvas');
canvas.width = 512; canvas.height = 64;
const ctx = canvas.getContext('2d')!;
ctx.font = 'bold 26px Arial, Helvetica, sans-serif';
ctx.fillStyle = cssColor;
ctx.shadowColor = 'rgba(0,0,0,0.95)';
ctx.shadowBlur = 6;
ctx.shadowOffsetX = 1;
ctx.shadowOffsetY = 1;
ctx.fillText(text, 6, 42);
const tex = new THREE.CanvasTexture(canvas);
const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
const sp = new THREE.Sprite(mat);
sp.scale.set(scale * 3.0, scale * 0.45, 1);
return sp;
}

// ── Build grid ──
function buildGrid() {
gridGroup.clear();
clickables = [];

// Ground plane
const gndGeo = new THREE.PlaneGeometry(cols + 6, rows + 6);
const gndMat = new THREE.MeshStandardMaterial({ color: 0x080e1c, roughness: 0.95, metalness: 0.1 });
const gnd = new THREE.Mesh(gndGeo, gndMat);
gnd.rotation.x = -Math.PI / 2;
gnd.position.set(cx, -0.02, cz);
gnd.receiveShadow = true;
gridGroup.add(gnd);

// ── Instances at BOTTOM ──
for (const inst of grid.instances) {
const mat = new THREE.MeshStandardMaterial({
color: 0x9b59b6, roughness: 0.25, metalness: 0.55,
emissive: 0x9b59b6, emissiveIntensity: 0.18
});
const m = new THREE.Mesh(instanceGeo, mat);
m.position.set(inst.col, INST_H / 2, inst.row);
m.castShadow = true;
m.userData = { type: 'instance', instance: inst };
gridGroup.add(m);
clickables.push(m);

// Pin from instance to M1
const pinH = M1_Y - INST_H;
const pinGeo = new THREE.CylinderGeometry(0.018, 0.018, pinH, 6);
const pinMat = new THREE.MeshBasicMaterial({ color: 0x9b59b6, transparent: true, opacity: 0.35 });
const pin = new THREE.Mesh(pinGeo, pinMat);
pin.position.set(inst.col, INST_H + pinH / 2, inst.row);
gridGroup.add(pin);

// Instance label
const lbl = makeTextSprite(`I${inst.id.split('-')[1]}`, '#c084fc', 0.4);
lbl.position.set(inst.col, INST_H + 0.12, inst.row + 0.25);
gridGroup.add(lbl);
}

// ── Metal layers ──
for (let li = 0; li < 4; li++) {
const ly = LAYER_YS[li];
const color = LAYER_COLORS[li];
const isHoriz = LAYER_HORIZ[li];
const thick = LAYER_THICK[li];

// Semi-transparent layer plane
const pGeo = new THREE.PlaneGeometry(cols + 0.6, rows + 0.6);
const pMat = new THREE.MeshBasicMaterial({
color, transparent: true, opacity: 0.035,
side: THREE.DoubleSide, depthWrite: false
});
const plane = new THREE.Mesh(pGeo, pMat);
plane.rotation.x = -Math.PI / 2;
plane.position.set(cx, ly - 0.01, cz);
gridGroup.add(plane);

// Layer label
const hexStr = '#' + color.toString(16).padStart(6, '0');
const labelSp = makeTextSprite(LAYER_NAMES[li], hexStr, 0.9);
labelSp.position.set(-2.5, ly + 0.06, cz);
gridGroup.add(labelSp);

// Faint grid helper
const gh = new THREE.GridHelper(Math.max(rows, cols) - 1, Math.max(rows, cols) - 1, color, color);
gh.position.set(cx, ly - 0.005, cz);
(gh.material as any).opacity = 0.10;
(gh.material as any).transparent = true;
gridGroup.add(gh);

// Traces
if (isHoriz) {
for (let r = 0; r < rows; r++) {
for (let c = 0; c < cols - 1; c++) {
const res = grid.resistances[r][c].right;
if (res !== null) addTrace(c, r, c + 1, r, res, true, ly, color, thick);
}
}
} else {
for (let r = 0; r < rows - 1; r++) {
for (let c = 0; c < cols; c++) {
const res = grid.resistances[r][c].down;
if (res !== null) addTrace(c, r, c, r + 1, res, false, ly, color, thick);
}
}
}
}

// ── Vias between adjacent layers (InstancedMesh) ──
const viaH = LAYER_YS[1] - LAYER_YS[0]; // gaps are equal
const viaGeo = new THREE.CylinderGeometry(0.018, 0.018, viaH, 6);
const viaMat = new THREE.MeshBasicMaterial({ color: 0x606878, transparent: true, opacity: 0.08 });
for (let gap = 0; gap < 3; gap++) {
const yBot = LAYER_YS[gap];
const yTop = LAYER_YS[gap + 1];
const actualH = yTop - yBot;
const gapGeo = (actualH === viaH) ? viaGeo :
new THREE.CylinderGeometry(0.018, 0.018, actualH, 6);
const count = rows * cols;
const viaMesh = new THREE.InstancedMesh(gapGeo, viaMat, count);
let idx = 0;
for (let r = 0; r < rows; r++) {
for (let c = 0; c < cols; c++) {
dummy.position.set(c, yBot + actualH / 2, r);
dummy.scale.set(1, 1, 1);
dummy.updateMatrix();
viaMesh.setMatrixAt(idx++, dummy.matrix);
}
}
viaMesh.instanceMatrix.needsUpdate = true;
gridGroup.add(viaMesh);
}

// ── Bumps at TOP ──
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

// Pin from M4 to bump
const pinH = BUMP_BASE - M4_Y;
const pinGeo = new THREE.CylinderGeometry(0.022, 0.022, pinH, 6);
const pinMat = new THREE.MeshBasicMaterial({
color: new THREE.Color(domain.color), transparent: true, opacity: 0.35
});
const pin = new THREE.Mesh(pinGeo, pinMat);
pin.position.set(bump.col, M4_Y + pinH / 2, bump.row);
gridGroup.add(pin);
}
}
}

function addTrace(c1: number, r1: number, c2: number, r2: number,
resistance: number, horiz: boolean, layerY: number, baseColor: number, thickMul: number) {
const maxR = 0.2, minR = 0.05;
const t = 1 - Math.min(1, Math.max(0, (resistance - minR) / (maxR - minR)));
const tw = (0.04 + t * 0.07) * thickMul;
const th = (0.016 + t * 0.009) * thickMul;
const geo = new THREE.BoxGeometry(horiz ? 1.0 : tw, th, horiz ? tw : 1.0);
const mat = new THREE.MeshStandardMaterial({
color: baseColor, roughness: 0.3, metalness: 0.85,
emissive: baseColor, emissiveIntensity: 0.06
});
const m = new THREE.Mesh(geo, mat);
m.position.set((c1 + c2) / 2, layerY + th / 2, (r1 + r2) / 2);
m.castShadow = true;
m.receiveShadow = true;
gridGroup.add(m);
}

// ── Selection highlighting ──
function updateSelection() {
gridGroup.traverse((obj: any) => {
if (!(obj instanceof THREE.Mesh) || !obj.userData.type) return;
const mat = obj.material as any;
if (obj.userData.type === 'instance') {
const inst = obj.userData.instance as Instance;
const sel = selectedSource?.id === inst.id;
mat.color.set(sel ? 0x22c55e : 0x9b59b6);
mat.emissive.set(sel ? 0x22c55e : 0x9b59b6);
mat.emissiveIntensity = sel ? 0.7 : 0.18;
obj.scale.setScalar(sel ? 1.25 : 1.0);
}
if (obj.userData.type === 'bump') {
const domain = obj.userData.domain as Domain;
const sel = selectedTarget?.id === domain.id;
mat.emissiveIntensity = sel ? 0.6 : 0.25;
obj.scale.setScalar(sel ? 1.3 : 1.0);
}
});
}

// ── Convert flat 2D path → 3D UPWARD-ONLY multi-layer path ──
// Instance (bottom) → M1 → via → M2 → via → M3 → via → M4 → Bump (top)
// The path can ONLY go UP through layers, never back down.
function pathTo3D(flatPath: PathNode[]): {
pts: InstanceType<typeof THREE.Vector3>[];
labels: { pos: InstanceType<typeof THREE.Vector3>; text: string; afterSeg: number }[];
} {
if (flatPath.length < 2) {
return {
pts: [new THREE.Vector3(flatPath[0].col, M1_Y + PATH_LIFT, flatPath[0].row)],
labels: []
};
}

const pts: InstanceType<typeof THREE.Vector3>[] = [];
const labels: { pos: InstanceType<typeof THREE.Vector3>; text: string; afterSeg: number }[] = [];

const start = flatPath[0];
// Start at instance level
pts.push(new THREE.Vector3(start.col, INST_H, start.row));
// Rise to M1
pts.push(new THREE.Vector3(start.col, M1_Y + PATH_LIFT, start.row));

let currentLayer = 0;

for (let i = 1; i < flatPath.length; i++) {
const prev = flatPath[i - 1];
const curr = flatPath[i];
const isHoriz = curr.row === prev.row;

// Determine target layer — upward only
let targetLayer = currentLayer;
if (isHoriz !== LAYER_HORIZ[currentLayer]) {
// Find next matching layer ABOVE current
for (let L = currentLayer + 1; L < 4; L++) {
if (LAYER_HORIZ[L] === isHoriz) {
targetLayer = L;
break;
}
}
// If no match found, just go up one
if (targetLayer === currentLayer && currentLayer < 3) {
targetLayer = currentLayer + 1;
}
}

// Via transition (vertical climb)
if (targetLayer !== currentLayer) {
pts.push(new THREE.Vector3(prev.col, LAYER_YS[targetLayer] + PATH_LIFT, prev.row));
currentLayer = targetLayer;
}

// Route segment on this layer
pts.push(new THREE.Vector3(curr.col, LAYER_YS[currentLayer] + PATH_LIFT, curr.row));

// Resistance label at segment midpoint
const res = getEdgeResistance(grid, prev.row, prev.col, curr.row, curr.col);
if (res !== null) {
const midPos = new THREE.Vector3(
(prev.col + curr.col) / 2,
LAYER_YS[currentLayer] + PATH_LIFT + 0.20,
(prev.row + curr.row) / 2
);
labels.push({
pos: midPos,
text: `${res.toFixed(3)} ohm`,
afterSeg: pts.length - 1
});
}
}

// Final point at bump level (top of stack)
const end = flatPath[flatPath.length - 1];
const lastPt = pts[pts.length - 1];
// Only add bump-rise if we aren't already above M4
if (lastPt.y < BUMP_BASE) {
// Via up through remaining layers to M4 if needed
if (currentLayer < 3) {
pts.push(new THREE.Vector3(end.col, LAYER_YS[3] + PATH_LIFT, end.row));
}
// Final rise to bump
pts.push(new THREE.Vector3(end.col, BUMP_BASE, end.row));
}

return { pts, labels };
}

// ── PARALLEL PATH ANIMATION ──
// All paths animate simultaneously — a "race" to each bump
const PATH_COLORS: number[] = [0xff6b6b, 0x4f8ff7, 0x22c55e, 0xfbbf24, 0xa78bfa, 0xf472b6, 0x22d3ee, 0xfb923c];
const PATH_CSS = ['#ff6b6b', '#4f8ff7', '#22c55e', '#fbbf24', '#a78bfa', '#f472b6', '#22d3ee', '#fb923c'];

interface ParallelTrack {
idx: number;
pts: InstanceType<typeof THREE.Vector3>[];
segIdx: number;
segProgress: number;
done: boolean;
trailPositions: Float32Array;
trailGeo: any;
trailLine: any;
particle: any;
totalR: number;
bumpLabel: string;
}

let tracks: ParallelTrack[] = [];
let animActive = false;
let localAnimSpeed = 1.0;
let winnerDone = false;
let pathTubes: any[] = [];
let followTrackIdx = -1;
let followProgress = 0;
let followActive = false;

function clearPathGroup() {
if (followTracer) { pathGroup.remove(followTracer); followTracer = null; }
pathGroup.clear();
labelGroup.clear();
tracks = [];
pathTubes = [];
animActive = false;
winnerDone = false;
followTrackIdx = -1;
followActive = false;
followPathCurve = null;
}

function startAnimation(allPaths: PathResult[]) {
clearPathGroup();
if (!allPaths.length) return;

tracks = allPaths.map((p, idx) => {
const { pts } = pathTo3D(p.path);
const maxV = pts.length + 2;
const trailPositions = new Float32Array(maxV * 3);
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
trailGeo.setDrawRange(0, 0);

const color = PATH_COLORS[idx % PATH_COLORS.length];
const trailLine = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color, linewidth: 3 }));
pathGroup.add(trailLine);

const pMat = new THREE.MeshBasicMaterial({ color });
const particle = new THREE.Mesh(particleGeo, pMat);
particle.scale.setScalar(1.4);
particle.position.copy(pts[0]);
pathGroup.add(particle);
const pLight = new THREE.PointLight(color, 1.2, 4.0);
particle.add(pLight);

return {
idx,
pts,
segIdx: 0,
segProgress: 0,
done: false,
trailPositions,
trailGeo,
trailLine,
particle,
totalR: p.totalResistance,
bumpLabel: p.bumpLabel ?? `Bump ${idx + 1}`
};
});

animActive = true;

// Camera: pull back for overview of all paths
const overviewPos = new THREE.Vector3(cx + 10, midY + 10, cz + 16);
const overviewLook = new THREE.Vector3(cx, midY, cz);
smoothCameraTo(overviewPos, overviewLook);

onAnimationStep?.({
phase: 'started',
pathIdx: 0,
totalPaths: allPaths.length,
runningTotal: 0
});
}

function tickAnimation(dt: number) {
if (!animActive || !tracks.length) return;

const speed = 0.022 * localAnimSpeed;
let allDone = true;

for (const track of tracks) {
if (track.done) continue;
allDone = false;

track.segProgress += speed;
const pts = track.pts;
const totalSegs = pts.length - 1;

if (track.segProgress >= 1) {
track.segProgress = 0;
track.segIdx++;

if (track.segIdx >= totalSegs) {
track.done = true;
// Convert trail to tube
pathGroup.remove(track.trailLine);
pathGroup.remove(track.particle);

const color = PATH_COLORS[track.idx % PATH_COLORS.length];
const cssColor = PATH_CSS[track.idx % PATH_CSS.length];
const curvePath = new (THREE.CurvePath as any)();
for (let i = 0; i < pts.length - 1; i++) {
curvePath.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
}
const tubeGeo = new THREE.TubeGeometry(curvePath, pts.length * 6, 0.09, 10, false);
const tubeMat = new THREE.MeshStandardMaterial({
color, emissive: color, emissiveIntensity: 0.4,
transparent: true, opacity: 0.85, roughness: 0.3, metalness: 0.6
});
const tube = new THREE.Mesh(tubeGeo, tubeMat);
tube.userData = { trackIdx: track.idx };
pathGroup.add(tube);
pathTubes.push(tube);

// Label at the end (bump)
const endPt = pts[pts.length - 1];
const rLabel = makeTextSprite(
track.bumpLabel + ': ' + track.totalR.toFixed(3) + ' ohm',
cssColor, 0.65
);
rLabel.position.set(endPt.x, endPt.y + 0.3 + track.idx * 0.25, endPt.z);
labelGroup.add(rLabel);

onAnimationStep?.({
phase: 'pathDone',
pathIdx: track.idx,
totalPaths: tracks.length,
finalR: track.totalR,
runningTotal: track.totalR
});
continue;
}
}

// Update trail
const tp = track.trailPositions;
const tg = track.trailGeo;
for (let i = 0; i <= track.segIdx && i < pts.length; i++) {
tp[i * 3]     = pts[i].x;
tp[i * 3 + 1] = pts[i].y;
tp[i * 3 + 2] = pts[i].z;
}
const vi = track.segIdx + 1;
const c = pts[track.segIdx];
const n = pts[Math.min(track.segIdx + 1, totalSegs)];
tp[vi * 3]     = c.x + (n.x - c.x) * track.segProgress;
tp[vi * 3 + 1] = c.y + (n.y - c.y) * track.segProgress;
tp[vi * 3 + 2] = c.z + (n.z - c.z) * track.segProgress;
tg.setDrawRange(0, vi + 1);
tg.attributes.position.needsUpdate = true;

// Move particle
if (track.particle && track.segIdx < pts.length - 1) {
const pc = pts[track.segIdx];
const pn = pts[Math.min(track.segIdx + 1, pts.length - 1)];
track.particle.position.set(
pc.x + (pn.x - pc.x) * track.segProgress,
pc.y + (pn.y - pc.y) * track.segProgress,
pc.z + (pn.z - pc.z) * track.segProgress
);
}
}

// Emit tracing step for the first incomplete track
const activeTrack = tracks.find(t => !t.done);
if (activeTrack) {
onAnimationStep?.({
phase: 'tracing',
pathIdx: tracks.filter(t => t.done).length,
totalPaths: tracks.length,
runningTotal: 0
});
}

if (allDone) {
animActive = false;
setTimeout(() => highlightWinner(), 1500);
onAnimationStep?.({
phase: 'allDone',
pathIdx: 0,
totalPaths: tracks.length,
runningTotal: tracks[0]?.totalR ?? 0
});
onAnimationDone?.();
}
}

function highlightWinner() {
if (tracks.length <= 1 || winnerDone) return;
winnerDone = true;

// Find the winner (lowest totalR)
let winIdx = 0;
for (let i = 1; i < tracks.length; i++) {
if (tracks[i].totalR < tracks[winIdx].totalR) winIdx = i;
}

// Dim all existing completed tubes — keep them clearly visible for comparison
pathGroup.traverse((obj: any) => {
if (obj.userData?.trackIdx !== undefined) {
const mat = obj.material as any;
mat.opacity = 0.70;
mat.emissiveIntensity = 0.35;
}
});

// Re-draw the winning path as a BRIGHT, THICK, glowing tube on top
const winPts = tracks[winIdx].pts;
const winColor = PATH_COLORS[winIdx % PATH_COLORS.length];
const curvePath = new (THREE.CurvePath as any)();
for (let i = 0; i < winPts.length - 1; i++) {
curvePath.add(new THREE.LineCurve3(winPts[i], winPts[i + 1]));
}
const winTubeGeo = new THREE.TubeGeometry(curvePath, winPts.length * 8, 0.12, 12, false);
const winTubeMat = new THREE.MeshStandardMaterial({
color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 0.9,
transparent: true, opacity: 1.0, roughness: 0.2, metalness: 0.8
});
const winTube = new THREE.Mesh(winTubeGeo, winTubeMat);
winTube.userData = { isWinner: true, trackIdx: winIdx };
pathGroup.add(winTube);
pathTubes.push(winTube);

// Camera zooms toward winner
const mid = winPts[Math.floor(winPts.length / 2)];
const winCamPos = new THREE.Vector3(mid.x + 6, mid.y + 5, mid.z + 8);
smoothCameraTo(winCamPos, mid.clone());

// Winner label at the bump end with arrow
const winEnd = winPts[winPts.length - 1];
const winStart = winPts[0];

const arrowGeo = new THREE.BufferGeometry().setFromPoints([
new THREE.Vector3(winEnd.x, winEnd.y + 1.6, winEnd.z),
new THREE.Vector3(winEnd.x, winEnd.y + 0.3, winEnd.z)
]);
const arrowLine = new THREE.Line(arrowGeo, new THREE.LineBasicMaterial({ color: 0xffd700, linewidth: 2 }));
pathGroup.add(arrowLine);

const winLabel1 = makeTextSprite('SHORTEST PATH (SPR)', '#ffd700', 1.0);
winLabel1.position.set(winEnd.x, winEnd.y + 2.0, winEnd.z);
labelGroup.add(winLabel1);

const winLabel2 = makeTextSprite(tracks[winIdx].totalR.toFixed(4) + ' ohm', '#ffd700', 0.85);
winLabel2.position.set(winEnd.x, winEnd.y + 1.5, winEnd.z);
labelGroup.add(winLabel2);

const startLabel = makeTextSprite('Source', '#22c55e', 0.65);
startLabel.position.set(winStart.x, winStart.y - 0.3, winStart.z);
labelGroup.add(startLabel);
}

// ── Follow path camera (first-person ride-along) ──
let followPathCurve: any = null;
let followTracer: any = null;
let followCameraReady = false;

function startFollowPath(trackIdx: number) {
const track = tracks[trackIdx];
if (!track || track.pts.length < 2) return;

// Clean up previous tracer if any
if (followTracer) { pathGroup.remove(followTracer); followTracer = null; }

followTrackIdx = trackIdx;
followProgress = 0;
followActive = true;
followCameraReady = false;

// Smooth spline through path points
followPathCurve = new THREE.CatmullRomCurve3(
track.pts.map(p => p.clone()), false, 'catmullrom', 0.3
);

// Create visible tracer particle — the thing camera follows
const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
followTracer = new THREE.Mesh(particleGeo, tracerMat);
followTracer.scale.setScalar(2.5);
const tracerGlow = new THREE.PointLight(0x4f8ff7, 2.5, 8.0);
followTracer.add(tracerGlow);
// Place tracer at start and keep it there until camera arrives
const startPos = followPathCurve.getPointAt(0);
followTracer.position.copy(startPos);
pathGroup.add(followTracer);

// Highlight followed path, dim everything else
pathGroup.traverse((obj: any) => {
if (!obj.isMesh || !obj.material) return;
const mat = obj.material as any;
const tIdx = obj.userData?.trackIdx;
if (tIdx === trackIdx && !obj.userData?.isWinner) {
mat.opacity = 1.0;
mat.emissiveIntensity = 0.7;
} else if (tIdx !== undefined || obj.userData?.isWinner) {
mat.opacity = 0.12;
mat.emissiveIntensity = 0.04;
}
});

onPathClick?.(trackIdx, track.bumpLabel, track.totalR);
}

function cleanupFollow() {
if (followTracer) { pathGroup.remove(followTracer); followTracer = null; }
followActive = false;
followTrackIdx = -1;
followPathCurve = null;
followCameraReady = false;
}

function tickFollowCamera() {
if (!followActive || !followMode || followTrackIdx < 0) return;
if (!followPathCurve) { cleanupFollow(); return; }

const startPos = followPathCurve.getPointAt(0);
const targetCamStart = startPos.clone().add(new THREE.Vector3(3, 2.0, 3));

// Phase 1: Wait for camera to arrive near the tracer start before moving
if (!followCameraReady) {
camera.position.lerp(targetCamStart, 0.06);
controls.target.lerp(startPos, 0.08);
controls.update();

const dist = camera.position.distanceTo(targetCamStart);
if (dist < 1.0) {
followCameraReady = true;
}
return;
}

// Phase 2: Camera is in position — tracer and camera move together
followProgress += 0.003 * localAnimSpeed;

if (followProgress >= 1) {
cleanupFollow();
if (winnerDone) restoreWinnerHighlight();
const overviewPos = new THREE.Vector3(cx + 10, midY + 10, cz + 16);
const overviewLook = new THREE.Vector3(cx, midY, cz);
smoothCameraTo(overviewPos, overviewLook);
return;
}

// Tracer moves along the path
const tracerT = Math.min(followProgress + 0.02, 1);
const tracerPos = followPathCurve.getPointAt(tracerT);
followTracer.position.copy(tracerPos);

// Stable drone-style camera: fixed offset, heavy damping
const targetCamPos = tracerPos.clone().add(new THREE.Vector3(3, 2.0, 3));
const targetLookAt = tracerPos.clone();

camera.position.lerp(targetCamPos, 0.025);
controls.target.lerp(targetLookAt, 0.04);
controls.update();
}

function restoreWinnerHighlight() {
pathGroup.traverse((obj: any) => {
if (!obj.isMesh || !obj.material) return;
const mat = obj.material as any;
if (obj.userData?.isWinner) {
mat.opacity = 1.0;
mat.emissiveIntensity = 0.9;
} else if (obj.userData?.trackIdx !== undefined) {
mat.opacity = 0.70;
mat.emissiveIntensity = 0.35;
}
});
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

// Check path tubes first when follow mode is on
if (followMode && pathTubes.length > 0 && !animActive) {
const pathHits = raycaster.intersectObjects(pathTubes);
if (pathHits.length) {
const tIdx = pathHits[0].object.userData?.trackIdx;
if (tIdx !== undefined) {
startFollowPath(tIdx);
return;
}
}
}

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

// Cancel follow if followMode toggled off
if (!followMode && followActive) {
cleanupFollow();
if (winnerDone) restoreWinnerHighlight();
}

if (followActive) {
tickFollowCamera();
} else {
tickCamera();
controls.update();
}
tickAnimation(dt);
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
setSpeed: (s: number) => { localAnimSpeed = s; },
followPath: startFollowPath
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
