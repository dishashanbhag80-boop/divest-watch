<script lang="ts">
	/** The Ends column: date, evidence tag, countdown, and term progress bar. */
	import { untilText } from '#lib/format';
	import { EVIDENCE_LABELS, daysBetween, evidenceFor, termProgress } from '#lib/status';
	import type { Contract } from '#lib/types';

	let { row, today }: { row: Contract; today: string } = $props();

	let evidence = $derived(evidenceFor(row));
	let label = $derived(EVIDENCE_LABELS[evidence]);
	let daysLeft = $derived(row.end_date ? daysBetween(today, row.end_date) : null);
	let progress = $derived(termProgress(row, today));
	let canExtend = $derived(!!row.max_end_date && row.max_end_date > (row.end_date || ''));
</script>

<span class="date mono">{row.end_date || '—'}</span>
{#if label}
	<span class="tag" class:chk={evidence === 'approx' || evidence === 'age'} title={label.title}>
		{label.tag}
	</span>
{/if}

{#if row.end_date}
	<span class="cd" class:soon={daysLeft !== null && daysLeft >= 0 && daysLeft <= 90}>
		{untilText(row.end_date, today)}
	</span>
{:else if evidence === 'age'}
	<span class="cd" title={row.end_date_source}>awarded 5+ years ago</span>
{/if}

{#if progress !== null && daysLeft !== null && daysLeft >= 0}
	<span class="term" title="{Math.round(progress)}% of the term elapsed">
		<i style="width:{progress.toFixed(0)}%"></i>
	</span>
{/if}

{#if canExtend}
	<span class="sub">max {row.max_end_date}</span>
{/if}

<style>
	.date {
		white-space: nowrap;
	}

	.cd {
		display: block;
		color: var(--muted);
		font-size: 0.76rem;
		margin-top: 2px;
	}

	.cd.soon {
		color: var(--warn);
		font-weight: 600;
	}

	.term {
		display: block;
		width: 96px;
		height: 4px;
		background: var(--line);
		border-radius: 2px;
		margin-top: 5px;
		overflow: hidden;
	}

	.term i {
		display: block;
		height: 100%;
		background: var(--accent);
	}

	.sub {
		display: block;
		color: var(--muted);
		font-size: 0.78rem;
		margin-top: 2px;
	}
</style>
