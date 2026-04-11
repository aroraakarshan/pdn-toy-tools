<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';

	const navLinks = [
		{ href: `${base}/spr-visualizer`, label: '3D SPR Visualizer' },
		{ href: `${base}/ir-drop-visualizer`, label: 'IR Drop Visualizer' }
	];
</script>

<nav class="nav">
	<div class="nav-inner">
		<a href="{base}/" class="nav-brand">
			<span class="brand-icon">⚡</span>
			<span class="brand-text">PDN Toy Tools</span>
		</a>
		<div class="nav-links">
			{#each navLinks as link}
				<a
					href={link.href}
					class="nav-link"
					class:active={$page.url.pathname.startsWith(link.href)}
				>
					{link.label}
				</a>
			{/each}
			<a
				href="https://github.com/aroraakarshan/pdn-toy-tools"
				target="_blank"
				rel="noopener"
				class="nav-link nav-gh"
			>
				GitHub
			</a>
		</div>
	</div>
</nav>

<style>
	.nav {
		position: sticky;
		top: 0;
		z-index: 100;
		height: var(--nav-height);
		background: rgba(15, 17, 23, 0.85);
		backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--color-border);
	}

	.nav-inner {
		max-width: 1200px;
		margin: 0 auto;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 1.5rem;
	}

	.nav-brand {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		color: var(--color-text-primary);
		font-weight: 700;
		font-size: 1rem;
	}

	.brand-icon {
		font-size: 1.2rem;
	}

	.nav-links {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.nav-link {
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		text-decoration: none;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.15s ease;
	}

	.nav-link:hover {
		color: var(--color-text-primary);
		background: var(--color-bg-tertiary);
	}

	.nav-link.active {
		color: var(--color-accent-blue);
		background: rgba(79, 143, 247, 0.1);
	}

	.nav-gh {
		margin-left: 0.5rem;
	}

	@media (max-width: 640px) {
		.nav-links {
			gap: 0;
		}

		.nav-link {
			padding: 0.5rem;
			font-size: 0.8rem;
		}

		.brand-text {
			display: none;
		}
	}
</style>
