<script lang="ts">
import { onMount } from 'svelte';
import type { Grid, Instance, IRDropResult } from '$lib/engine/types';

export type PathStep = {
	fromR: number; fromC: number;
	toR: number; toC: number;
	resistance: number;
	current: number;
	segmentDrop: number;
	voltageAfter: number;
};

let {
	grid,
	result = null,
	activeSources = new Map(),
	selectedLoadId = null,
	showHeatmap = true,
	showFlow = true,
	onInstanceClick,
	onInstanceDblClick,
	onNodeHover,
	onPathUpdate
}: {
	grid: Grid;
	result?: IRDropResult | null;
	activeSources?: Map<string, number>;
	selectedLoadId?: string | null;
	showHeatmap?: boolean;
	showFlow?: boolean;
	onInstanceClick?: (inst: Instance) => void;
	onInstanceDblClick?: (inst: Instance) => void;
	onNodeHover?: (info: { row: number; col: number; voltage: number; drop: number; resistance?: number; current?: number; segDrop?: number } | null) => void;
	onPathUpdate?: (pathSteps: PathStep[] | null) => void;
} = $props();

let container: HTMLDivElement;
let sceneReady = $state(false);

let api = $state<{
	rebuild: () => void;
	updateVoltages: () => void;
	updateFlow: () => void;
	updateSelection: () => void;
	updatePath: () => void;
} | null>(null);

let cleanup: (() => void) | null = null;

onMount(() => {
	init();
	return () => cleanup?.();
});

$effect(() => { if (api && result) api.updateVoltages(); });
$effect(() => { if (api) { showHeatmap; showFlow; api.updateVoltages(); } });
$effect(() => { if (api) { activeSources; api.updateSelection(); } });
$effect(() => { if (api) { selectedLoadId; result; api.updatePath(); } });

async function init() {
	const THREE = await import('three');
	const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

	const { rows, cols } = grid.config;
	const vdd = grid.config.vdd;
	const rect = container.getBoundingClientRect();
	let w = rect.width || 800;
	let h = rect.height || 600;

	const MESH_Y = 0.5;
	const INST_H = 0.28;
	const BUMP_H = 0.6;
	const BUMP_R = 0.25;

	// ── Scene ──
	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x101828);

	const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200);
	const cx = (cols - 1) / 2, cz = (rows - 1) / 2;
	const gridSize = Math.max(rows, cols);
	camera.position.set(cx + gridSize * 0.6, gridSize * 0.9, cz + gridSize * 0.8);
	camera.lookAt(cx, 0.3, cz);

	const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.setSize(w, h);
	container.appendChild(renderer.domElement);

	const controls = new OrbitControls(camera, renderer.domElement);
	controls.target.set(cx, 0.3, cz);
	controls.enableDamping = true;
	controls.dampingFactor = 0.12;
	controls.update();

	scene.add(new THREE.AmbientLight(0xffffff, 0.6));
	const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
	dirLight.position.set(cols, 8, rows);
	scene.add(dirLight);

	const raycaster = new THREE.Raycaster();
	const mouse = new THREE.Vector2();
	const clickables: THREE.Object3D[] = [];

	// ── Color helper ──
	let colorRangeMax = 0.01; // Dynamic: updated from actual worst drop
	function voltageToColor(voltage: number): THREE.Color {
		const drop = vdd - voltage;
		const range = Math.max(colorRangeMax, 0.001);
		const t = Math.max(0, Math.min(1, drop / range));
		if (t < 0.5) { const s = t * 2; return new THREE.Color(s, 1.0, (1 - s) * 0.6); }
		else { const s = (t - 0.5) * 2; return new THREE.Color(1.0, 1 - s, 0); }
	}

	// ── Text sprite helper ──
	function makeTextSprite(text: string, color: string, fontSize = 48, withBg = false): THREE.Sprite {
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d')!;
		canvas.width = 512;
		canvas.height = 64;
		ctx.clearRect(0, 0, 512, 64);

		if (withBg) {
			// Measure text to size the pill
			ctx.font = `bold ${fontSize}px monospace`;
			const tw = ctx.measureText(text).width;
			const pad = 24;
			const pillW = Math.min(496, tw + pad * 2);
			const pillX = (512 - pillW) / 2;
			ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
			ctx.beginPath();
			ctx.roundRect(pillX, 4, pillW, 56, 12);
			ctx.fill();
		}

		ctx.font = `bold ${fontSize}px monospace`;
		ctx.fillStyle = color;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(text, 256, 32);

		const tex = new THREE.CanvasTexture(canvas);
		tex.minFilter = THREE.LinearFilter;
		const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
		const sprite = new THREE.Sprite(mat);
		sprite.scale.set(1.8, 0.3, 1);
		return sprite;
	}

	// ── Edge helpers ──
	function getEdgeR(r1: number, c1: number, r2: number, c2: number): number | null {
		if (r1 === r2 && c2 === c1 + 1) return grid.resistances[r1][c1].right;
		if (r1 === r2 && c2 === c1 - 1) return grid.resistances[r1][c2].right;
		if (c1 === c2 && r2 === r1 + 1) return grid.resistances[r1][c1].down;
		if (c1 === c2 && r2 === r1 - 1) return grid.resistances[r2][c1].down;
		return null;
	}

	function getEdgeI(r1: number, c1: number, r2: number, c2: number): number {
		if (!result) return 0;
		if (r1 === r2 && c2 === c1 + 1) return result.currentDensity[r1][c1].horizontal;
		if (r1 === r2 && c2 === c1 - 1) return -result.currentDensity[r1][c2].horizontal;
		if (c1 === c2 && r2 === r1 + 1) return result.currentDensity[r1][c1].vertical;
		if (c1 === c2 && r2 === r1 - 1) return -result.currentDensity[r2][c1].vertical;
		return 0;
	}

	// ── Path tracing ──
	function tracePath(loadR: number, loadC: number): { path: [number, number][]; bumpFound: boolean } {
		const visited = new Set<string>();
		const path: [number, number][] = [[loadR, loadC]];
		visited.add(`${loadR},${loadC}`);

		let cr = loadR, cc = loadC;
		const bumpSet = new Set<string>();
		for (const d of grid.domains) for (const b of d.bumps) bumpSet.add(`${b.row},${b.col}`);

		for (let step = 0; step < rows * cols; step++) {
			if (bumpSet.has(`${cr},${cc}`)) return { path, bumpFound: true };

			let bestV = -Infinity, bestR = cr, bestC = cc;
			const neighbors: [number, number][] = [];
			if (cc < cols - 1 && grid.resistances[cr][cc].right !== null) neighbors.push([cr, cc + 1]);
			if (cc > 0 && grid.resistances[cr][cc - 1].right !== null) neighbors.push([cr, cc - 1]);
			if (cr < rows - 1 && grid.resistances[cr][cc].down !== null) neighbors.push([cr + 1, cc]);
			if (cr > 0 && grid.resistances[cr - 1][cc].down !== null) neighbors.push([cr - 1, cc]);

			for (const [nr, nc] of neighbors) {
				if (visited.has(`${nr},${nc}`)) continue;
				const v = result ? result.voltageMap[nr][nc] : vdd;
				if (v > bestV) { bestV = v; bestR = nr; bestC = nc; }
			}

			if (bestR === cr && bestC === cc) break;
			visited.add(`${bestR},${bestC}`);
			path.push([bestR, bestC]);
			cr = bestR; cc = bestC;
		}
		return { path, bumpFound: bumpSet.has(`${cr},${cc}`) };
	}

	// ── Ground plane ──
	const groundGeo = new THREE.PlaneGeometry(cols + 2, rows + 2);
	const groundMat = new THREE.MeshStandardMaterial({ color: 0x080c14 });
	const ground = new THREE.Mesh(groundGeo, groundMat);
	ground.rotation.x = -Math.PI / 2;
	ground.position.set(cx, -0.02, cz);
	scene.add(ground);

	// ── Grid helper (visible grid lines like SPR) ──
	const ghSize = Math.max(rows, cols) - 1;
	const gridHelper = new THREE.GridHelper(ghSize, ghSize, 0x2a3a5a, 0x1a2a3a);
	gridHelper.position.set(cx, MESH_Y - 0.01, cz);
	(gridHelper.material as any).opacity = 0.25;
	(gridHelper.material as any).transparent = true;
	scene.add(gridHelper);

	// ── Wire meshes ──
	type WireMeshData = { mesh: THREE.Mesh; r1: number; c1: number; r2: number; c2: number };
	const wireMeshes: WireMeshData[] = [];
	const wireGroup = new THREE.Group();
	scene.add(wireGroup);

	function buildWires() {
		while (wireGroup.children.length > 0) {
			const child = wireGroup.children[0] as THREE.Mesh;
			wireGroup.remove(child);
			child.geometry.dispose();
			(child.material as THREE.Material).dispose();
		}
		wireMeshes.length = 0;
		clickables.length = 0;

		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const R_right = grid.resistances[r][c].right;
				if (R_right !== null && c < cols - 1) {
					const thickness = Math.max(0.04, Math.min(0.20, 0.14 / (R_right + 0.1)));
					const geo = new THREE.BoxGeometry(1.0, thickness, thickness);
					const mat = new THREE.MeshBasicMaterial({ color: 0x8eaacc });
					const mesh = new THREE.Mesh(geo, mat);
					mesh.position.set(c + 0.5, MESH_Y, r);
					wireGroup.add(mesh);
					wireMeshes.push({ mesh, r1: r, c1: c, r2: r, c2: c + 1 });
					clickables.push(mesh);
				}
				const R_down = grid.resistances[r][c].down;
				if (R_down !== null && r < rows - 1) {
					const thickness = Math.max(0.04, Math.min(0.20, 0.14 / (R_down + 0.1)));
					const geo = new THREE.BoxGeometry(thickness, thickness, 1.0);
					const mat = new THREE.MeshBasicMaterial({ color: 0x8eaacc });
					const mesh = new THREE.Mesh(geo, mat);
					mesh.position.set(c, MESH_Y, r + 0.5);
					wireGroup.add(mesh);
					wireMeshes.push({ mesh, r1: r, c1: c, r2: r + 1, c2: c });
					clickables.push(mesh);
				}
			}
		}
	}

	// ── Node dots ──
	const dotGeo = new THREE.SphereGeometry(0.06, 8, 8);
	const dotMat = new THREE.MeshBasicMaterial({ color: 0x5588aa });
	const dotMesh = new THREE.InstancedMesh(dotGeo, dotMat, rows * cols);
	{
		const dummy = new THREE.Object3D();
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				dummy.position.set(c, MESH_Y, r);
				dummy.updateMatrix();
				dotMesh.setMatrixAt(r * cols + c, dummy.matrix);
			}
		}
		dotMesh.instanceMatrix.needsUpdate = true;
	}
	scene.add(dotMesh);

	// ── Instances (loads) ──
	type InstMeshData = { mesh: THREE.Mesh; inst: Instance; pin: THREE.Mesh };
	const instMeshes: InstMeshData[] = [];
	const instGroup = new THREE.Group();
	scene.add(instGroup);

	function buildInstances() {
		while (instGroup.children.length > 0) {
			const child = instGroup.children[0] as THREE.Mesh;
			instGroup.remove(child);
			child.geometry.dispose();
			(child.material as THREE.Material).dispose();
		}
		instMeshes.length = 0;

		const cubeGeo = new THREE.BoxGeometry(0.4, INST_H, 0.4);
		const pinGeo = new THREE.CylinderGeometry(0.025, 0.025, MESH_Y - INST_H / 2, 6);

		for (const inst of grid.instances) {
			const mat = new THREE.MeshStandardMaterial({ color: 0x9b59b6, emissive: 0x9b59b6, emissiveIntensity: 0.2, roughness: 0.3, metalness: 0.5 });
			const cube = new THREE.Mesh(cubeGeo, mat);
			cube.position.set(inst.col, INST_H / 2, inst.row);
			(cube as any).userData = { type: 'instance', inst };
			instGroup.add(cube);

			const pinMat = new THREE.MeshBasicMaterial({ color: 0x667788 });
			const pin = new THREE.Mesh(pinGeo, pinMat);
			pin.position.set(inst.col, INST_H / 2 + (MESH_Y - INST_H / 2) / 2, inst.row);
			instGroup.add(pin);

			instMeshes.push({ mesh: cube, inst, pin });
			clickables.push(cube);
		}
	}

	// ── Bumps ──
	const bumpGroup = new THREE.Group();
	scene.add(bumpGroup);

	function buildBumps() {
		while (bumpGroup.children.length > 0) {
			const child = bumpGroup.children[0];
			bumpGroup.remove(child);
			if ((child as THREE.Mesh).geometry) {
				(child as THREE.Mesh).geometry.dispose();
				((child as THREE.Mesh).material as THREE.Material).dispose();
			}
		}

		const cylGeo = new THREE.CylinderGeometry(BUMP_R, BUMP_R, BUMP_H, 16);
		for (const domain of grid.domains) {
			const domColor = new THREE.Color(domain.color);
			for (const bump of domain.bumps) {
				const mat = new THREE.MeshStandardMaterial({ color: domColor, emissive: domColor, emissiveIntensity: 0.3 });
				const cyl = new THREE.Mesh(cylGeo, mat);
				cyl.position.set(bump.col, MESH_Y + BUMP_H / 2, bump.row);
				bumpGroup.add(cyl);

				const label = makeTextSprite(`${vdd.toFixed(1)}V`, '#44ff66');
				label.position.set(bump.col, MESH_Y + BUMP_H + 0.25, bump.row);
				bumpGroup.add(label);
			}
		}
	}

	// ── Heatmap plane ──
	const hmGeo = new THREE.PlaneGeometry(cols - 1, rows - 1, cols - 1, rows - 1);
	const hmMat = new THREE.MeshBasicMaterial({
		vertexColors: true, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false
	});
	const hmMesh = new THREE.Mesh(hmGeo, hmMat);
	hmMesh.rotation.x = -Math.PI / 2;
	hmMesh.position.set(cx, 0.45, cz);
	hmMesh.visible = false;
	scene.add(hmMesh);

	// ── Voltage labels group ──
	const voltLabelGroup = new THREE.Group();
	scene.add(voltLabelGroup);

	// ── Worst drop marker ──
	const worstTorusGeo = new THREE.TorusGeometry(0.4, 0.06, 8, 24);
	const worstTorusMat = new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.9 });
	const worstTorus = new THREE.Mesh(worstTorusGeo, worstTorusMat);
	worstTorus.rotation.x = -Math.PI / 2;
	worstTorus.visible = false;
	scene.add(worstTorus);

	let worstLabel: THREE.Sprite | null = null;

	// ── Path group ──
	const pathGroup = new THREE.Group();
	scene.add(pathGroup);

	// ── Flow particles ──
	type FlowParticle = { mesh: THREE.Mesh; r1: number; c1: number; r2: number; c2: number; speed: number; t: number; rotY: number };
	let flowParticles: FlowParticle[] = [];
	const flowGroup = new THREE.Group();
	scene.add(flowGroup);

	// ── Sink arrows (current flowing into instances) ──
	type SinkArrow = { mesh: THREE.Mesh; col: number; row: number; speed: number; t: number };
	let sinkArrows: SinkArrow[] = [];
	const sinkGroup = new THREE.Group();
	scene.add(sinkGroup);

	// ── Build ──
	function buildGrid() {
		buildWires();
		buildInstances();
		buildBumps();
	}

	buildGrid();

	// ── Update voltages / heatmap ──
	function updateVoltages() {
		// Compute dynamic color range from actual worst drop
		if (result) {
			let maxDrop = 0;
			for (let r = 0; r < rows; r++)
				for (let c = 0; c < cols; c++)
					maxDrop = Math.max(maxDrop, vdd - result.voltageMap[r][c]);
			colorRangeMax = Math.max(maxDrop * 1.1, 0.001); // 10% headroom
		}

		for (const wd of wireMeshes) {
			const mat = wd.mesh.material as THREE.MeshBasicMaterial;
			if (result && showHeatmap) {
				const v1 = result.voltageMap[wd.r1][wd.c1];
				const v2 = result.voltageMap[wd.r2][wd.c2];
				mat.color.copy(voltageToColor((v1 + v2) / 2));
			} else {
				mat.color.setHex(0x8eaacc);
			}
		}

		// Heatmap plane vertex colors
		if (result && showHeatmap) {
			const posAttr = hmGeo.getAttribute('position');
			const colArr = new Float32Array(posAttr.count * 3);
			// PlaneGeometry is in XY, rotated -PI/2 around X → local X=world X, local Y=world -Z
			// Plane centered at (cx, 0.45, cz), size (cols-1, rows-1)
			// Local X range: [-(cols-1)/2, (cols-1)/2] → world col = localX + cx
			// Local Y range: [-(rows-1)/2, (rows-1)/2] → world row = -localY + cz
			for (let i = 0; i < posAttr.count; i++) {
				const lx = posAttr.getX(i);
				const ly = posAttr.getY(i);
				const c = Math.round(lx + cx);
				const r = Math.round(-ly + cz);
				const rc = Math.max(0, Math.min(rows - 1, r));
				const cc = Math.max(0, Math.min(cols - 1, c));
				const v = result.voltageMap[rc][cc];
				const col = voltageToColor(v);
				colArr[i * 3] = col.r;
				colArr[i * 3 + 1] = col.g;
				colArr[i * 3 + 2] = col.b;
			}
			hmGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
			hmMesh.visible = true;
		} else {
			hmMesh.visible = false;
		}

		// Voltage labels
		while (voltLabelGroup.children.length > 0) {
			const child = voltLabelGroup.children[0];
			voltLabelGroup.remove(child);
			if ((child as THREE.Sprite).material) {
				const spriteMat = (child as THREE.Sprite).material as THREE.SpriteMaterial;
				spriteMat.map?.dispose();
				spriteMat.dispose();
			}
		}

		if (result) {
			for (const [id] of activeSources) {
				const inst = grid.instances.find(i => i.id === id);
				if (!inst) continue;
				const v = result.voltageMap[inst.row][inst.col];
				const drop = (vdd - v) * 1000;
				const colorStr = drop < 5 ? '#66ffaa' : drop < 15 ? '#ffdd44' : '#ff6666';
				const label = makeTextSprite(`${v.toFixed(3)}V`, colorStr, 48, true);
				label.position.set(inst.col, INST_H + 0.2, inst.row);
				voltLabelGroup.add(label);
			}

			// Worst drop marker
			let worstR = 0, worstC = 0, worstDrop = 0;
			for (let r = 0; r < rows; r++) {
				for (let c = 0; c < cols; c++) {
					const d = vdd - result.voltageMap[r][c];
					if (d > worstDrop) { worstDrop = d; worstR = r; worstC = c; }
				}
			}
			worstTorus.position.set(worstC, MESH_Y + 0.02, worstR);
			worstTorus.visible = true;

			if (worstLabel) {
				scene.remove(worstLabel);
				const wlMat = worstLabel.material as THREE.SpriteMaterial;
				wlMat.map?.dispose();
				wlMat.dispose();
			}
			worstLabel = makeTextSprite(`Worst: ${(worstDrop * 1000).toFixed(1)} mV`, '#ff6666', 40, true);
			worstLabel.position.set(worstC, MESH_Y + 0.55, worstR);
			scene.add(worstLabel);
		} else {
			worstTorus.visible = false;
			if (worstLabel) {
				scene.remove(worstLabel);
				const wlMat = worstLabel.material as THREE.SpriteMaterial;
				wlMat.map?.dispose();
				wlMat.dispose();
				worstLabel = null;
			}
		}

		buildFlowParticles();
		buildSinkArrows();
	}

	// ── Flow particles (directional arrows) ──
	function buildFlowParticles() {
		while (flowGroup.children.length > 0) {
			const child = flowGroup.children[0] as THREE.Mesh;
			flowGroup.remove(child);
			child.geometry.dispose();
			(child.material as THREE.Material).dispose();
		}
		flowParticles = [];

		if (!result || !showFlow) return;

		// Cone points along +Y by default; rotate PI/2 around X to point tip along +Z, then rotateY for direction
		const arrowGeo = new THREE.ConeGeometry(0.12, 0.32, 8);
		arrowGeo.rotateX(Math.PI / 2); // now tip points along +Z

		// Find max current for relative sizing
		let maxI = 0;
		for (const wd of wireMeshes) {
			const I = Math.abs(getEdgeI(wd.r1, wd.c1, wd.r2, wd.c2));
			if (I > maxI) maxI = I;
		}
		if (maxI < 0.0001) return;

		for (const wd of wireMeshes) {
			const rawI = getEdgeI(wd.r1, wd.c1, wd.r2, wd.c2);
			const I = Math.abs(rawI);
			if (I < maxI * 0.05) continue;
			const rel = I / maxI;
			const count = Math.min(5, Math.max(1, Math.round(rel * 4)));
			const hue = 0.55 - rel * 0.15;
			const particleColor = new THREE.Color().setHSL(hue, 1.0, 0.55 + rel * 0.25);
			const particleMat = new THREE.MeshBasicMaterial({ color: particleColor, toneMapped: false });

			// Direction: current flows from source toward sink
			const forward = rawI >= 0;
			const r1 = forward ? wd.r1 : wd.r2, c1 = forward ? wd.c1 : wd.c2;
			const r2 = forward ? wd.r2 : wd.r1, c2 = forward ? wd.c2 : wd.c1;

			// Rotation: cone base geometry points +Z; compute angle to align with wire direction
			const dx = c2 - c1; // world X
			const dz = r2 - r1; // world Z
			const rotY = -Math.atan2(dz, dx) + Math.PI / 2; // rotate to face (dx, dz)

			for (let p = 0; p < count; p++) {
				const mesh = new THREE.Mesh(arrowGeo, particleMat);
				const arrowScale = 0.7 + rel * 0.6;
				mesh.scale.setScalar(arrowScale);
				mesh.rotation.y = rotY;
				flowGroup.add(mesh);
				flowParticles.push({
					mesh, r1, c1, r2, c2,
					speed: 0.5 + rel * 1.5, t: p / count, rotY
				});
			}
		}
	}

	// ── Sink arrows (current flowing down into instances) ──
	function buildSinkArrows() {
		while (sinkGroup.children.length > 0) {
			const child = sinkGroup.children[0] as THREE.Mesh;
			sinkGroup.remove(child);
			child.geometry.dispose();
			(child.material as THREE.Material).dispose();
		}
		sinkArrows = [];

		if (!result || !showFlow) return;

		// Cone pointing downward (-Y)
		const sinkGeo = new THREE.ConeGeometry(0.10, 0.24, 8);
		sinkGeo.rotateX(Math.PI); // tip points -Y (downward)

		const sinkMat = new THREE.MeshBasicMaterial({ color: 0xff6666, toneMapped: false });

		for (const [id, currentMa] of activeSources) {
			if (currentMa <= 0) continue;
			const inst = grid.instances.find(i => i.id === id);
			if (!inst) continue;

			const count = Math.min(3, Math.max(1, Math.round(currentMa / 30)));
			for (let p = 0; p < count; p++) {
				const mesh = new THREE.Mesh(sinkGeo, sinkMat);
				sinkGroup.add(mesh);
				sinkArrows.push({
					mesh, col: inst.col, row: inst.row,
					speed: 0.8 + (currentMa / 100) * 0.6,
					t: p / count
				});
			}
		}
	}

	// ── Selection ──
	function updateSelection() {
		for (const im of instMeshes) {
			const mat = im.mesh.material as THREE.MeshStandardMaterial;
			const isActive = activeSources.has(im.inst.id);
			const isSelected = selectedLoadId === im.inst.id;

			if (isSelected) {
				mat.color.setHex(0xfbbf24);
				mat.emissive.setHex(0xfbbf24);
				mat.emissiveIntensity = 0.5;
				im.mesh.scale.setScalar(1.35);
			} else if (isActive) {
				mat.color.setHex(0xf87171);
				mat.emissive.setHex(0xf87171);
				mat.emissiveIntensity = 0.3;
				im.mesh.scale.setScalar(1.25);
			} else {
				mat.color.setHex(0x9b59b6);
				mat.emissive.setHex(0x9b59b6);
				mat.emissiveIntensity = 0.2;
				im.mesh.scale.setScalar(1.0);
			}
		}
	}

	// ── Path visualization ──
	function updatePath() {
		while (pathGroup.children.length > 0) {
			const child = pathGroup.children[0];
			pathGroup.remove(child);
			if ((child as any).geometry) (child as any).geometry.dispose();
			if ((child as any).material) {
				const mat = (child as any).material;
				if (mat.map) mat.map.dispose();
				mat.dispose();
			}
		}

		if (!selectedLoadId || !result) { onPathUpdate?.(null); return; }

		const inst = grid.instances.find(i => i.id === selectedLoadId);
		if (!inst) { onPathUpdate?.(null); return; }

		const { path, bumpFound } = tracePath(inst.row, inst.col);
		if (path.length < 2) { onPathUpdate?.(null); return; }

		const steps: PathStep[] = [];
		for (let i = 0; i < path.length - 1; i++) {
			const [r1, c1] = path[i], [r2, c2] = path[i + 1];
			const R = getEdgeR(r1, c1, r2, c2) ?? 0;
			const I = getEdgeI(r1, c1, r2, c2);
			const v1 = result.voltageMap[r1][c1];
			const v2 = result.voltageMap[r2][c2];
			steps.push({
				fromR: r1, fromC: c1, toR: r2, toC: c2,
				resistance: R, current: Math.abs(I),
				segmentDrop: Math.abs(v1 - v2),
				voltageAfter: v2
			});

			const midX = (c1 + c2) / 2, midZ = (r1 + r2) / 2;
			const isHoriz = r1 === r2;
			const tubeGeo = new THREE.BoxGeometry(isHoriz ? 1.0 : 0.16, 0.16, isHoriz ? 0.16 : 1.0);
			const tubeMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.85 });
			const tube = new THREE.Mesh(tubeGeo, tubeMat);
			tube.position.set(midX, MESH_Y + 0.01, midZ);
			pathGroup.add(tube);

			// V=IR annotation — offset perpendicular to wire so it doesn't overlap voltage labels
			const absI = Math.abs(I);
			const dV = Math.abs(v1 - v2) * 1000;
			const segLabel = makeTextSprite(
				`${(R * 1000).toFixed(0)}mΩ × ${(absI * 1000).toFixed(0)}mA = ${dV.toFixed(1)}mV`,
				'#ffdd88', 36, true
			);
			const perpOffset = 0.45;
			const offX = isHoriz ? 0 : perpOffset;
			const offZ = isHoriz ? perpOffset : 0;
			segLabel.position.set(midX + offX, MESH_Y - 0.15, midZ + offZ);
			segLabel.scale.set(2.2, 0.28, 1);
			pathGroup.add(segLabel);
		}

		// Voltage labels along path — placed above the wire
		for (let i = 0; i < path.length; i++) {
			const [r, c] = path[i];
			const v = result.voltageMap[r][c];
			const drop = (vdd - v) * 1000;
			const colorStr = drop < 5 ? '#66ffaa' : drop < 15 ? '#ffdd44' : '#ff6666';
			const label = makeTextSprite(`${v.toFixed(3)}V`, colorStr, 48, true);
			label.position.set(c, MESH_Y + 0.75, r);
			label.scale.set(1.4, 0.35, 1);
			pathGroup.add(label);
		}

		onPathUpdate?.(steps);
	}

	// ── Click (debounced to distinguish single vs double, and drag vs click) ──
	let clickTimer: ReturnType<typeof setTimeout> | null = null;
	let pointerDownPos: { x: number; y: number } | null = null;
	const DRAG_THRESHOLD = 5; // pixels

	function raycastInstance(e: { clientX: number; clientY: number }): Instance | null {
		const domRect = renderer.domElement.getBoundingClientRect();
		mouse.x = ((e.clientX - domRect.left) / domRect.width) * 2 - 1;
		mouse.y = -((e.clientY - domRect.top) / domRect.height) * 2 + 1;
		raycaster.setFromCamera(mouse, camera);
		const instObjects = instMeshes.map(im => im.mesh);
		const hits = raycaster.intersectObjects(instObjects);
		if (hits.length > 0) {
			const data = (hits[0].object as any).userData;
			if (data?.type === 'instance' && data.inst) return data.inst as Instance;
		}
		return null;
	}

	function onPointerDown(e: PointerEvent) {
		pointerDownPos = { x: e.clientX, y: e.clientY };
	}

	function onPointerUp(e: PointerEvent) {
		if (!pointerDownPos) return;
		const dx = e.clientX - pointerDownPos.x;
		const dy = e.clientY - pointerDownPos.y;
		pointerDownPos = null;
		if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) return;

		const inst = raycastInstance(e);
		if (!inst) return;
		if (clickTimer) clearTimeout(clickTimer);
		clickTimer = setTimeout(() => {
			clickTimer = null;
			onInstanceClick?.(inst);
		}, 250);
	}

	function onDblClick(e: MouseEvent) {
		// Cancel pending single-click
		if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
		const inst = raycastInstance(e);
		if (inst) onInstanceDblClick?.(inst);
	}

	// ── Hover ──
	function onPointerMove(e: PointerEvent) {
		const domRect = renderer.domElement.getBoundingClientRect();
		mouse.x = ((e.clientX - domRect.left) / domRect.width) * 2 - 1;
		mouse.y = -((e.clientY - domRect.top) / domRect.height) * 2 + 1;
		raycaster.setFromCamera(mouse, camera);

		const wireObjects = wireMeshes.map(wm => wm.mesh);
		const hits = raycaster.intersectObjects(wireObjects);
		if (hits.length > 0) {
			const hitMesh = hits[0].object;
			const wd = wireMeshes.find(w => w.mesh === hitMesh);
			if (wd) {
				const voltage = result ? (result.voltageMap[wd.r1][wd.c1] + result.voltageMap[wd.r2][wd.c2]) / 2 : vdd;
				const drop = vdd - voltage;
				const R = getEdgeR(wd.r1, wd.c1, wd.r2, wd.c2);
				const I = result ? getEdgeI(wd.r1, wd.c1, wd.r2, wd.c2) : 0;
				const segDrop = result ? Math.abs(result.voltageMap[wd.r1][wd.c1] - result.voltageMap[wd.r2][wd.c2]) : 0;
				onNodeHover?.({ row: wd.r1, col: wd.c1, voltage, drop, resistance: R ?? undefined, current: Math.abs(I), segDrop });
				return;
			}
		}

		const instObjects = instMeshes.map(im => im.mesh);
		const instHits = raycaster.intersectObjects(instObjects);
		if (instHits.length > 0) {
			const data = (instHits[0].object as any).userData;
			if (data?.type === 'instance' && data.inst) {
				const inst = data.inst as Instance;
				const voltage = result ? result.voltageMap[inst.row][inst.col] : vdd;
				const drop = vdd - voltage;
				onNodeHover?.({ row: inst.row, col: inst.col, voltage, drop });
				return;
			}
		}

		onNodeHover?.(null);
	}

	renderer.domElement.addEventListener('pointerdown', onPointerDown);
	renderer.domElement.addEventListener('pointerup', onPointerUp);
	renderer.domElement.addEventListener('dblclick', onDblClick);
	renderer.domElement.addEventListener('pointermove', onPointerMove);

	// ── Resize ──
	const ro = new ResizeObserver((entries) => {
		for (const entry of entries) {
			const cr = entry.contentRect;
			w = cr.width || 800;
			h = cr.height || 600;
			renderer.setSize(w, h);
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
		}
	});
	ro.observe(container);

	// ── Animation loop ──
	let animId = 0;
	const clock = new THREE.Clock();

	function animate() {
		animId = requestAnimationFrame(animate);
		const dt = clock.getDelta();
		const elapsed = clock.getElapsedTime();

		controls.update();

		// Flow particles
		for (const fp of flowParticles) {
			fp.t += fp.speed * dt;
			if (fp.t > 1) fp.t -= 1;
			if (fp.t < 0) fp.t += 1;
			const x = fp.c1 + (fp.c2 - fp.c1) * fp.t;
			const z = fp.r1 + (fp.r2 - fp.r1) * fp.t;
			fp.mesh.position.set(x, MESH_Y + 0.15, z);
		}

		// Sink arrows — animate downward from mesh into instance
		for (const sa of sinkArrows) {
			sa.t += sa.speed * dt;
			if (sa.t > 1) sa.t -= 1;
			const y = MESH_Y - sa.t * (MESH_Y - INST_H);
			sa.mesh.position.set(sa.col, y, sa.row);
		}

		// Pulse worst torus
		if (worstTorus.visible) {
			worstTorusMat.opacity = 0.5 + 0.4 * Math.sin(elapsed * 4);
		}

		// Pulse path tubes
		for (const child of pathGroup.children) {
			if ((child as THREE.Mesh).isMesh && !(child as any).isSprite) {
				const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
				if (mat.transparent) {
					mat.opacity = 0.6 + 0.25 * Math.sin(elapsed * 3);
				}
			}
		}

		renderer.render(scene, camera);
	}

	animate();
	sceneReady = true;

	api = {
		rebuild() { buildGrid(); },
		updateVoltages,
		updateFlow() { buildFlowParticles(); buildSinkArrows(); },
		updateSelection,
		updatePath
	};

	cleanup = () => {
		cancelAnimationFrame(animId);
		ro.disconnect();
		renderer.domElement.removeEventListener('pointerdown', onPointerDown);
		renderer.domElement.removeEventListener('pointerup', onPointerUp);
		renderer.domElement.removeEventListener('dblclick', onDblClick);
		renderer.domElement.removeEventListener('pointermove', onPointerMove);
		controls.dispose();
		renderer.dispose();
		if (container.contains(renderer.domElement)) {
			container.removeChild(renderer.domElement);
		}
	};
}
</script>

<div class="ir-drop-3d" bind:this={container}>
	{#if !sceneReady}
		<div class="loading">Loading 3D scene…</div>
	{/if}
</div>

<style>
.ir-drop-3d { width: 100%; height: 100%; position: relative; }
.loading {
	position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
	color: #8eaacc; font: 600 1.1rem/1 system-ui; background: #0a0e1a;
}
</style>
