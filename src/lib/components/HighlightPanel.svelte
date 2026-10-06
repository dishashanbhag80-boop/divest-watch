<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		href,
		linkText,
		children
	}: { title: string; href?: string; linkText?: string; children: Snippet } = $props();
</script>

<section class="panel">
	<header>
		<h2>{title}</h2>
		{#if href}<a {href}>{linkText ?? 'See all'}</a>{/if}
	</header>
	<ul>{@render children()}</ul>
</section>

<style>
	.panel {
		display: grid;
		gap: 8px;
		align-content: start;
		min-width: 0;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
	}

	header a {
		font-size: 0.8rem;
		white-space: nowrap;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		border-top: 1px solid var(--line);
	}

	ul :global(li) {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 2px 12px;
		padding: 9px 0;
		border-bottom: 1px solid var(--line);
		font-size: 0.86rem;
	}

	ul :global(li .t) {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	ul :global(li .t a) {
		color: var(--fg);
		text-decoration: none;
	}

	ul :global(li .t a:hover) {
		color: var(--accent);
		text-decoration: underline;
	}

	ul :global(li .r) {
		font: 500 0.8rem var(--f-mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
		white-space: nowrap;
	}

	ul :global(li .m) {
		grid-column: 1 / -1;
		color: var(--muted);
		font-size: 0.78rem;
	}

	ul :global(li.none) {
		color: var(--muted);
		grid-template-columns: 1fr;
	}
</style>
