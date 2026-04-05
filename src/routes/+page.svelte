<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import ParticleBackground from '$lib/components/ParticleBackground.svelte';

	let mounted = $state(false);
	let sectionsEl: HTMLElement[] = [];

	onMount(() => {
		mounted = true;

		// Intersection Observer for scroll-in animations
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						entry.target.classList.add('visible');
						observer.unobserve(entry.target);
					}
				}
			},
			{ threshold: 0.1 }
		);

		// Observe all animated elements after a tick
		requestAnimationFrame(() => {
			document
				.querySelectorAll('.animate-in')
				.forEach((el) => observer.observe(el));
		});

		return () => observer.disconnect();
	});
</script>

<svelte:head>
	<title>PDN Toy Tools — Interactive Power Delivery Network Education</title>
	<meta
		name="description"
		content="Master Power Delivery Networks through interactive visualization. Explore SPR analysis, static IR drop, and more."
	/>
</svelte:head>

<ParticleBackground />

<section class="hero">
	<div class="hero-content" class:mounted>
		<h1>
			<span class="gradient-text">PDN Toy Tools</span>
		</h1>
		<p class="tagline">Master Power Delivery Networks Through Interactive Simulation</p>
		<p class="subtitle">
			An interactive suite of tools to help VLSI engineers analyze and debug complex power delivery
			network issues like Electromigration (EM) and IR Drop through real-time simulation.
		</p>
		<div class="hero-actions">
			<a href="#tools" class="btn btn-primary">Explore Tools <span>→</span></a>
			<a
				href="https://github.com/aroraakarshan/pdn-toy-tools"
				target="_blank"
				rel="noopener"
				class="btn btn-secondary">View on GitHub</a
			>
		</div>
	</div>
</section>

<section id="about" class="section animate-in">
	<div class="container">
		<h2>What is EMIR?</h2>
		<p class="section-intro">
			EMIR (Electromigration and IR Drop) is a critical challenge in modern VLSI design.
			<strong>Electromigration</strong> is the gradual displacement of metal atoms in a semiconductor,
			which can cause interconnects to fail. <strong>IR Drop</strong> is the voltage drop in the power
			delivery network, which can lead to timing violations and reduced performance.
		</p>
	</div>
</section>

<section id="tools" class="section">
	<div class="container">
		<h2 class="animate-in">Interactive Analysis Tools</h2>
		<div class="tools-grid">
			<a href="{base}/spr-visualizer" class="tool-card animate-in">
				<div class="tool-icon">
					<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
						<circle cx="8" cy="8" r="4" fill="var(--color-accent-cyan)" />
						<circle cx="40" cy="40" r="4" fill="var(--color-accent-purple)" />
						<path
							d="M12 8h8v16h8v16h8"
							stroke="var(--color-accent-blue)"
							stroke-width="2"
							stroke-linecap="round"
							stroke-dasharray="4 2"
						/>
						<circle cx="24" cy="24" r="2" fill="var(--color-accent-amber)" />
					</svg>
				</div>
				<h3>PDN SPR Visualizer</h3>
				<p>
					Analyze shortest path resistance in a power grid. Watch Dijkstra's algorithm find optimal
					current paths through the network in real-time.
				</p>
				<span class="tool-cta">Launch Tool →</span>
			</a>

			<a href="{base}/ir-drop-visualizer" class="tool-card animate-in">
				<div class="tool-icon">
					<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
						<rect x="4" y="4" width="40" height="40" rx="4" fill="var(--color-accent-red)" fill-opacity="0.15" />
						<rect x="8" y="8" width="32" height="32" rx="2" fill="var(--color-accent-amber)" fill-opacity="0.2" />
						<rect x="14" y="14" width="20" height="20" rx="1" fill="var(--color-accent-green)" fill-opacity="0.3" />
						<path d="M18 36l6-12 6 12" stroke="var(--color-accent-amber)" stroke-width="2" stroke-linecap="round" />
					</svg>
				</div>
				<h3>Static IR Drop Visualizer</h3>
				<p>
					Visualize voltage distribution using real Gauss-Seidel nodal analysis. See current flow
					and power dissipation across the network.
				</p>
				<span class="tool-cta">Launch Tool →</span>
			</a>
		</div>
	</div>
</section>

<section id="benefits" class="section">
	<div class="container">
		<h2 class="animate-in">Why Interactive Simulation Works</h2>
		<div class="benefits-grid">
			<div class="benefit-card animate-in">
				<span class="benefit-icon">🧠</span>
				<h4>Intuitive Understanding</h4>
				<p>See voltage distributions and current paths, not just numbers in a report.</p>
			</div>
			<div class="benefit-card animate-in">
				<span class="benefit-icon">⚡</span>
				<h4>Real Solvers</h4>
				<p>Gauss-Seidel nodal analysis and Dijkstra/Yen's algorithms — not approximations.</p>
			</div>
			<div class="benefit-card animate-in">
				<span class="benefit-icon">🔬</span>
				<h4>Safe Exploration</h4>
				<p>Experiment with parameters and see immediate results — no risk, instant feedback.</p>
			</div>
			<div class="benefit-card animate-in">
				<span class="benefit-icon">📐</span>
				<h4>Step-Through Mode</h4>
				<p>Watch algorithms solve step by step — understand the why, not just the what.</p>
			</div>
		</div>
	</div>
</section>

<footer class="footer">
	<div class="container">
		<p>
			Built by <a href="https://github.com/aroraakarshan" target="_blank" rel="noopener"
				>Akarshan Arora</a
			> — VLSI · PDN · EMIR
		</p>
	</div>
</footer>

<style>
	/* All landing page content sits above the particle canvas */
	.hero,
	:global(#about),
	:global(#tools),
	:global(#benefits),
	.footer {
		position: relative;
		z-index: 1;
	}

	.hero {
		min-height: calc(100vh - var(--nav-height));
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 2rem;
	}

	/* Hero entrance animation */
	.hero-content {
		max-width: 720px;
		opacity: 0;
		transform: translateY(30px);
		transition: opacity 0.8s ease, transform 0.8s ease;
	}

	.hero-content.mounted {
		opacity: 1;
		transform: translateY(0);
	}

	.hero h1 {
		font-size: clamp(2.5rem, 6vw, 4.5rem);
		font-weight: 700;
		margin: 0 0 1rem;
		line-height: 1.1;
	}

	.tagline {
		font-size: clamp(1.1rem, 2.5vw, 1.4rem);
		color: var(--color-text-secondary);
		margin: 0 0 1.5rem;
		font-weight: 500;
	}

	.subtitle {
		color: var(--color-text-muted);
		line-height: 1.7;
		margin: 0 0 2rem;
	}

	.hero-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		border-radius: 8px;
		font-weight: 600;
		font-size: 0.95rem;
		text-decoration: none;
		transition: all 0.2s ease;
	}

	.btn-primary {
		background: linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end));
		color: white;
	}

	.btn-primary:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-glow);
	}

	.btn-secondary {
		background: var(--color-bg-tertiary);
		color: var(--color-text-primary);
		border: 1px solid var(--color-border);
	}

	.btn-secondary:hover {
		border-color: var(--color-border-hover);
		background: var(--color-bg-card);
	}

	/* Sections */
	.section {
		padding: 5rem 2rem;
	}

	.container {
		max-width: 1100px;
		margin: 0 auto;
	}

	.section h2 {
		font-size: 2rem;
		text-align: center;
		margin: 0 0 1.5rem;
	}

	.section-intro {
		text-align: center;
		color: var(--color-text-secondary);
		max-width: 700px;
		margin: 0 auto 3rem;
		line-height: 1.8;
	}

	/* Scroll-in animation */
	:global(.animate-in) {
		opacity: 0;
		transform: translateY(24px);
		transition: opacity 0.6s ease-out, transform 0.6s ease-out;
	}

	:global(.animate-in.visible) {
		opacity: 1;
		transform: translateY(0);
	}

	/* Stagger cards within a grid */
	:global(.tools-grid .animate-in:nth-child(2)) {
		transition-delay: 0.15s;
	}

	:global(.benefits-grid .animate-in:nth-child(2)) {
		transition-delay: 0.1s;
	}

	:global(.benefits-grid .animate-in:nth-child(3)) {
		transition-delay: 0.2s;
	}

	:global(.benefits-grid .animate-in:nth-child(4)) {
		transition-delay: 0.3s;
	}

	/* Tools grid */
	.tools-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 2rem;
		margin-top: 2rem;
	}

	.tool-card {
		background: rgba(30, 34, 48, 0.8);
		backdrop-filter: blur(8px);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		padding: 2rem;
		text-decoration: none;
		color: inherit;
		transition: all 0.3s ease;
		display: flex;
		flex-direction: column;
	}

	.tool-card:hover {
		border-color: var(--color-accent-blue);
		transform: translateY(-6px);
		box-shadow: 0 0 30px rgba(79, 143, 247, 0.15);
	}

	.tool-card:hover .tool-icon {
		transform: scale(1.1) rotate(5deg);
	}

	.tool-icon {
		width: 56px;
		height: 56px;
		margin-bottom: 1.25rem;
		transition: transform 0.3s ease;
	}

	.tool-icon svg {
		width: 100%;
		height: 100%;
	}

	.tool-card h3 {
		font-size: 1.25rem;
		margin: 0 0 0.75rem;
	}

	.tool-card p {
		color: var(--color-text-secondary);
		line-height: 1.6;
		flex: 1;
		margin: 0 0 1.25rem;
	}

	.tool-cta {
		color: var(--color-accent-blue);
		font-weight: 600;
		font-size: 0.9rem;
		transition: gap 0.2s ease;
	}

	.tool-card:hover .tool-cta {
		letter-spacing: 0.02em;
	}

	/* Benefits */
	.benefits-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1.5rem;
		margin-top: 2rem;
	}

	.benefit-card {
		background: rgba(26, 29, 39, 0.7);
		backdrop-filter: blur(8px);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		padding: 1.5rem;
		transition: all 0.3s ease;
	}

	.benefit-card:hover {
		border-color: var(--color-accent-blue);
		transform: translateY(-4px);
		box-shadow: 0 0 20px rgba(79, 143, 247, 0.1);
	}

	.benefit-icon {
		font-size: 1.5rem;
		display: block;
		margin-bottom: 0.75rem;
	}

	.benefit-card h4 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
	}

	.benefit-card p {
		color: var(--color-text-muted);
		font-size: 0.9rem;
		line-height: 1.6;
		margin: 0;
	}

	/* Footer */
	.footer {
		text-align: center;
		padding: 2rem;
		border-top: 1px solid var(--color-border);
		color: var(--color-text-muted);
		font-size: 0.85rem;
	}

	.footer a {
		color: var(--color-accent-blue);
		text-decoration: none;
	}

	@media (max-width: 640px) {
		.hero {
			padding: 1.5rem;
		}

		.section {
			padding: 3rem 1.5rem;
		}

		.tools-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
