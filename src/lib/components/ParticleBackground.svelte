<script lang="ts">
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null = null;
	let animFrame = 0;
	let mouseX = -1000;
	let mouseY = -1000;
	let width = 0;
	let height = 0;
	let scrollOffset = 0;

	interface Particle {
		x: number;
		y: number;
		vx: number;
		vy: number;
		size: number;
		opacity: number;
	}

	const PARTICLE_COUNT = 90;
	const LINK_DISTANCE = 160;
	const GRAB_DISTANCE = 200;
	const SPEED = 0.6;

	let particles: Particle[] = [];

	function initParticles() {
		particles = [];
		for (let i = 0; i < PARTICLE_COUNT; i++) {
			particles.push({
				x: Math.random() * width,
				y: Math.random() * height,
				vx: (Math.random() - 0.5) * SPEED * 2,
				vy: (Math.random() - 0.5) * SPEED * 2,
				size: 2 + Math.random() * 3,
				opacity: 0.4 + Math.random() * 0.5
			});
		}
	}

	function resize() {
		if (!canvas) return;
		const rect = canvas.parentElement!.getBoundingClientRect();
		width = rect.width;
		height = rect.height;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		ctx = canvas.getContext('2d');
		if (ctx) ctx.scale(dpr, dpr);
	}

	function draw() {
		if (!ctx) return;

		ctx.clearRect(0, 0, width, height);

		// Apply scroll-based parallax offset
		const parallaxY = scrollOffset * 0.15;

		// Update positions
		for (const p of particles) {
			p.x += p.vx;
			p.y += p.vy;

			if (p.x < 0) { p.x = 0; p.vx *= -1; }
			if (p.x > width) { p.x = width; p.vx *= -1; }
			if (p.y < 0) { p.y = 0; p.vy *= -1; }
			if (p.y > height) { p.y = height; p.vy *= -1; }
		}

		// Draw links between nearby particles
		for (let i = 0; i < particles.length; i++) {
			for (let j = i + 1; j < particles.length; j++) {
				const dx = particles[i].x - particles[j].x;
				const dy = (particles[i].y - parallaxY) - (particles[j].y - parallaxY);
				const dist = Math.sqrt(dx * dx + dy * dy);

				if (dist < LINK_DISTANCE) {
					const opacity = 0.25 * (1 - dist / LINK_DISTANCE);
					ctx.beginPath();
					ctx.moveTo(particles[i].x, particles[i].y - parallaxY);
					ctx.lineTo(particles[j].x, particles[j].y - parallaxY);
					ctx.strokeStyle = `rgba(56, 189, 248, ${opacity})`;
					ctx.lineWidth = 1;
					ctx.stroke();
				}
			}
		}

		// Draw grab lines to mouse — brighter, thicker
		for (const p of particles) {
			const drawY = p.y - parallaxY;
			const dx = p.x - mouseX;
			const dy = drawY - mouseY;
			const dist = Math.sqrt(dx * dx + dy * dy);

			if (dist < GRAB_DISTANCE) {
				const opacity = 0.6 * (1 - dist / GRAB_DISTANCE);
				ctx.beginPath();
				ctx.moveTo(p.x, drawY);
				ctx.lineTo(mouseX, mouseY);
				ctx.strokeStyle = `rgba(103, 232, 249, ${opacity})`;
				ctx.lineWidth = 1.2;
				ctx.stroke();

				// Gently attract particle toward mouse
				p.vx += (mouseX - p.x) * 0.0003;
				p.vy += (mouseY - drawY) * 0.0003;
			}
		}

		// Draw particles — bright cyan/blue squares
		for (const p of particles) {
			const drawY = p.y - parallaxY;
			const half = p.size / 2;
			// Outer glow
			ctx.fillStyle = `rgba(56, 189, 248, ${p.opacity * 0.15})`;
			ctx.fillRect(p.x - half - 2, drawY - half - 2, p.size + 4, p.size + 4);
			// Core particle
			ctx.fillStyle = `rgba(56, 189, 248, ${p.opacity})`;
			ctx.fillRect(p.x - half, drawY - half, p.size, p.size);
		}

		animFrame = requestAnimationFrame(draw);
	}

	function handleMouseMove(e: MouseEvent) {
		const rect = canvas.getBoundingClientRect();
		mouseX = e.clientX - rect.left;
		mouseY = e.clientY - rect.top;
	}

	function handleMouseLeave() {
		mouseX = -1000;
		mouseY = -1000;
	}

	function handleClick(e: MouseEvent) {
		const rect = canvas.getBoundingClientRect();
		const cx = e.clientX - rect.left;
		const cy = e.clientY - rect.top;
		for (let i = 0; i < 5; i++) {
			particles.push({
				x: cx,
				y: cy,
				vx: (Math.random() - 0.5) * SPEED * 5,
				vy: (Math.random() - 0.5) * SPEED * 5,
				size: 2 + Math.random() * 3,
				opacity: 0.5 + Math.random() * 0.4
			});
		}
		while (particles.length > PARTICLE_COUNT + 25) {
			particles.shift();
		}
	}

	onMount(() => {
		resize();
		initParticles();
		animFrame = requestAnimationFrame(draw);

		const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		function onScroll() {
			if (!prefersReduced) {
				scrollOffset = window.scrollY;
			}
		}
		window.addEventListener('scroll', onScroll, { passive: true });

		const ro = new ResizeObserver(() => {
			resize();
			if (particles.length === 0) initParticles();
		});
		ro.observe(canvas.parentElement!);

		return () => {
			cancelAnimationFrame(animFrame);
			ro.disconnect();
			window.removeEventListener('scroll', onScroll);
		};
	});
</script>

<div
	class="particles-container"
	role="presentation"
>
	<canvas
		bind:this={canvas}
		onmousemove={handleMouseMove}
		onmouseleave={handleMouseLeave}
		onclick={handleClick}
	></canvas>
</div>

<style>
	.particles-container {
		position: fixed;
		inset: 0;
		z-index: 0;
		pointer-events: auto;
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
