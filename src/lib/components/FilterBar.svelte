<script lang="ts">
	import { ALL_STATUSES, type Status } from '#lib/types';
	import { isDefault, type Filters } from '#lib/filters';

	let {
		filters,
		statusCounts,
		companies,
		categories,
		onchange,
		onreset,
		showCompany = true
	}: {
		filters: Filters;
		/** Counts over the current confidence pool, so chips match the table. */
		statusCounts: Record<string, number>;
		companies: string[];
		categories: string[];
		onchange: (patch: Partial<Filters>) => void;
		onreset: () => void;
		showCompany?: boolean;
	} = $props();

	const ENDS_OPTIONS = [
		{ value: null, label: 'Any end date' },
		{ value: 90, label: 'Ends within 90 days' },
		{ value: 180, label: 'Ends within 6 months' },
		{ value: 365, label: 'Ends within a year' }
	];

	function toggleStatus(status: Status) {
		const next = new Set(filters.statuses);
		if (next.has(status)) next.delete(status);
		else next.add(status);
		onchange({ statuses: next });
	}

	let visibleStatuses = $derived(ALL_STATUSES.filter((s) => statusCounts[s]));
</script>

<div class="bar">
	<div class="row">
		<input
			type="search"
			placeholder="Search buyer, title, supplier…"
			aria-label="Search procurements"
			value={filters.q}
			oninput={(e) => onchange({ q: e.currentTarget.value })}
		/>
		<select
			aria-label="Contract type"
			value={filters.type}
			onchange={(e) => onchange({ type: e.currentTarget.value as Filters['type'] })}
		>
			<option value="">All types</option>
			<option value="Contract">Direct contracts</option>
			<option value="Framework / multi-supplier">Frameworks / multi-supplier</option>
		</select>
		{#if showCompany}
			<select
				aria-label="Company"
				value={filters.company}
				onchange={(e) => onchange({ company: e.currentTarget.value })}
			>
				<option value="">All companies</option>
				{#each companies as company (company)}
					<option value={company}>{company}</option>
				{/each}
			</select>
		{/if}
		<select
			aria-label="Procurement category"
			value={filters.category}
			onchange={(e) => onchange({ category: e.currentTarget.value })}
		>
			<option value="">All categories</option>
			{#each categories as category (category)}
				<option value={category}>{category}</option>
			{/each}
		</select>
		<select
			aria-label="Ending within"
			value={String(filters.endsWithin ?? '')}
			onchange={(e) =>
				onchange({ endsWithin: e.currentTarget.value ? Number(e.currentTarget.value) : null })}
		>
			{#each ENDS_OPTIONS as option (option.label)}
				<option value={option.value ?? ''}>{option.label}</option>
			{/each}
		</select>
	</div>

	<div class="row">
		<div class="chips" role="group" aria-label="Filter by status">
			{#each visibleStatuses as status (status)}
				<button
					type="button"
					class="chip"
					aria-pressed={filters.statuses.has(status)}
					onclick={() => toggleStatus(status)}
				>
					{status} · {statusCounts[status]}
				</button>
			{/each}
		</div>
		<label class="tog">
			<input
				type="checkbox"
				checked={filters.includeCheck}
				onchange={(e) => onchange({ includeCheck: e.currentTarget.checked })}
			/>
			Include name matches to check
		</label>
		{#if !isDefault(filters)}
			<button class="linkish" type="button" onclick={onreset}>Reset filters</button>
		{/if}
	</div>
</div>

<style>
	.bar {
		display: grid;
		gap: 10px;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}

	input[type='search'] {
		flex: 1 1 220px;
		min-width: 0;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
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
</style>
