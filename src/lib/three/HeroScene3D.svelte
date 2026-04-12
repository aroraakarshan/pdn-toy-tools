<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';

	let container: HTMLDivElement;
	let frameId = 0;
	let renderer: THREE.WebGLRenderer | null = null;

	onMount(() => {
		const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		const scene = new THREE.Scene();
		scene.fog = new THREE.FogExp2(0x0f1117, 0.06);

		const camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 100);
		camera.position.set(6, 5, 8);
		camera.lookAt(0, 0.5, 0);

		renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
		renderer.setSize(container.clientWidth, container.clientHeight);
		renderer.setClearColor(0x000000, 0);
		container.appendChild(renderer.domElement);

		// Lighting — no shadows for performance
		const ambient = new THREE.AmbientLight(0x4f8ff7, 0.4);
		scene.add(ambient);

		const directional = new THREE.DirectionalLight(0xa78bfa, 0.8);
		directional.position.set(5, 8, 5);
		scene.add(directional);

		const pointLight = new THREE.PointLight(0x22d3ee, 0.6, 20);
		pointLight.position.set(-3, 3, -3);
		scene.add(pointLight);

		// Grid group
		const gridGroup = new THREE.Group();
		scene.add(gridGroup);

		const gridSize = 5;
		const spacing = 1.0;
		const offset = ((gridSize - 1) * spacing) / 2;

		// Materials
		const wireMat = new THREE.MeshPhongMaterial({
			color: 0x4f8ff7,
			transparent: true,
			opacity: 0.6,
			emissive: 0x1a3a6e,
			emissiveIntensity: 0.3,
		});

		const wireMatTop = new THREE.MeshPhongMaterial({
			color: 0xa78bfa,
			transparent: true,
			opacity: 0.6,
			emissive: 0x3a2070,
			emissiveIntensity: 0.3,
		});

		const viaMat = new THREE.MeshPhongMaterial({
			color: 0x22d3ee,
			transparent: true,
			opacity: 0.7,
			emissive: 0x0a4a5a,
			emissiveIntensity: 0.4,
		});

		const nodeMat = new THREE.MeshPhongMaterial({
			color: 0xfbbf24,
			transparent: true,
			opacity: 0.8,
			emissive: 0x5a4000,
			emissiveIntensity: 0.5,
		});

		// Shared geometries
		const wireGeo = new THREE.BoxGeometry(spacing, 0.06, 0.08);
		const wireGeoZ = new THREE.BoxGeometry(0.08, 0.06, spacing);
		const viaGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6);
		const nodeGeo = new THREE.SphereGeometry(0.1, 8, 8);

		// Bottom layer (M1) — horizontal wires
		for (let z = 0; z < gridSize; z++) {
			for (let x = 0; x < gridSize - 1; x++) {
				const wire = new THREE.Mesh(wireGeo, wireMat);
				wire.position.set(x * spacing - offset + spacing / 2, 0, z * spacing - offset);
				gridGroup.add(wire);
			}
		}

		// Top layer (M2) — vertical wires
		for (let x = 0; x < gridSize; x++) {
			for (let z = 0; z < gridSize - 1; z++) {
				const wire = new THREE.Mesh(wireGeoZ, wireMatTop);
				wire.position.set(x * spacing - offset, 0.8, z * spacing - offset + spacing / 2);
				gridGroup.add(wire);
			}
		}

		// Vias at intersections (sparse)
		for (let x = 0; x < gridSize; x++) {
			for (let z = 0; z < gridSize; z++) {
				if ((x + z) % 2 === 0) {
					const via = new THREE.Mesh(viaGeo, viaMat);
					via.position.set(x * spacing - offset, 0.4, z * spacing - offset);
					gridGroup.add(via);
				}
			}
		}

		// Highlight nodes at corners
		const corners = [
			[0, 0], [0, gridSize - 1],
			[gridSize - 1, 0], [gridSize - 1, gridSize - 1]
		];
		for (const [x, z] of corners) {
			const node = new THREE.Mesh(nodeGeo, nodeMat);
			node.position.set(x * spacing - offset, 0, z * spacing - offset);
			gridGroup.add(node);
		}

		// Current flow path (glowing tube)
		const pathPoints = [
			new THREE.Vector3(-offset, 0, -offset),
			new THREE.Vector3(-offset, 0.4, -offset),
			new THREE.Vector3(-offset, 0.8, -offset),
			new THREE.Vector3(-offset + spacing, 0.8, -offset),
			new THREE.Vector3(-offset + 2 * spacing, 0.8, -offset),
			new THREE.Vector3(-offset + 2 * spacing, 0.4, -offset),
			new THREE.Vector3(-offset + 2 * spacing, 0, -offset),
			new THREE.Vector3(-offset + 2 * spacing, 0, -offset + spacing),
			new THREE.Vector3(-offset + 2 * spacing, 0, -offset + 2 * spacing),
		];
		const pathCurve = new THREE.CatmullRomCurve3(pathPoints, false);
		const tubeGeo = new THREE.TubeGeometry(pathCurve, 32, 0.04, 6, false);
		const tubeMat = new THREE.MeshPhongMaterial({
			color: 0x34d399,
			emissive: 0x34d399,
			emissiveIntensity: 0.8,
			transparent: true,
			opacity: 0.9,
		});
		const tube = new THREE.Mesh(tubeGeo, tubeMat);
		gridGroup.add(tube);

		// Center the grid slightly
		gridGroup.position.y = -0.3;

		// Animation
		let time = 0;
		const rotationSpeed = prefersReduced ? 0 : 0.15;

		function animate() {
			frameId = requestAnimationFrame(animate);
			time += 0.016;

			gridGroup.rotation.y += rotationSpeed * 0.016;

			// Gentle bobbing
			if (!prefersReduced) {
				gridGroup.position.y = -0.3 + Math.sin(time * 0.5) * 0.08;
				pointLight.position.x = Math.sin(time * 0.3) * 4;
				pointLight.position.z = Math.cos(time * 0.3) * 4;
			}

			renderer!.render(scene, camera);
		}

		// Intersection observer — pause when offscreen
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						if (frameId === 0) frameId = requestAnimationFrame(animate);
					} else {
						cancelAnimationFrame(frameId);
						frameId = 0;
					}
				}
			},
			{ threshold: 0.05 }
		);
		observer.observe(container);

		// Start
		frameId = requestAnimationFrame(animate);

		// Resize handler
		const ro = new ResizeObserver(() => {
			if (!renderer) return;
			const w = container.clientWidth;
			const h = container.clientHeight;
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
			renderer.setSize(w, h);
		});
		ro.observe(container);

		return () => {
			cancelAnimationFrame(frameId);
			frameId = 0;
			observer.disconnect();
			ro.disconnect();
			renderer?.dispose();
			scene.clear();
		};
	});
</script>

<div class="hero-scene" bind:this={container}></div>

<style>
	.hero-scene {
		position: absolute;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		opacity: 0.5;
		mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 80%);
		-webkit-mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 80%);
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-scene {
			opacity: 0.3;
		}
	}

	@media (max-width: 768px) {
		.hero-scene {
			display: none;
		}
	}
</style>
