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

	// Imperative scene API — set inside onMount, used by $effects
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

		const { rows, cols } = grid.config;
		const rect = container.getBoundingClientRect();
		let w = rect.width;
		let h = rect.height;

		// ── Scene ──
		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x070b18);

		const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 200);
		camera.position.set(14, 11, 16);

		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(w, h);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.3;
		container.appendChild(renderer.domElement);

		const controls = new OrbitControls(camera, renderer.domElement);
		controls.target.set((cols - 1) / 2, 0, (rows - 1) / 2);
		controls.enableDamping = true;
		controls.dampingFactor = 0.07;
		controls.minDistance = 4;
		controls.maxDistance = 40;
		controls.maxPolarAngle = Math.PI / 2.05;
		controls.update();

		// ── Lighting ──
		scene.add(new THREE.AmbientLight(0x354060, 0.8));

		const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
		dirLight.position.set(12, 18, 10);
		dirLight.castShadow = true;
		dirLight.shadow.mapSize.set(1024, 1024);
		dirLight.shadow.camera.near = 1;
		dirLight.shadow.camera.far = 50;
		dirLight.shadow.camera.left = -15;
		dirLight.shadow.camera.right = 15;
		dirLight.shadow.camera.top = 15;
		dirLight.shadow.camera.bottom = -15;
		scene.add(dirLight);

		const accentLight = new THREE.PointLight(0x4f8ff7, 0.5, 40);
		accentLight.position.set((cols - 1) / 2, 8, (rows - 1) / 2);
		scene.add(accentLight);

		// ── Groups ──
		const gridGroup = new THREE.Group();
		const pathGroup = new THREE.Group();
		scene.add(gridGroup);
		scene.add(pathGroup);

		// ── Shared geometries ──
		const nodeGeo = new THREE.SphereGeometry(0.045, 10, 10);
		const nodeMat = new THREE.MeshStandardMaterial({
			color: 0x505878,
			roughness: 0.6,
			metalness: 0.5
		});
		const bumpGeo = new THREE.CylinderGeometry(0.13, 0.16, 0.35, 20);
		const instanceGeo = new THREE.BoxGeometry(0.26, 0.22, 0.26);
		const particleGeo = new THREE.SphereGeometry(0.09, 12, 12);

		let clickables: any[] = [];

		// ── Grid ↔ World ──
		function g2w(row: number, col: number, y = 0) {
			return new THREE.Vector3(col, y, row);
		}

		// ── Build grid meshes ──
		function buildGrid() {
			gridGroup.clear();
			clickables = [];

			const r = grid.config.rows;
			const c = grid.config.cols;

			// Ground
			const groundGeo = new THREE.PlaneGeometry(c + 4, r + 4);
			const groundMat = new THREE.MeshStandardMaterial({
				color: 0x0b0f1e,
				roughness: 0.95,
				metalness: 0.1
			});
			const ground = new THREE.Mesh(groundGeo, groundMat);
			ground.rotation.x = -Math.PI / 2;
			ground.position.set((c - 1) / 2, -0.02, (r - 1) / 2);
			ground.receiveShadow = true;
			gridGroup.add(ground);

			// Subtle grid helper
			const gh = new THREE.GridHelper(
				Math.max(r, c) - 1,
				Math.max(r, c) - 1,
				0x1a2040,
				0x10152a
			);
			gh.position.set((c - 1) / 2, 0.001, (r - 1) / 2);
			gridGroup.add(gh);

			// Metal traces
			for (let row = 0; row < r; row++) {
				for (let col = 0; col < c; col++) {
					const res = grid.resistances[row][col];
					if (res.right !== null && col < c - 1) addTrace(col, row, col + 1, row, res.right);
					if (res.down !== null && row < r - 1) addTrace(col, row, col, row + 1, res.down);
				}
			}

			// Node spheres
			for (let row = 0; row < r; row++) {
				for (let col = 0; col < c; col++) {
					if (findBumpAt(grid, row, col) || findInstanceAt(grid, row, col)) continue;
					const m = new THREE.Mesh(nodeGeo, nodeMat);
					m.position.copy(g2w(row, col, 0.03));
					gridGroup.add(m);
				}
			}

			// Bumps
			for (const domain of grid.domains) {
				const col = new THREE.Color(domain.color);
				for (const bump of domain.bumps) {
					const mat = new THREE.MeshStandardMaterial({
						color: col,
						roughness: 0.25,
						metalness: 0.65,
						emissive: col,
						emissiveIntensity: 0.15
					});
					const m = new THREE.Mesh(bumpGeo, mat);
					m.position.copy(g2w(bump.row, bump.col, 0.175));
					m.castShadow = true;
					m.userData = { type: 'bump', bump, domain };
					gridGroup.add(m);
					clickables.push(m);
				}
			}

			// Instances
			for (const inst of grid.instances) {
				const mat = new THREE.MeshStandardMaterial({
					color: 0x9b59b6,
					roughness: 0.3,
					metalness: 0.5,
					emissive: 0x9b59b6,
					emissiveIntensity: 0.1
				});
				const m = new THREE.Mesh(instanceGeo, mat);
				m.position.copy(g2w(inst.row, inst.col, 0.11));
				m.castShadow = true;
				m.userData = { type: 'instance', instance: inst };
				gridGroup.add(m);
				clickables.push(m);
			}
		}

		function addTrace(c1: number, r1: number, c2: number, r2: number, resistance: number) {
			const maxR = 0.2,
				minR = 0.05;
			const t = 1 - Math.min(1, Math.max(0, (resistance - minR) / (maxR - minR)));
			const tw = 0.03 + t * 0.09;
			const th = 0.018 + t * 0.012;
			const horiz = r1 === r2;

			const geo = new THREE.BoxGeometry(horiz ? 1.0 : tw, th, horiz ? tw : 1.0);
			const mat = new THREE.MeshStandardMaterial({
				color: 0x708090,
				roughness: 0.35,
				metalness: 0.85
			});
			const m = new THREE.Mesh(geo, mat);
			m.position.set((c1 + c2) / 2, th / 2, (r1 + r2) / 2);
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
					mat.emissiveIntensity = sel ? 0.6 : 0.1;
					obj.scale.setScalar(sel ? 1.15 : 1.0);
				}

				if (obj.userData.type === 'bump') {
					const domain = obj.userData.domain as Domain;
					const sel = selectedTarget?.id === domain.id;
					mat.emissiveIntensity = sel ? 0.55 : 0.15;
					obj.scale.setScalar(sel ? 1.25 : 1.0);
				}
			});
		}

		// ── Path animation state ──
		const PATH_COLORS = [0xff6b6b, 0x4f8ff7, 0x22c55e, 0xfbbf24, 0xa78bfa, 0xf472b6, 0x22d3ee, 0xfb923c];
		let animActive = false;
		let currentAnimPaths: PathResult[] = [];
		let currentPathIdx = 0;
		let segIdx = 0;
		let segProgress = 0;
		let completedPathMeshes: any[] = [];
		let trailLine: any | null = null;
		let trailPositions: Float32Array | null = null;
		let trailGeo: any | null = null;
		let particle: any | null = null;
		let interPathDelay = 0;
		let localAnimSpeed = 1.0;
		let flowParticles: { mesh: any; pathIdx: number; phase: number; speed: number }[] = [];

		function clearPathGroup() {
			pathGroup.clear();
			trailLine = null;
			trailGeo = null;
			trailPositions = null;
			particle = null;
			completedPathMeshes = [];
			flowParticles = [];
			animActive = false;
		}

		function startAnimation(paths: PathResult[]) {
			clearPathGroup();
			if (paths.length === 0) return;

			currentAnimPaths = paths;
			currentPathIdx = 0;
			segIdx = 0;
			segProgress = 0;
			interPathDelay = 0;
			animActive = true;

			setupTrailForPath(0);
		}

		function setupTrailForPath(idx: number) {
			// Remove old trail/particle
			if (trailLine) pathGroup.remove(trailLine);
			if (particle) pathGroup.remove(particle);

			const path = currentAnimPaths[idx].path;
			const maxVerts = path.length + 1;
			trailPositions = new Float32Array(maxVerts * 3);
			trailGeo = new THREE.BufferGeometry();
			trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
			trailGeo.setDrawRange(0, 0);

			const color = PATH_COLORS[idx % PATH_COLORS.length];
			const mat = new THREE.LineBasicMaterial({ color });
			trailLine = new THREE.Line(trailGeo, mat);
			pathGroup.add(trailLine);

			// Particle
			const pMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
			particle = new THREE.Mesh(particleGeo, pMat);
			particle.position.copy(g2w(path[0].row, path[0].col, 0.08));
			pathGroup.add(particle);

			segIdx = 0;
			segProgress = 0;
		}

		function addCompletedPath(idx: number) {
			const pathNodes = currentAnimPaths[idx].path;
			const color = PATH_COLORS[idx % PATH_COLORS.length];

			// Build tube
			const curvePath = new (THREE.CurvePath as any)();
			for (let i = 0; i < pathNodes.length - 1; i++) {
				const p1 = g2w(pathNodes[i].row, pathNodes[i].col, 0.065);
				const p2 = g2w(pathNodes[i + 1].row, pathNodes[i + 1].col, 0.065);
				curvePath.add(new THREE.LineCurve3(p1, p2));
			}

			const tubeGeo = new THREE.TubeGeometry(curvePath, pathNodes.length * 4, 0.035, 8, false);
			const tubeMat = new THREE.MeshBasicMaterial({
				color,
				transparent: true,
				opacity: 0.75
			});
			const tube = new THREE.Mesh(tubeGeo, tubeMat);
			pathGroup.add(tube);
			completedPathMeshes.push(tube);

			// Add flowing particles for this path
			for (let p = 0; p < 3; p++) {
				const fpMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
				const fp = new THREE.Mesh(particleGeo, fpMat);
				fp.scale.setScalar(0.7);
				pathGroup.add(fp);
				flowParticles.push({
					mesh: fp,
					pathIdx: idx,
					phase: p / 3,
					speed: 0.0006 + Math.random() * 0.0003
				});
			}
		}

		function tickAnimation(dt: number) {
			if (!animActive || currentAnimPaths.length === 0) return;

			// Inter-path delay
			if (interPathDelay > 0) {
				interPathDelay -= dt;
				return;
			}

			const path = currentAnimPaths[currentPathIdx].path;
			const totalSegs = path.length - 1;
			const speed = 0.035 * localAnimSpeed;

			segProgress += speed;

			if (segProgress >= 1) {
				segProgress = 0;
				segIdx++;

				if (segIdx >= totalSegs) {
					// Path complete
					if (trailLine) pathGroup.remove(trailLine);
					if (particle) pathGroup.remove(particle);
					trailLine = null;
					particle = null;

					addCompletedPath(currentPathIdx);
					currentPathIdx++;

					if (currentPathIdx < currentAnimPaths.length) {
						interPathDelay = 800 / localAnimSpeed;
						setupTrailForPath(currentPathIdx);
					} else {
						animActive = false;
						onAnimationDone?.();
					}
					return;
				}
			}

			// Update trail line
			if (trailPositions && trailGeo) {
				for (let i = 0; i <= segIdx; i++) {
					trailPositions[i * 3] = path[i].col;
					trailPositions[i * 3 + 1] = 0.065;
					trailPositions[i * 3 + 2] = path[i].row;
				}
				// Partial segment end
				const vi = segIdx + 1;
				const curr = path[segIdx];
				const next = path[Math.min(segIdx + 1, totalSegs)];
				trailPositions[vi * 3] = curr.col + (next.col - curr.col) * segProgress;
				trailPositions[vi * 3 + 1] = 0.065;
				trailPositions[vi * 3 + 2] = curr.row + (next.row - curr.row) * segProgress;
				trailGeo.setDrawRange(0, vi + 1);
				trailGeo.attributes.position.needsUpdate = true;
			}

			// Move particle
			if (particle) {
				const curr = path[segIdx];
				const next = path[Math.min(segIdx + 1, totalSegs)];
				particle.position.set(
					curr.col + (next.col - curr.col) * segProgress,
					0.08,
					curr.row + (next.row - curr.row) * segProgress
				);
			}
		}

		function tickFlowParticles(time: number) {
			for (const fp of flowParticles) {
				const pathNodes = currentAnimPaths[fp.pathIdx]?.path;
				if (!pathNodes || pathNodes.length < 2) continue;

				fp.phase = (fp.phase + fp.speed * localAnimSpeed) % 1;
				const totalSegs = pathNodes.length - 1;
				const pos = fp.phase * totalSegs;
				const si = Math.min(Math.floor(pos), totalSegs - 1);
				const sp = pos - si;

				const c = pathNodes[si];
				const n = pathNodes[si + 1];
				fp.mesh.position.set(
					c.col + (n.col - c.col) * sp,
					0.08,
					c.row + (n.row - c.row) * sp
				);
			}
		}

		// ── Click detection ──
		const raycaster = new THREE.Raycaster();
		const mouse = new THREE.Vector2();
		let pointerDown = { x: 0, y: 0 };

		function onPointerDown(e: PointerEvent) {
			pointerDown.x = e.clientX;
			pointerDown.y = e.clientY;
		}

		function onPointerUp(e: PointerEvent) {
			const dx = e.clientX - pointerDown.x;
			const dy = e.clientY - pointerDown.y;
			if (dx * dx + dy * dy > 36) return; // was a drag

			const rect = renderer.domElement.getBoundingClientRect();
			mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
			mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

			raycaster.setFromCamera(mouse, camera);
			const hits = raycaster.intersectObjects(clickables);
			if (hits.length === 0) return;

			const data = hits[0].object.userData;
			if (data.type === 'instance') onInstanceClick?.(data.instance as Instance);
			else if (data.type === 'bump') onDomainClick?.(data.domain as Domain);
		}

		renderer.domElement.addEventListener('pointerdown', onPointerDown);
		renderer.domElement.addEventListener('pointerup', onPointerUp);

		// ── Resize ──
		function onResize() {
			const rect = container.getBoundingClientRect();
			w = rect.width;
			h = rect.height;
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
			tickFlowParticles(now);
			renderer.render(scene, camera);
		}

		// ── Build initial scene ──
		buildGrid();
		updateSelection();
		loop();

		// ── Expose API ──
		api = {
			rebuild: () => {
				buildGrid();
				updateSelection();
			},
			updateSelection,
			animatePaths: startAnimation,
			clearPaths: clearPathGroup,
			setSpeed: (s) => {
				localAnimSpeed = s;
			}
		};
		sceneReady = true;

		cleanup = () => {
			running = false;
			renderer.domElement.removeEventListener('pointerdown', onPointerDown);
			renderer.domElement.removeEventListener('pointerup', onPointerUp);
			ro.disconnect();
			controls.dispose();
			renderer.dispose();
		};
	}

	// ── Reactive bridges ──
	$effect(() => {
		if (!sceneReady) return;
		void grid;
		api?.rebuild();
	});

	$effect(() => {
		if (!sceneReady) return;
		void selectedSource;
		void selectedTarget;
		api?.updateSelection();
	});

	$effect(() => {
		if (!sceneReady) return;
		const p = paths;
		if (p && p.length > 0) {
			api?.animatePaths(p);
		} else {
			api?.clearPaths();
		}
	});

	$effect(() => {
		api?.setSpeed(animSpeed);
	});
</script>

<div class="scene-container" bind:this={container}>
	{#if !sceneReady}
		<div class="loading">Initializing 3D view…</div>
	{/if}
</div>

<style>
	.scene-container {
		width: 100%;
		height: 100%;
		min-height: 400px;
		position: relative;
		border-radius: 12px;
		overflow: hidden;
		background: #070b18;
	}

	.scene-container :global(canvas) {
		display: block;
		cursor: grab;
	}

	.scene-container :global(canvas:active) {
		cursor: grabbing;
	}

	.loading {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #6b7294;
		font-size: 0.9rem;
	}
</style>
