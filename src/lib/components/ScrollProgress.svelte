<script lang="ts">
	import { onMount } from 'svelte';

	let progressEl: HTMLDivElement;

	onMount(() => {
		const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (prefersReduced) return;

		function onScroll() {
			const scrollTop = document.documentElement.scrollTop;
			const docHeight = document.documentElement.scrollHeight - window.innerHeight;
			const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
			progressEl.style.width = `${progress}%`;
		}

		window.addEventListener('scroll', onScroll, { passive: true });
		onScroll();

		return () => window.removeEventListener('scroll', onScroll);
	});
</script>

<div class="scroll-progress-track">
	<div class="scroll-progress-bar" bind:this={progressEl}></div>
</div>

<style>
	.scroll-progress-track {
		position: fixed;
		top: var(--nav-height);
		left: 0;
		right: 0;
		height: 2px;
		z-index: 99;
		background: transparent;
	}

	.scroll-progress-bar {
		height: 100%;
		width: 0%;
		background: linear-gradient(90deg, var(--color-accent-cyan), var(--color-accent-blue), var(--color-accent-purple));
		transition: width 0.1s linear;
		border-radius: 0 1px 1px 0;
		box-shadow: 0 0 6px rgba(79, 143, 247, 0.4);
	}
</style>
