<script lang="ts">
	let {
		title = 'Results',
		children
	}: {
		title?: string;
		children?: import('svelte').Snippet;
	} = $props();
</script>

<div class="results-panel">
	<h4 class="results-title">{title}</h4>
	<div class="results-body">
		{#if children}
			{@render children()}
		{/if}
	</div>
</div>

<style>
	.results-panel {
		background: var(--color-bg-tertiary);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		overflow: hidden;
	}

	.results-title {
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
		margin: 0;
		padding: 0.75rem 1rem;
		background: rgba(0, 0, 0, 0.15);
		border-bottom: 1px solid var(--color-border);
	}

	.results-body {
		padding: 0.75rem 1rem;
	}
</style>
