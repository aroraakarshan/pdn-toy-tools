<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';

	const navLinks = [
		{ href: `${base}/spr-visualizer`, label: '3D SPR Visualizer' },
		{ href: `${base}/ir-drop-visualizer`, label: '3D IR Drop Visualizer' }
	];
</script>

<nav class="nav">
	<div class="nav-inner">
		<a href="{base}/" class="nav-brand">
			<span class="brand-icon">
				<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
					<!-- PDN grid icon: two layers with vias -->
					<rect x="2" y="4" width="20" height="7" rx="1.5" stroke="var(--color-accent-cyan)" stroke-width="1.5" fill="none" opacity="0.8" />
					<rect x="2" y="13" width="20" height="7" rx="1.5" stroke="var(--color-accent-purple)" stroke-width="1.5" fill="none" opacity="0.8" />
					<!-- Vias -->
					<line x1="7" y1="11" x2="7" y2="13" stroke="var(--color-accent-blue)" stroke-width="2" stroke-linecap="round" />
					<line x1="12" y1="11" x2="12" y2="13" stroke="var(--color-accent-blue)" stroke-width="2" stroke-linecap="round" />
					<line x1="17" y1="11" x2="17" y2="13" stroke="var(--color-accent-blue)" stroke-width="2" stroke-linecap="round" />
					<!-- Horizontal traces -->
					<line x1="4" y1="7.5" x2="20" y2="7.5" stroke="var(--color-accent-cyan)" stroke-width="1" opacity="0.5" />
					<line x1="4" y1="16.5" x2="20" y2="16.5" stroke="var(--color-accent-purple)" stroke-width="1" opacity="0.5" />
					<!-- Current flow dot -->
					<circle cx="7" cy="7.5" r="1.5" fill="var(--color-accent-amber)" />
				</svg>
			</span>
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
		display: flex;
		align-items: center;
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
