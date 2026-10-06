<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/env';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	import ContractTable from '#lib/components/ContractTable.svelte';
	import CompanyIndex from '#lib/components/CompanyIndex.svelte';
	import FilterBar from '#lib/components/FilterBar.svelte';
	import HighlightPanel from '#lib/components/HighlightPanel.svelte';
	import StatCard from '#lib/components/StatCard.svelte';
	import {
		applyFilters,
		confidencePool,
		defaultFilters,
		filtersFromParams,
		queryString,
		sortRows,
		type Filters,
		type SortKey
	} from '#lib/filters';
	import { dataAge, isoDate, money, shortName, untilText } from '#lib/format';
	import { recordUrl } from '#lib/links';
	import { daysBetween, isLive, liveStatus } from '#lib/status';
	import { recordVisit, rowKey } from '#lib/seen.svelte';
	import type { Contract } from '#lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The build date first, then the browser's date once hydrated, so statuses
	// stay honest between monthly data refreshes.
	let clientToday = $state<string | null>(null);
	let today = $derived(clientToday ?? data.meta.generated.slice(0, 10));
	let newKeys = $state<Set<string> | null>(null);
	let showAll = $state(false);

	const PAGE_SIZE = 250;

	onMount(() => {
		clientToday = isoDate();
		newKeys = recordVisit(
			data.meta.generated,
			data.rows.map((r) => rowKey(r))
		);
	});

	// The query string is the filter state, but it is unknowable while
	// prerendering — the static page is built in its default view and the client
	// applies whatever filters the URL actually carries once it hydrates.
	let filters = $derived(browser ? filtersFromParams(page.url.searchParams) : defaultFilters());

	let rows = $derived<Contract[]>(
		data.rows.map((r) => ({
			...r,
			status: liveStatus(r, today),
			record_url: recordUrl(r.ocid)
		}))
	);

	/** Counts are taken over the same pool the table draws from. */
	let pool = $derived(confidencePool(rows, filters.includeCheck));

	let statusCounts = $derived(
		pool.reduce<Record<string, number>>((acc, r) => {
			acc[r.status] = (acc[r.status] ?? 0) + 1;
			return acc;
		}, {})
	);

	let live = $derived(pool.filter((r) => isLive(r.status)));
	let liveDirect = $derived(live.filter((r) => r.type === 'Contract'));
	let liveValue = $derived(liveDirect.reduce((sum, r) => sum + (r.value ?? 0), 0));
	let probablyActive = $derived(pool.filter((r) => r.status === 'Probably active').length);

	let companyCounts = $derived(
		[
			...live.reduce(
				(m, r) => m.set(r.company, (m.get(r.company) ?? 0) + 1),
				new Map<string, number>()
			)
		]
			.map(([company, count]) => ({ company, count }))
			.sort((a, b) => b.count - a.count || a.company.localeCompare(b.company))
	);

	let filtered = $derived(sortRows(applyFilters(rows, filters, today), filters.sort, filters.dir));
	let visible = $derived(showAll ? filtered : filtered.slice(0, PAGE_SIZE));

	let endingSoon = $derived(
		pool
			.filter((r) => {
				if (!['Active', 'Extension window', 'Probably active'].includes(r.status)) return false;
				const left = r.end_date ? daysBetween(today, r.end_date) : null;
				return left !== null && left >= 0 && left <= 90;
			})
			.sort((a, b) => a.end_date.localeCompare(b.end_date))
			.slice(0, 8)
	);

	/** One entry per procurement, most recently updated notice first. */
	let latest = $derived(
		[
			...pool
				.slice()
				.sort((a, b) => (b.last_updated ?? '').localeCompare(a.last_updated ?? ''))
				.reduce((m, r) => {
					const seen = m.get(r.ocid);
					if (seen) {
						if (!seen.companies.includes(r.company)) seen.companies.push(r.company);
					} else {
						m.set(r.ocid, { row: r, companies: [r.company] });
					}
					return m;
				}, new Map<string, { row: Contract; companies: string[] }>())
				.values()
		].slice(0, 8)
	);

	let age = $derived(dataAge(data.meta.data_as_of, today));

	function navigate(next: Filters) {
		// Shallow: the URL becomes the filter state without re-running load,
		// losing focus, or jumping the scroll position.
		goto(`${resolve('/')}${queryString(next)}`, { shallow: true, replace: true });
	}

	function update(patch: Partial<Filters>) {
		showAll = false;
		navigate({ ...filters, ...patch });
	}

	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	function onchange(patch: Partial<Filters>) {
		// Typing shouldn't fire a navigation per keystroke.
		if ('q' in patch && Object.keys(patch).length === 1) {
			clearTimeout(searchTimer);
			searchTimer = setTimeout(() => update(patch), 180);
			return;
		}
		update(patch);
	}

	function onsort(key: SortKey) {
		const sameKey = filters.sort === key;
		const dir = sameKey
			? filters.dir === 'asc'
				? 'desc'
				: 'asc'
			: key === 'value'
				? 'desc'
				: 'asc';
		update({ sort: key, dir });
	}

	const names = (list: string[]) =>
		list.length > 3
			? `${list.slice(0, 3).map(shortName).join(', ')} +${list.length - 3}`
			: list.map(shortName).join(', ');
</script>

<svelte:head>
	<title>Divest Contract Watch — UK public contracts held by shortlisted companies</title>
	<meta
		name="description"
		content="UK public contracts awarded to companies on the BDS divestment shortlist, with each procurement's current status taken from its latest compiled notice."
	/>
</svelte:head>

<div class="wrap">
	<header class="intro">
		<span class="eyebrow">UK public procurement · Find a Tender</span>
		<h1>Divest Contract Watch</h1>
		<p>
			UK public contracts awarded to companies on the
			<a href="https://investigate.info/divest">BDS divestment shortlist</a>, with each
			procurement's current status taken from its latest compiled notice.
		</p>
		<div class="meta mono">
			{#if age}
				<span class="fresh {age.level}"><i></i>{age.label}</span>
			{/if}
			{#if data.meta.data_as_of}<span>Latest notice {data.meta.data_as_of}</span>{/if}
			<span>Built {data.meta.generated.slice(0, 10)}</span>
			<span>{data.meta.procurements.toLocaleString('en-GB')} procurements scanned</span>
			<a href={resolve('/api/contracts.csv')}>Download CSV</a>
		</div>
	</header>

	<section class="stats" aria-label="Summary">
		<StatCard
			figure={live.length}
			label="live procurements"
			note={probablyActive ? `plus ${probablyActive} probably active` : undefined}
		/>
		<StatCard
			figure={money(liveValue, true)}
			label="published value of live direct contracts"
			note="{liveDirect.length} contracts; frameworks excluded"
		/>
		<StatCard
			figure={live.length - liveDirect.length}
			label="live frameworks / multi-supplier awards"
		/>
		<StatCard figure={companyCounts.length} label="shortlisted companies with live work" />
	</section>

	<section class="panels" aria-label="What is changing">
		<HighlightPanel
			title="Ending in the next 90 days"
			href="{resolve('/')}?ends=90"
			linkText="See all"
		>
			{#each endingSoon as row (row.ocid + row.company)}
				<li>
					<span class="t">
						<b>{shortName(row.company)}</b> ·
						<a href={resolve('/procurements/[ocid]', { ocid: row.ocid })}>
							{row.title || 'Untitled procurement'}
						</a>
					</span>
					<span class="r">{row.end_date}</span>
					<span class="m">
						{row.buyer} · {untilText(row.end_date, today)}{row.max_end_date > row.end_date
							? ` · can extend to ${row.max_end_date}`
							: ''}
					</span>
				</li>
			{:else}
				<li class="none">Nothing due to end in the next 90 days.</li>
			{/each}
		</HighlightPanel>

		<HighlightPanel title="Latest notices">
			{#each latest as { row, companies } (row.ocid)}
				<li>
					<span class="t">
						<b>{names(companies)}</b> ·
						<a href={resolve('/procurements/[ocid]', { ocid: row.ocid })}>
							{row.title || 'Untitled procurement'}
						</a>
						{#if newKeys?.has(rowKey(row))}<span class="new">NEW</span>{/if}
					</span>
					<span class="r">{row.last_updated}</span>
					<span class="m">{row.buyer} · {row.status}</span>
				</li>
			{/each}
		</HighlightPanel>
	</section>

	<div class="cols">
		<aside class="index">
			<h2>Live procurements by company</h2>
			<CompanyIndex
				counts={companyCounts}
				selected={filters.company}
				onselect={(company) => update({ company: filters.company === company ? '' : company })}
			/>
			<a class="all" href={resolve('/companies')}>All {data.companies.length} companies →</a>
		</aside>

		<section class="main" aria-label="Contracts">
			<FilterBar
				{filters}
				{statusCounts}
				companies={data.companies}
				categories={data.categories}
				{onchange}
				onreset={() => update(defaultFilters())}
			/>
			<p class="count mono" aria-live="polite">
				{filtered.length.toLocaleString('en-GB')} of {pool.length.toLocaleString('en-GB')} procurements
				{#if !showAll && filtered.length > visible.length}
					· showing first {visible.length}
				{/if}
			</p>
			<ContractTable
				rows={visible}
				{today}
				sort={filters.sort}
				dir={filters.dir}
				{onsort}
				newKeys={newKeys ?? undefined}
			/>
			{#if !showAll && filtered.length > visible.length}
				<button class="btn more" type="button" onclick={() => (showAll = true)}>
					Show all {filtered.length.toLocaleString('en-GB')} procurements
				</button>
			{/if}
		</section>
	</div>
</div>

<style>
	.wrap {
		max-width: 1240px;
		margin: 0 auto;
		padding-inline: clamp(16px, 3vw, 32px);
		padding-block: 28px 0;
		display: grid;
		gap: 28px;
	}

	.intro {
		display: grid;
		gap: 10px;
	}

	.intro p {
		max-width: 68ch;
		color: var(--muted);
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 18px;
		font-size: 0.8rem;
		color: var(--muted);
	}

	.fresh {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.fresh i {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--ok);
	}

	.fresh.stale i {
		background: var(--warn);
	}

	.fresh.old i {
		background: var(--bad);
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		border-top: 2px solid var(--fg);
		border-bottom: 1px solid var(--line);
	}

	.panels {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 20px;
	}

	.cols {
		display: grid;
		grid-template-columns: minmax(0, 280px) minmax(0, 1fr);
		gap: 28px;
		align-items: start;
	}

	@media (max-width: 880px) {
		.cols {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	.index {
		display: grid;
		gap: 10px;
		position: sticky;
		top: 72px;
	}

	.index .all {
		font-size: 0.82rem;
	}

	.main {
		display: grid;
		gap: 14px;
		min-width: 0;
	}

	.count {
		font-size: 0.8rem;
		color: var(--muted);
	}

	.more {
		justify-self: start;
	}

	.new {
		font: 600 0.66rem var(--f-mono);
		letter-spacing: 0.06em;
		color: var(--bg);
		background: var(--accent);
		border-radius: 3px;
		padding: 2px 5px;
		margin-left: 4px;
		vertical-align: 1px;
	}
</style>
