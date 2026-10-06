<script lang="ts">
	/** Live procurements per company, as a clickable bar chart / filter. */
	import { shortName } from '#lib/format';

	let {
		counts,
		selected = '',
		onselect
	}: {
		counts: { company: string; count: number }[];
		selected?: string;
		/** Clicking a row toggles that company as a filter. */
		onselect: (company: string) => void;
	} = $props();

	let max = $derived(counts.length ? counts[0].count : 1);
</script>

<ol>
	{#each counts as { company, count } (company)}
		<li>
			<button type="button" aria-pressed={selected === company} onclick={() => onselect(company)}>
				<span class="nm">{shortName(company)}</span>
				<span class="ct mono">{count}</span>
				<span class="bar"><i style="width:{((count / max) * 100).toFixed(1)}%"></i></span>
			</button>
		</li>
	{:else}
		<li class="none">No live procurements.</li>
	{/each}
</ol>

<style>
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
	}

	button {
		all: unset;
		cursor: pointer;
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 2px 10px;
		padding: 7px 8px;
		border-radius: 4px;
		width: 100%;
		box-sizing: border-box;
	}

	button:hover,
	button:focus-visible {
		background: var(--accent-soft);
	}

	button[aria-pressed='true'] {
		background: var(--accent-soft);
		box-shadow: inset 3px 0 0 var(--accent);
	}

	.nm {
		font-weight: 600;
		font-size: 0.88rem;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.ct {
		font-size: 0.8rem;
		color: var(--muted);
	}

	.bar {
		grid-column: 1 / -1;
		height: 4px;
		background: var(--line);
		border-radius: 2px;
		overflow: hidden;
	}

	.bar i {
		display: block;
		height: 100%;
		background: var(--accent);
	}

	.none {
		color: var(--muted);
		font-size: 0.86rem;
		padding: 8px;
	}
</style>
