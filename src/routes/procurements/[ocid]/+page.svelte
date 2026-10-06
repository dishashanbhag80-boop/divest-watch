<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import EndDate from '#lib/components/EndDate.svelte';
	import StatusPill from '#lib/components/StatusPill.svelte';
	import { isoDate, money, prettyDate, shortName, slugify } from '#lib/format';
	import { recordUrl } from '#lib/links';
	import { EVIDENCE_LABELS, evidenceFor, liveStatus, statusRank } from '#lib/status';
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
			.map((r) => ({ ...r, status: liveStatus(r, today), record_url: recordUrl(data.ocid) }))
			.sort((a, b) => statusRank(a.status) - statusRank(b.status))
	);

	/** Award rows grouped by company, since a company can win several lots. */
	let awardsByCompany = $derived.by(() => {
		const out = new Map<string, typeof data.awards>();
		for (const award of data.awards) {
			(out.get(award.company) ?? out.set(award.company, []).get(award.company)!).push(award);
		}
		return out;
	});

	const evidenceNote = (row: Contract) => {
		const label = EVIDENCE_LABELS[evidenceFor(row)];
		return label ? `${label.title}.` : null;
	};
</script>

<svelte:head>
	<title>{data.procurement.title || data.ocid} — Divest Contract Watch</title>
	<meta
		name="description"
		content="{data.procurement.buyer}: {data.procurement
			.title}. Status and award detail for the shortlisted suppliers on this procurement."
	/>
</svelte:head>

<div class="wrap">
	<nav class="crumbs" aria-label="Breadcrumb">
		<a href={resolve('/')}>Dashboard</a> <span aria-hidden="true">/</span>
		<a href={resolve('/buyers/[slug]', { slug: data.procurement.buyerSlug })}>
			{data.procurement.buyer}
		</a>
		<span aria-hidden="true">/</span>
		<span class="mono">{data.ocid}</span>
	</nav>

	<header class="intro">
		<span class="eyebrow">{data.procurement.type}</span>
		<h1>{data.procurement.title || 'Untitled procurement'}</h1>
		<dl class="facts">
			<div>
				<dt>Buyer</dt>
				<dd>
					<a href={resolve('/buyers/[slug]', { slug: data.procurement.buyerSlug })}>
						{data.procurement.buyer}
					</a>
				</dd>
			</div>
			{#if data.procurement.category}
				<div>
					<dt>Category</dt>
					<dd>{data.procurement.category}</dd>
				</div>
			{/if}
			{#if data.procurement.type !== 'Contract'}
				<div>
					<dt>Suppliers on award</dt>
					<dd>{data.procurement.suppliers_on_award}</dd>
				</div>
			{/if}
			<div>
				<dt>Latest notice</dt>
				<dd>{prettyDate(data.procurement.last_updated)}</dd>
			</div>
			<div>
				<dt>OCID</dt>
				<dd class="mono">{data.ocid}</dd>
			</div>
		</dl>
		<p class="links">
			{#if data.procurement.notice_url}
				<a href={data.procurement.notice_url} target="_blank" rel="noopener">
					Original notice on Find a Tender ↗
				</a>
			{/if}
			<a href={recordUrl(data.ocid)} target="_blank" rel="noopener">OCDS record package ↗</a>
		</p>
	</header>

	<section>
		<h2>Shortlisted companies on this procurement</h2>
		<div class="companies">
			{#each rows as row (row.company)}
				<article class="card co">
					<header>
						<a class="nm" href={resolve('/companies/[slug]', { slug: slugify(row.company) })}>
							{shortName(row.company)}
						</a>
						<StatusPill status={row.status} />
					</header>
					{#if row.confidence === 'check'}
						<p class="warn">
							Matched on a broad name phrase — check the notice before relying on this row.
						</p>
					{/if}
					<dl class="facts">
						<div>
							<dt>Published as</dt>
							<dd>{row.supplier_name}</dd>
						</div>
						{#if row.company_country}
							<div>
								<dt>Country</dt>
								<dd>{row.company_country}</dd>
							</div>
						{/if}
						<div>
							<dt>Value</dt>
							<dd>
								{money(row.value)}
								{#if row.value !== null}
									<span class="muted small">
										{row.type === 'Contract'
											? `(${row.value_basis} level)`
											: 'ceiling shared across suppliers'}
									</span>
								{/if}
							</dd>
						</div>
						<div>
							<dt>Signed</dt>
							<dd>{prettyDate(row.date_signed)}</dd>
						</div>
						<div>
							<dt>Starts</dt>
							<dd>{prettyDate(row.start_date)}</dd>
						</div>
						<div>
							<dt>Ends</dt>
							<dd><EndDate {row} {today} /></dd>
						</div>
						{#if row.lots_won > 1}
							<div>
								<dt>Lots won</dt>
								<dd>{row.lots_won}</dd>
							</div>
						{/if}
					</dl>
					{#if evidenceNote(row)}
						<p class="small muted">{evidenceNote(row)} <code>{row.end_date_source}</code></p>
					{/if}

					{#if (awardsByCompany.get(row.company) ?? []).length > 1}
						<details>
							<summary>
								{(awardsByCompany.get(row.company) ?? []).length} award / lot rows
							</summary>
							<div class="awards">
								<table>
									<thead>
										<tr>
											<th>Award</th>
											<th>Supplier as published</th>
											<th class="num">Value</th>
											<th>Period</th>
											<th>Flags</th>
										</tr>
									</thead>
									<tbody>
										{#each awardsByCompany.get(row.company) ?? [] as award (award.award_id + award.contract_id)}
											<tr>
												<td class="mono">{award.award_id || '—'}</td>
												<td>{award.supplier_name}</td>
												<td class="num mono">{money(award.value)}</td>
												<td class="mono">
													{award.start_date || '—'} → {award.end_date || '—'}
												</td>
												<td class="small muted">
													{[award.award_status, award.contract_status, award.tender_status]
														.filter(Boolean)
														.join(' · ')}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</details>
					{/if}
				</article>
			{/each}
		</div>
	</section>
</div>

<style>
	.wrap {
		max-width: 1000px;
		margin: 0 auto;
		padding-inline: clamp(16px, 3vw, 32px);
		padding-block: 20px 0;
		display: grid;
		gap: 24px;
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
		gap: 12px;
	}

	.facts {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 12px 20px;
	}

	.facts dt {
		font: 500 0.68rem var(--f-mono);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted);
		margin-bottom: 3px;
	}

	.facts dd {
		margin: 0;
		font-size: 0.88rem;
		overflow-wrap: anywhere;
	}

	.links {
		display: flex;
		gap: 18px;
		flex-wrap: wrap;
		font-size: 0.85rem;
	}

	h2 {
		margin-bottom: 12px;
	}

	.companies {
		display: grid;
		gap: 14px;
	}

	.co {
		padding: 16px;
		display: grid;
		gap: 12px;
	}

	.co > header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.nm {
		font: 700 1rem var(--f-display);
		color: var(--fg);
		text-decoration: none;
	}

	.nm:hover {
		color: var(--accent);
		text-decoration: underline;
	}

	.warn {
		font-size: 0.8rem;
		color: var(--warn);
		background: var(--warn-bg);
		padding: 8px 10px;
		border-radius: 4px;
	}

	.small {
		font-size: 0.78rem;
	}

	code {
		font-family: var(--f-mono);
		font-size: 0.74rem;
		background: var(--surface-2);
		padding: 1px 4px;
		border-radius: 3px;
	}

	summary {
		cursor: pointer;
		font-size: 0.84rem;
		font-weight: 600;
		color: var(--accent);
	}

	.awards {
		overflow-x: auto;
		margin-top: 10px;
	}

	.awards table {
		border-collapse: collapse;
		width: 100%;
		min-width: 620px;
		font-size: 0.8rem;
	}

	.awards th {
		font: 600 0.68rem var(--f-mono);
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--muted);
		text-align: left;
		padding: 8px 10px;
		border-bottom: 1px solid var(--line);
		white-space: nowrap;
	}

	.awards td {
		padding: 8px 10px;
		border-bottom: 1px solid var(--line);
		vertical-align: top;
	}

	.awards tr:last-child td {
		border-bottom: 0;
	}

	.awards .num {
		text-align: right;
		white-space: nowrap;
	}
</style>
