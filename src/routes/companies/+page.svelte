<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { isoDate, money, shortName } from '#lib/format';
	import { isLive, liveStatus } from '#lib/status';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let clientToday = $state<string | null>(null);
	let today = $derived(clientToday ?? data.meta.generated.slice(0, 10));
	let includeCheck = $state(false);
	let sort = $state<'name' | 'live' | 'total' | 'value'>('live');

	onMount(() => {
		clientToday = isoDate();
	});

	/** Live counts and values per company, recomputed against today's date. */
	let tallies = $derived.by(() => {
		const out = new Map<string, { live: number; liveValue: number; total: number }>();
		for (const row of data.statuses) {
			if (!includeCheck && row.confidence === 'check') continue;
			const entry = out.get(row.company) ?? { live: 0, liveValue: 0, total: 0 };
			entry.total += 1;
			if (isLive(liveStatus({ ...row }, today))) {
				entry.live += 1;
				if (row.type === 'Contract') entry.liveValue += row.value ?? 0;
			}
			out.set(row.company, entry);
		}
		return out;
	});

	let rows = $derived(
		data.summaries
			.filter((c) => includeCheck || c.confidence !== 'check')
			.map((c) => ({ ...c, ...(tallies.get(c.name) ?? { live: 0, liveValue: 0, total: 0 }) }))
			.sort((a, b) => {
				if (sort === 'name') return a.name.localeCompare(b.name);
				if (sort === 'total') return b.total - a.total || a.name.localeCompare(b.name);
				if (sort === 'value') return b.liveValue - a.liveValue || a.name.localeCompare(b.name);
				return b.live - a.live || b.total - a.total || a.name.localeCompare(b.name);
			})
	);

	let totals = $derived({
		live: rows.reduce((n, r) => n + r.live, 0),
		value: rows.reduce((n, r) => n + r.liveValue, 0),
		withLive: rows.filter((r) => r.live > 0).length
	});
</script>

<svelte:head>
	<title>Companies — Divest Contract Watch</title>
	<meta
		name="description"
		content="Shortlisted companies holding UK public contracts, ranked by how much live public work each one holds."
	/>
</svelte:head>

<div class="wrap">
	<header class="intro">
		<span class="eyebrow">Shortlist</span>
		<h1>Companies</h1>
		<p>
			{rows.length} shortlisted companies appear as suppliers in UK above-threshold procurement.
			{totals.withLive} hold live work worth {money(totals.value, true)} in published direct-contract
			value.
		</p>
	</header>

	<div class="controls">
		<label>
			Sort by
			<select bind:value={sort}>
				<option value="live">Live procurements</option>
				<option value="total">All procurements</option>
				<option value="value">Live contract value</option>
				<option value="name">Name</option>
			</select>
		</label>
		<label class="tog">
			<input type="checkbox" bind:checked={includeCheck} />
			Include name matches to check
		</label>
	</div>

	<ul class="grid">
		{#each rows as company (company.slug)}
			<li class="card">
				<a href={resolve('/companies/[slug]', { slug: company.slug })}>
					<span class="nm">{shortName(company.name)}</span>
					{#if company.country}<span class="cc mono">{company.country}</span>{/if}
				</a>
				<dl>
					<div>
						<dt>Live</dt>
						<dd class="mono big">{company.live}</dd>
					</div>
					<div>
						<dt>All</dt>
						<dd class="mono">{company.total}</dd>
					</div>
					<div>
						<dt>Buyers</dt>
						<dd class="mono">{company.buyers}</dd>
					</div>
					<div>
						<dt>Live value</dt>
						<dd class="mono">{company.liveValue ? money(company.liveValue, true) : '—'}</dd>
					</div>
				</dl>
				{#if company.confidence === 'check'}
					<p class="warn">Broad name match only — verify each row against its notice.</p>
				{/if}
			</li>
		{/each}
	</ul>
</div>

<style>
	.wrap {
		max-width: 1240px;
		margin: 0 auto;
		padding-inline: clamp(16px, 3vw, 32px);
		padding-block: 28px 0;
		display: grid;
		gap: 24px;
	}

	.intro {
		display: grid;
		gap: 10px;
	}

	.intro p {
		max-width: 68ch;
		color: var(--muted);
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		align-items: center;
		font-size: 0.85rem;
		color: var(--muted);
		border-block: 1px solid var(--line);
		padding-block: 10px;
	}

	.controls label {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.tog {
		cursor: pointer;
	}

	.tog input {
		margin: 0;
		accent-color: var(--accent);
	}

	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 14px;
	}

	.card {
		padding: 14px 16px;
		display: grid;
		gap: 10px;
		align-content: start;
	}

	.card > a {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 10px;
		text-decoration: none;
		color: var(--fg);
	}

	.card > a:hover .nm {
		color: var(--accent);
		text-decoration: underline;
	}

	.nm {
		font: 700 0.98rem var(--f-display);
		overflow-wrap: anywhere;
	}

	.cc {
		font-size: 0.72rem;
		color: var(--muted);
		white-space: nowrap;
	}

	dl {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(4, auto);
		gap: 10px 14px;
		justify-content: start;
	}

	dt {
		font: 500 0.68rem var(--f-mono);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted);
	}

	dd {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
	}

	dd.big {
		font-size: 1.15rem;
		color: var(--accent);
	}

	.warn {
		font-size: 0.76rem;
		color: var(--warn);
	}
</style>
