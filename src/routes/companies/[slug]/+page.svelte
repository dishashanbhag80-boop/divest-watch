<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import ContractTable from '#lib/components/ContractTable.svelte';
	import StatCard from '#lib/components/StatCard.svelte';
	import { isoDate, money, prettyDate, shortName, slugify } from '#lib/format';
	import { isLive, liveStatus, statusRank } from '#lib/status';
	import { recordUrl } from '#lib/links';
	import { ALL_STATUSES, type Contract } from '#lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let clientToday = $state<string | null>(null);
	let today = $derived(clientToday ?? data.meta.generated.slice(0, 10));
	let includeCheck = $state(true);

	onMount(() => {
		clientToday = isoDate();
	});

	let rows = $derived<Contract[]>(
		data.rows
			.filter((r) => includeCheck || r.confidence !== 'check')
			.map((r) => ({ ...r, status: liveStatus(r, today), record_url: recordUrl(r.ocid) }))
			.sort(
				(a, b) =>
					statusRank(a.status) - statusRank(b.status) ||
					(a.end_date || '9999').localeCompare(b.end_date || '9999')
			)
	);

	let live = $derived(rows.filter((r) => isLive(r.status)));
	let liveDirect = $derived(live.filter((r) => r.type === 'Contract'));
	let liveValue = $derived(liveDirect.reduce((sum, r) => sum + (r.value ?? 0), 0));
	let hasCheck = $derived(data.rows.some((r) => r.confidence === 'check'));

	let byStatus = $derived(
		ALL_STATUSES.map((status) => ({
			status,
			count: rows.filter((r) => r.status === status).length
		})).filter((s) => s.count)
	);

	let topBuyers = $derived(
		[...rows.reduce((m, r) => m.set(r.buyer, (m.get(r.buyer) ?? 0) + 1), new Map<string, number>())]
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.slice(0, 10)
	);
</script>

<svelte:head>
	<title>{shortName(data.company.name)} — Divest Contract Watch</title>
	<meta
		name="description"
		content="UK public contracts awarded to {data.company
			.name}, with the current status of each procurement."
	/>
</svelte:head>

<div class="wrap">
	<nav class="crumbs" aria-label="Breadcrumb">
		<a href={resolve('/companies')}>Companies</a> <span aria-hidden="true">/</span>
		<span>{shortName(data.company.name)}</span>
	</nav>

	<header class="intro">
		<span class="eyebrow">{data.company.country || 'Shortlisted company'}</span>
		<h1>{data.company.name}</h1>
		<p>
			Appears on {data.rows.length} UK procurement{data.rows.length === 1 ? '' : 's'} across
			{new Set(data.rows.map((r) => r.buyer)).size} public buyers.
		</p>
	</header>

	<section class="stats" aria-label="Summary">
		<StatCard figure={live.length} label="live procurements" />
		<StatCard
			figure={money(liveValue, true)}
			label="published value of live direct contracts"
			note="{liveDirect.length} contracts"
		/>
		<StatCard figure={live.length - liveDirect.length} label="live frameworks / multi-supplier" />
		<StatCard
			figure={data.rows.length}
			label="procurements on record"
			note={data.rows
				.map((r) => r.start_date)
				.filter(Boolean)
				.sort()[0]
				? `earliest start ${prettyDate(
						data.rows
							.map((r) => r.start_date)
							.filter(Boolean)
							.sort()[0]
					)}`
				: undefined}
		/>
	</section>

	<div class="cols">
		<aside>
			<section class="box card">
				<h2>How this company was matched</h2>
				{#if data.company.companiesHouse.length}
					<h3>Companies House numbers</h3>
					<p class="mono small">{data.company.companiesHouse.join(', ')}</p>
				{/if}
				{#if data.company.aliases.length}
					<h3>Name phrases</h3>
					<ul class="plain">
						{#each data.company.aliases as alias (alias)}<li>{alias}</li>{/each}
					</ul>
				{/if}
				{#if data.company.broad.length}
					<h3>Broad phrases (flagged <i>check</i>)</h3>
					<ul class="plain">
						{#each data.company.broad as alias (alias)}<li>{alias}</li>{/each}
					</ul>
				{/if}
				<p class="small muted">
					Matching is by supplier name, so it can miss subsidiaries and wrongly include
					similarly-named firms. <a href={resolve('/method')}>How matching works</a>.
				</p>
			</section>

			<section class="box card">
				<h2>Published supplier names</h2>
				<ul class="plain">
					{#each data.suppliers as supplier (supplier)}<li>{supplier}</li>{/each}
				</ul>
			</section>

			<section class="box card">
				<h2>Status breakdown</h2>
				<ul class="plain rows">
					{#each byStatus as s (s.status)}
						<li><span>{s.status}</span><b class="mono">{s.count}</b></li>
					{/each}
				</ul>
			</section>

			<section class="box card">
				<h2>Most frequent buyers</h2>
				<ul class="plain rows">
					{#each topBuyers as [buyer, count] (buyer)}
						<li>
							<a href={resolve('/buyers/[slug]', { slug: slugify(buyer) })}>{buyer}</a>
							<b class="mono">{count}</b>
						</li>
					{/each}
				</ul>
			</section>
		</aside>

		<section class="main">
			<div class="head">
				<h2>Procurements</h2>
				{#if hasCheck}
					<label class="tog">
						<input type="checkbox" bind:checked={includeCheck} />
						Include name matches to check
					</label>
				{/if}
			</div>
			<ContractTable {rows} {today} showCompany={false} />
		</section>
	</div>
</div>

<style>
	.wrap {
		max-width: 1240px;
		margin: 0 auto;
		padding-inline: clamp(16px, 3vw, 32px);
		padding-block: 20px 0;
		display: grid;
		gap: 22px;
	}

	.crumbs {
		font-size: 0.82rem;
		color: var(--muted);
		display: flex;
		gap: 8px;
	}

	.intro {
		display: grid;
		gap: 8px;
	}

	.intro p {
		color: var(--muted);
		max-width: 68ch;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
		border-top: 2px solid var(--fg);
		border-bottom: 1px solid var(--line);
	}

	.cols {
		display: grid;
		grid-template-columns: minmax(0, 300px) minmax(0, 1fr);
		gap: 24px;
		align-items: start;
	}

	@media (max-width: 960px) {
		.cols {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	aside {
		display: grid;
		gap: 14px;
	}

	.box {
		padding: 14px 16px;
		display: grid;
		gap: 8px;
		align-content: start;
		font-size: 0.86rem;
	}

	.box h3 {
		font: 500 0.68rem var(--f-mono);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted);
		margin-top: 4px;
	}

	.plain {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 3px;
	}

	.plain.rows {
		gap: 0;
	}

	.plain.rows li {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 6px 0;
		border-bottom: 1px solid var(--line);
	}

	.plain.rows li:last-child {
		border-bottom: 0;
	}

	.small {
		font-size: 0.78rem;
	}

	.main {
		display: grid;
		gap: 12px;
		min-width: 0;
	}

	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 16px;
		flex-wrap: wrap;
	}

	.tog {
		display: flex;
		gap: 6px;
		align-items: center;
		font-size: 0.82rem;
		color: var(--muted);
		cursor: pointer;
	}

	.tog input {
		margin: 0;
		accent-color: var(--accent);
	}
</style>
