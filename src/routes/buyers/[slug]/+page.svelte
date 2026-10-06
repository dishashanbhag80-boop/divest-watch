<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import ContractTable from '#lib/components/ContractTable.svelte';
	import StatCard from '#lib/components/StatCard.svelte';
	import { isoDate, money, shortName } from '#lib/format';
	import { recordUrl } from '#lib/links';
	import { isLive, liveStatus, statusRank } from '#lib/status';
	import type { Contract } from '#lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let clientToday = $state<string | null>(null);
	let today = $derived(clientToday ?? data.meta.generated.slice(0, 10));
	onMount(() => {
		clientToday = isoDate();
	});

	let rows = $derived<Contract[]>(
		data.rows
			.map((r) => ({ ...r, status: liveStatus(r, today), record_url: recordUrl(r.ocid) }))
			.sort(
				(a, b) => statusRank(a.status) - statusRank(b.status) || a.company.localeCompare(b.company)
			)
	);

	let live = $derived(rows.filter((r) => isLive(r.status)));
	let liveDirect = $derived(live.filter((r) => r.type === 'Contract'));
	let companies = $derived([...new Set(rows.map((r) => r.company))].sort());
</script>

<svelte:head>
	<title>{data.buyer.name} — Divest Contract Watch</title>
	<meta
		name="description"
		content="Contracts {data.buyer.name} has awarded to companies on the BDS divestment shortlist."
	/>
</svelte:head>

<div class="wrap">
	<nav class="crumbs" aria-label="Breadcrumb">
		<a href={resolve('/buyers')}>Buyers</a> <span aria-hidden="true">/</span>
		<span>{data.buyer.name}</span>
	</nav>

	<header class="intro">
		<span class="eyebrow">Public buyer</span>
		<h1>{data.buyer.name}</h1>
		<p>
			Has awarded {rows.length} procurement{rows.length === 1 ? '' : 's'} to
			{companies.length} shortlisted {companies.length === 1 ? 'company' : 'companies'}:
			{companies.map(shortName).join(', ')}.
		</p>
		{#if data.buyer.variants.length > 1}
			<p class="small muted">
				Published under {data.buyer.variants.length} spellings: {data.buyer.variants.join(' · ')}
			</p>
		{/if}
	</header>

	<section class="stats" aria-label="Summary">
		<StatCard figure={live.length} label="live procurements" />
		<StatCard
			figure={money(
				liveDirect.reduce((sum, r) => sum + (r.value ?? 0), 0),
				true
			)}
			label="published value of live direct contracts"
		/>
		<StatCard figure={rows.length} label="procurements on record" />
		<StatCard figure={companies.length} label="shortlisted suppliers" />
	</section>

	<ContractTable {rows} {today} />
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
		flex-wrap: wrap;
	}

	.intro {
		display: grid;
		gap: 8px;
	}

	.intro p {
		color: var(--muted);
		max-width: 80ch;
	}

	.small {
		font-size: 0.8rem;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
		border-top: 2px solid var(--fg);
		border-bottom: 1px solid var(--line);
	}
</style>
