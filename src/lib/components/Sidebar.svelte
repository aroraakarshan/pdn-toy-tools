<script lang="ts">
	let {
		title = '',
		children,
		collapsed = $bindable(false)
	}: {
		title?: string;
		children?: import('svelte').Snippet;
		collapsed?: boolean;
	} = $props();
</script>

<aside class="sidebar" class:collapsed>
	<button class="sidebar-toggle" onclick={() => (collapsed = !collapsed)}>
		{collapsed ? '›' : '‹'}
	</button>
	<div class="sidebar-content">
		{#if title}
			<h3 class="sidebar-title">{title}</h3>
		{/if}
		{#if children}
			{@render children()}
		{/if}
	</div>
</aside>

<style>
	.sidebar {
		width: var(--sidebar-width);
		min-width: var(--sidebar-width);
		background: var(--color-bg-secondary);
		border-right: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		position: relative;
		transition: width 0.2s ease, min-width 0.2s ease;
		overflow: hidden;
	}

	.sidebar.collapsed {
		width: 0;
		min-width: 0;
		border-right: none;
	}

	.sidebar-toggle {
		position: absolute;
		top: 12px;
		right: -24px;
		width: 24px;
		height: 32px;
		background: var(--color-bg-tertiary);
		border: 1px solid var(--color-border);
		border-left: none;
		border-radius: 0 6px 6px 0;
		color: var(--color-text-secondary);
		cursor: pointer;
		font-size: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10;
	}

	.sidebar.collapsed .sidebar-toggle {
		right: -24px;
	}

	.sidebar-content {
		padding: 1.25rem;
		overflow-y: auto;
		flex: 1;
	}

	.sidebar-title {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--color-border);
	}

	@media (max-width: 768px) {
		.sidebar {
			position: fixed;
			left: 0;
			top: var(--nav-height);
			bottom: 0;
			z-index: 50;
			box-shadow: 4px 0 24px rgba(0, 0, 0, 0.4);
		}

		.sidebar.collapsed {
			left: calc(-1 * var(--sidebar-width));
			width: var(--sidebar-width);
			min-width: var(--sidebar-width);
		}
	}
</style>
