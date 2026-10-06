<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { isoDate, money, shortName } from '#lib/format';
	import { isLive, liveStatus } from '#lib/status';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let clientToday = $state<string | null>(null);
	let today = $derived(clientToday ?? data.meta.generated.slice(0, 10));
	let query = $state('');
	let onlyLive = $state(true);

	onMount(() => {
		clientToday = isoDate();
	});

	let rows = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return data.buyers
			.map((b) => {
				const live = b.statuses.filter(
					(s) => s.confidence !== 'check' && isLive(liveStatus(s, today))
				);
				return {
					...b,
					live: live.length,
					liveValue: live
						.filter((s) => s.type === 'Contract')
						.reduce((sum, s) => sum + (s.value ?? 0), 0)
				};
			})
			.filter((b) => (!onlyLive || b.live > 0) && (!q || b.name.toLowerCase().includes(q)))
			.sort(
				(a, b) => b.live - a.live || b.procurements - a.procurements || a.name.localeCompare(b.name)
			);
	});

	let totalValue = $derived(rows.reduce((n, b) => n + b.liveValue, 0));
</script>

<svelte:head>
	<title>Buyers — Divest Contract Watch</title>
	<meta
		name="description"
		content="UK public bodies buying from shortlisted companies, ranked by how much live work each one has placed."
	/>
</svelte:head>

<div class="wrap">
	<header class="intro">
		<span class="eyebrow">Public bodies</span>
		<h1>Buyers</h1>
		<p>
			{data.buyers.length} UK public bodies have awarded above-threshold contracts to shortlisted companies.
			Departments that publish their name more than one way are shown once.
		</p>
	</header>

	<div class="controls">
		<input
			type="search"
			placeholder="Search buyers…"
			aria-label="Search buyers"
			bind:value={query}
		/>
		<label class="tog">
			<input type="checkbox" bind:checked={onlyLive} />
			Only buyers with live work
		</label>
		<span class="count mono">
			{rows.length} buyers · {money(totalValue, true)} live direct-contract value
		</span>
	</div>

	<div class="tbl card">
		<table>
			<thead>
				<tr>
					<th>Buyer</th>
					<th class="num">Live</th>
					<th class="num">All</th>
					<th class="num">Live value</th>
					<th>Companies</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as buyer (buyer.slug)}
					<tr>
						<td>
							<a href={resolve('/buyers/[slug]', { slug: buyer.slug })}>{buyer.name}</a>
							{#if buyer.variants > 1}
								<span class="tag" title="Published under {buyer.variants} different spellings">
									{buyer.variants} spellings
								</span>
							{/if}
						</td>
						<td class="num mono">{buyer.live || '—'}</td>
						<td class="num mono">{buyer.procurements}</td>
						<td class="num mono">{buyer.liveValue ? money(buyer.liveValue, true) : '—'}</td>
						<td class="cos">
							{buyer.companies.map(shortName).join(', ')}
						</td>
					</tr>
				{:else}
					<tr><td colspan="5" class="empty">No buyers match that search.</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.wrap {
		max-width: 1240px;
		margin: 0 auto;
		padding-inline: clamp(16px, 3vw, 32px);
		padding-block: 28px 0;
		display: grid;
		gap: 20px;
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
		gap: 12px 16px;
		align-items: center;
	}

	.controls input[type='search'] {
		flex: 1 1 240px;
		min-width: 0;
	}

	.tog {
		display: flex;
		gap: 6px;
		align-items: center;
		font-size: 0.84rem;
		color: var(--muted);
		cursor: pointer;
	}

	.tog input {
		margin: 0;
		accent-color: var(--accent);
	}

	.count {
		font-size: 0.8rem;
		color: var(--muted);
		margin-left: auto;
	}

	.tbl {
		overflow-x: auto;
	}

	table {
		border-collapse: collapse;
		width: 100%;
		min-width: 760px;
		font-size: 0.86rem;
	}

	th {
		font: 600 0.72rem var(--f-mono);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
		text-align: left;
		padding: 10px 12px;
		border-bottom: 1px solid var(--line);
		white-space: nowrap;
		background: var(--surface);
		position: sticky;
		top: 0;
	}

	th.num,
	td.num {
		text-align: right;
	}

	td {
		padding: 10px 12px;
		border-bottom: 1px solid var(--line);
		vertical-align: top;
	}

	tr:last-child td {
		border-bottom: 0;
	}

	td.num {
		white-space: nowrap;
	}

	.cos {
		color: var(--muted);
		font-size: 0.8rem;
		max-width: 38ch;
	}

	.empty {
		padding: 28px;
		text-align: center;
		color: var(--muted);
	}
</style>
