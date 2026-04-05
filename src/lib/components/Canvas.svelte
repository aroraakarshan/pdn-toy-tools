<script lang="ts">
	import { onMount } from 'svelte';
	import type { Grid } from '$lib/engine/types';

	let {
		grid,
		width = $bindable(800),
		height = $bindable(600),
		onrender,
		onclick,
		onmousemove,
		onmouseleave
	}: {
		grid: Grid;
		width?: number;
		height?: number;
		onrender?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
		onclick?: (e: MouseEvent, canvas: HTMLCanvasElement) => void;
		onmousemove?: (e: MouseEvent, canvas: HTMLCanvasElement) => void;
		onmouseleave?: () => void;
	} = $props();

	let containerEl: HTMLDivElement;
	let canvasEl: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null = null;
	let dpr = 1;
	let animFrame = 0;

	function resize() {
		if (!containerEl || !canvasEl) return;
		const rect = containerEl.getBoundingClientRect();
		width = rect.width;
		height = rect.height;
		dpr = window.devicePixelRatio || 1;

		canvasEl.width = width * dpr;
		canvasEl.height = height * dpr;
		canvasEl.style.width = `${width}px`;
		canvasEl.style.height = `${height}px`;

		ctx = canvasEl.getContext('2d');
		if (ctx) {
			ctx.scale(dpr, dpr);
		}
	}

	function render() {
		if (ctx && onrender) {
			onrender(ctx, width, height);
		}
	}

	// Re-render whenever dependencies change
	$effect(() => {
		// Touch reactive deps
		grid;
		onrender;
		width;
		height;

		if (ctx) {
			cancelAnimationFrame(animFrame);
			animFrame = requestAnimationFrame(render);
		}
	});

	onMount(() => {
		resize();

		const ro = new ResizeObserver(() => {
			resize();
			render();
		});
		ro.observe(containerEl);

		return () => {
			ro.disconnect();
			cancelAnimationFrame(animFrame);
		};
	});

	function handleClick(e: MouseEvent) {
		if (onclick && canvasEl) onclick(e, canvasEl);
	}

	function handleMove(e: MouseEvent) {
		if (onmousemove && canvasEl) onmousemove(e, canvasEl);
	}

	function handleLeave() {
		if (onmouseleave) onmouseleave();
	}
</script>

<div class="canvas-container" bind:this={containerEl}>
	<canvas
		bind:this={canvasEl}
		onclick={handleClick}
		onmousemove={handleMove}
		onmouseleave={handleLeave}
	></canvas>
</div>

<style>
	.canvas-container {
		width: 100%;
		height: 100%;
		min-height: 400px;
		position: relative;
		border-radius: 12px;
		overflow: hidden;
		background: var(--color-canvas-bg);
	}

	canvas {
		display: block;
		cursor: crosshair;
	}
</style>
