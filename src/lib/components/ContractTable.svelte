<script lang="ts">
	import { resolve } from '$app/paths';

	import EndDate from './EndDate.svelte';
	import StatusPill from './StatusPill.svelte';
	import { money, shortName, slugify } from '#lib/format';
	import type { SortKey } from '#lib/filters';
	import type { Contract } from '#lib/types';

	let {
		rows,
		today,
		sort = 'status',
		dir = 'asc',
		onsort,
		showCompany = true,
		newKeys
	}: {
		rows: Contract[];
		today: string;
		sort?: SortKey;
		dir?: 'asc' | 'desc';
		/** Omit to render fixed, unsortable headers. */
		onsort?: (key: SortKey) => void;
		/** False on a company page, where every row is the same company. */
		showCompany?: boolean;
		/** `ocid|company` keys first seen in this data refresh. */
		newKeys?: Set<string>;
	} = $props();

	const COLUMNS: { key?: SortKey; label: string; numeric?: boolean }[] = [
		{ key: 'status', label: 'Status' },
		{ key: 'company', label: 'Company' },
		{ key: 'buyer', label: 'Buyer' },
		{ key: 'title', label: 'Procurement' },
		{ key: 'value', label: 'Value', numeric: true },
		{ key: 'end_date', label: 'Ends' }
	];

	let columns = $derived(COLUMNS.filter((c) => showCompany || c.key !== 'company'));

	const ariaSort = (key?: SortKey) =>
		key && key === sort ? (dir === 'asc' ? 'ascending' : 'descending') : 'none';
</script>

<div class="tbl card">
	<table>
		<thead>
			<tr>
				{#each columns as col (col.label)}
					<th class:num={col.numeric} aria-sort={ariaSort(col.key)}>
						{#if onsort && col.key}
							{@const key = col.key}
							<button type="button" onclick={() => onsort(key)}>
								{col.label}
								<span class="arrow" aria-hidden="true">
									{key === sort ? (dir === 'asc' ? '↑' : '↓') : ''}
								</span>
							</button>
						{:else}
							{col.label}
						{/if}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.ocid + '|' + row.company)}
				{@const framework = row.type !== 'Contract'}
				<tr>
					<td><StatusPill status={row.status} /></td>
					{#if showCompany}
						<td>
							<a class="co" href={resolve('/companies/[slug]', { slug: slugify(row.company) })}>
								{shortName(row.company)}
							</a>
							{#if newKeys?.has(row.ocid + '|' + row.company)}
								<span class="new">NEW</span>
							{/if}
							{#if row.confidence === 'check'}
								<span class="tag chk" title="Broad name match — verify against the notice">
									check
								</span>
							{/if}
							<span class="sub">{row.supplier_name}</span>
						</td>
					{/if}
					<td>{row.buyer}</td>
					<td class="ttl">
						<a href={resolve('/procurements/[ocid]', { ocid: row.ocid })}>
							{row.title || 'Untitled procurement'}
						</a>
						<span class="sub">
							{framework
								? `Framework / multi-supplier · ${row.suppliers_on_award} suppliers`
								: 'Direct contract'}{row.lots_won > 1
								? ` · ${row.lots_won} lots won`
								: ''}{row.category ? ` · ${row.category}` : ''}
						</span>
					</td>
					<td class="num mono">
						{money(row.value)}
						{#if framework && row.value !== null}<span class="sub">ceiling</span>{/if}
					</td>
					<td><EndDate {row} {today} /></td>
				</tr>
			{:else}
				<tr>
					<td colspan={columns.length} class="empty">No procurements match these filters.</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.tbl {
		overflow-x: auto;
	}

	table {
		border-collapse: collapse;
		width: 100%;
		min-width: 820px;
		font-size: 0.86rem;
	}

	th {
		font: 600 0.72rem var(--f-mono);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
		text-align: left;
		padding: 0;
		border-bottom: 1px solid var(--line);
		white-space: nowrap;
		background: var(--surface);
		position: sticky;
		top: 0;
		z-index: 1;
	}

	th button {
		all: unset;
		cursor: pointer;
		display: block;
		width: 100%;
		padding: 10px 12px;
		box-sizing: border-box;
	}

	th button:hover {
		color: var(--fg);
	}

	th:not(:has(button)) {
		padding: 10px 12px;
	}

	th.num {
		text-align: right;
	}

	.arrow {
		display: inline-block;
		width: 0.8em;
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
		text-align: right;
		white-space: nowrap;
	}

	.co {
		font-weight: 600;
		color: var(--fg);
		text-decoration: none;
	}

	.co:hover {
		color: var(--accent);
		text-decoration: underline;
	}

	.ttl {
		max-width: 42ch;
	}

	.ttl a {
		color: var(--fg);
		text-decoration: none;
	}

	.ttl a:hover {
		color: var(--accent);
		text-decoration: underline;
	}

	.sub {
		display: block;
		color: var(--muted);
		font-size: 0.78rem;
		margin-top: 2px;
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

	.empty {
		padding: 28px;
		text-align: center;
		color: var(--muted);
	}
</style>
