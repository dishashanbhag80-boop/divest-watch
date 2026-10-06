<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { LayoutProps } from './$types';
	import { SOURCES } from '#lib/links';
	import { THEME_ICONS, THEME_LABELS, theme } from '#lib/theme.svelte';

	let { children }: LayoutProps = $props();

	// Keyed by route id rather than pathname so the base path never matters.
	const NAV = [
		{ id: '/', href: resolve('/'), label: 'Dashboard' },
		{ id: '/companies', href: resolve('/companies'), label: 'Companies' },
		{ id: '/buyers', href: resolve('/buyers'), label: 'Buyers' },
		{ id: '/method', href: resolve('/method'), label: 'Method' }
	] as const;

	const isCurrent = (id: string) =>
		id === '/' ? page.route.id === '/' : (page.route.id ?? '').startsWith(id);
</script>

<a class="skip" href="#main">Skip to content</a>

<header class="site">
	<div class="inner">
		<a class="brand" href={resolve('/')}>
			<span class="mark" aria-hidden="true"></span>
			Divest Contract Watch
		</a>
		<nav aria-label="Sections">
			{#each NAV as item (item.id)}
				<a href={item.href} aria-current={isCurrent(item.id) ? 'page' : undefined}>
					{item.label}
				</a>
			{/each}
		</nav>
		<button
			class="theme"
			type="button"
			onclick={() => theme.cycle()}
			title={THEME_LABELS[theme.value]}
			aria-label={THEME_LABELS[theme.value]}
		>
			<span aria-hidden="true">{THEME_ICONS[theme.value]}</span>
		</button>
	</div>
</header>

<main id="main">
	{@render children()}
</main>

<footer class="site">
	<div class="inner">
		<p>
			Contracts data contains public sector information licensed under the
			<a href={SOURCES.ogl}>Open Government Licence v3.0</a>, via the
			<a href={SOURCES.registry}>Open Contracting Partnership</a> data registry. Company list from
			<a href={SOURCES.shortlist}>investigate.info/divest</a>.
		</p>
		<p class="muted">
			Published values, not payments. Supplier matching is by name and can miss or wrongly include
			an entity — <a href={resolve('/method')}>read the method</a> before relying on a row.
		</p>
	</div>
</footer>

<style>
	.skip {
		position: absolute;
		left: -9999px;
		top: 0;
		background: var(--surface);
		padding: 10px 14px;
		z-index: 10;
	}

	.skip:focus {
		left: 8px;
		top: 8px;
	}

	header.site {
		border-bottom: 1px solid var(--line);
		background: var(--surface);
		position: sticky;
		top: 0;
		z-index: 5;
	}

	.inner {
		max-width: 1240px;
		margin: 0 auto;
		padding-inline: clamp(16px, 3vw, 32px);
	}

	header .inner {
		display: flex;
		align-items: center;
		gap: 12px 24px;
		flex-wrap: wrap;
		padding-block: 12px;
	}

	.brand {
		font: 800 1rem var(--f-display);
		color: var(--fg);
		text-decoration: none;
		display: flex;
		align-items: center;
		gap: 8px;
		margin-right: auto;
	}

	.mark {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		background: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}

	nav {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	nav a {
		font-size: 0.86rem;
		font-weight: 500;
		color: var(--muted);
		text-decoration: none;
		padding: 6px 10px;
		border-radius: 4px;
	}

	nav a:hover {
		color: var(--fg);
		background: var(--surface-2);
	}

	nav a[aria-current='page'] {
		color: var(--fg);
		background: var(--accent-soft);
	}

	.theme {
		all: unset;
		cursor: pointer;
		width: 32px;
		height: 32px;
		display: grid;
		place-items: center;
		border: 1px solid var(--line);
		border-radius: 4px;
		color: var(--muted);
		font-size: 0.95rem;
	}

	.theme:hover {
		color: var(--fg);
		background: var(--surface-2);
	}

	main {
		display: block;
		min-height: 70vh;
	}

	footer.site {
		border-top: 1px solid var(--line);
		margin-top: 56px;
		background: var(--surface);
	}

	footer .inner {
		padding-block: 24px 40px;
		display: grid;
		gap: 8px;
		font-size: 0.82rem;
		max-width: 1240px;
	}

	footer p {
		max-width: 80ch;
	}
</style>
