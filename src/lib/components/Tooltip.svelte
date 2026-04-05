<script lang="ts">
	let {
		visible = false,
		x = 0,
		y = 0,
		children
	}: {
		visible?: boolean;
		x?: number;
		y?: number;
		children?: import('svelte').Snippet;
	} = $props();
</script>

{#if visible && children}
	<div class="tooltip" style="left: {x + 12}px; top: {y - 8}px;">
		{@render children()}
	</div>
{/if}

<style>
	.tooltip {
		position: fixed;
		z-index: 200;
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 0.6rem 0.8rem;
		font-size: 0.8rem;
		color: var(--color-text-primary);
		pointer-events: none;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		max-width: 240px;
		line-height: 1.5;
	}
</style>
