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
		content="Master Power Delivery Networks through interactive 3D visualization. Explore 3D SPR analysis, static IR drop, and more."
	/>
</svelte:head>

<ParticleBackground />

<section class="hero">
	<div class="hero-content" class:mounted>
		<p class="author-badge">by <strong>Akarshan Arora</strong></p>
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
						<!-- Back layer -->
						<rect x="10" y="4" width="28" height="20" rx="2" stroke="var(--color-accent-purple)" stroke-width="1.5" stroke-opacity="0.4" fill="none" />
						<!-- Front layer -->
						<rect x="4" y="14" width="28" height="20" rx="2" stroke="var(--color-accent-cyan)" stroke-width="1.5" fill="none" />
						<!-- Via connections -->
						<line x1="10" y1="14" x2="14" y2="8" stroke="var(--color-accent-blue)" stroke-width="1.5" stroke-dasharray="3 2" />
						<line x1="26" y1="14" x2="30" y2="8" stroke="var(--color-accent-blue)" stroke-width="1.5" stroke-dasharray="3 2" />
						<!-- Nodes -->
						<circle cx="10" cy="24" r="3" fill="var(--color-accent-cyan)" />
						<circle cx="32" cy="24" r="3" fill="var(--color-accent-purple)" />
						<!-- Path -->
						<path d="M13 24h6v-6h6v6h4" stroke="var(--color-accent-amber)" stroke-width="2" stroke-linecap="round" />
					</svg>
				</div>
				<h3>PDN SPR Visualizer <span class="badge-3d">3D</span></h3>
				<p>
					Analyze shortest path resistance in an interactive 3D power grid. Watch Dijkstra's
					algorithm find optimal current paths through multi-layer metal stacks in real-time.
				</p>
				<span class="tool-cta">Launch Tool →</span>
			</a>

			<a href="{base}/ir-drop-visualizer" class="tool-card animate-in">
				<div class="tool-icon">
					<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
						<!-- Voltage columns (3D bars) -->
						<rect x="6" y="20" width="8" height="24" rx="1" fill="var(--color-accent-green)" fill-opacity="0.5" />
						<rect x="16" y="14" width="8" height="30" rx="1" fill="var(--color-accent-amber)" fill-opacity="0.4" />
						<rect x="26" y="8" width="8" height="36" rx="1" fill="var(--color-accent-red)" fill-opacity="0.35" />
						<rect x="36" y="24" width="8" height="20" rx="1" fill="var(--color-accent-green)" fill-opacity="0.5" />
						<!-- Current flow arrow -->
						<path d="M10 42h30" stroke="var(--color-accent-blue)" stroke-width="2" stroke-dasharray="4 2" />
						<circle cx="38" cy="42" r="2" fill="var(--color-accent-blue)" />
					</svg>
				</div>
				<h3>IR Drop Visualizer <span class="badge-3d">3D</span></h3>
				<p>
					Explore voltage distribution in an interactive 3D landscape. Watch columns shrink and
					turn red as current flows, revealing dangerous IR drop zones in real-time.
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

	.author-badge {
		display: inline-block;
		font-size: 0.85rem;
		color: var(--color-accent-blue);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		margin: 0 0 1rem;
		padding: 0.35rem 1rem;
		border: 1px solid rgba(79, 143, 247, 0.3);
		border-radius: 20px;
		background: rgba(79, 143, 247, 0.08);
	}

	.author-badge strong {
		color: var(--color-text-primary);
		font-weight: 700;
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
		font-size: 2.2rem;
		text-align: center;
		margin: 0 0 1.5rem;
	}

	.section-intro {
		text-align: center;
		color: var(--color-text-secondary);
		max-width: 700px;
		margin: 0 auto 3rem;
		line-height: 1.8;
		font-size: 1.1rem;
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
		font-size: 1.4rem;
		margin: 0 0 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.badge-3d {
		display: inline-block;
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
		background: linear-gradient(135deg, var(--color-accent-cyan), var(--color-accent-purple));
		color: white;
		vertical-align: middle;
	}

	.tool-card p {
		color: var(--color-text-secondary);
		font-size: 1.05rem;
		line-height: 1.6;
		flex: 1;
		margin: 0 0 1.25rem;
	}

	.tool-cta {
		color: var(--color-accent-blue);
		font-weight: 600;
		font-size: 1rem;
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
		font-size: 1.8rem;
		display: block;
		margin-bottom: 0.75rem;
	}

	.benefit-card h4 {
		margin: 0 0 0.5rem;
		font-size: 1.15rem;
	}

	.benefit-card p {
		color: var(--color-text-muted);
		font-size: 1.05rem;
		line-height: 1.6;
		margin: 0;
	}

	/* Footer */
	.footer {
		text-align: center;
		padding: 2rem;
		border-top: 1px solid var(--color-border);
		color: var(--color-text-muted);
		font-size: 1rem;
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
