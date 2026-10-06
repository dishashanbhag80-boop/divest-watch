<script lang="ts">
	import { resolve } from '$app/paths';
	import { SOURCES } from '#lib/links';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const STATUSES = [
		['Active', 'Started, with an end date in the future.'],
		[
			'Extension window',
			'The initial term has ended, but a published extension option is still running.'
		],
		['Upcoming', 'The start date is in the future.'],
		['Pending', 'An award notice exists but no contract has been confirmed.'],
		[
			'Probably active / Probably ended',
			'The end date came from a duration written in the notice text, or the award is more than five years old with no period published. Weaker evidence than a published contract period.'
		],
		['No end date', 'No contract period was published and none could be found elsewhere.'],
		['Expired', 'The published end date has passed and no extension option runs past today.'],
		['Terminated / Cancelled', 'Flagged as such in the compiled release.'],
		['Not awarded', 'The award was recorded as unsuccessful.']
	] as const;

	let evidence = $derived(Object.entries(data.evidence).sort((a, b) => b[1] - a[1]));
</script>

<svelte:head>
	<title>Method — Divest Contract Watch</title>
	<meta
		name="description"
		content="Where the data comes from, how suppliers are matched to the shortlist, how each contract's status is worked out, and what the figures do not cover."
	/>
</svelte:head>

<div class="wrap">
	<header class="intro">
		<span class="eyebrow">Method</span>
		<h1>How this is built</h1>
		<p>
			Every figure on this site comes from published UK procurement notices. This page says how they
			are read, where the judgement calls are, and what the numbers do not cover.
		</p>
	</header>

	<section>
		<h2>The data</h2>
		<p>
			A Python pipeline reads the <a href={SOURCES.fts}>Find a Tender</a> export from the
			<a href={SOURCES.registry}>Open Contracting Partnership</a> data registry. The export holds
			one
			<i>compiled release</i> per procurement: the merged latest state of every notice published against
			it — award, contract details, amendments, terminations.
		</p>
		<p>
			On the 7th of each month a GitHub Action downloads the newest export, rebuilds
			<code>data/contracts.json</code> and redeploys this site. The commit history of
			<code>data/contracts.csv</code> is the record of what changed each month.
		</p>
		<dl class="counts">
			<div>
				<dt>Companies on the shortlist</dt>
				<dd>{data.counts.shortlisted}</dd>
			</div>
			<div>
				<dt>Found as UK suppliers</dt>
				<dd>{data.counts.matched}</dd>
			</div>
			<div>
				<dt>Procurements matched</dt>
				<dd>{data.counts.procurements}</dd>
			</div>
			<div>
				<dt>Award / lot rows behind them</dt>
				<dd>{data.counts.awards}</dd>
			</div>
			<div>
				<dt>Procurements scanned</dt>
				<dd>{data.meta.procurements.toLocaleString('en-GB')}</dd>
			</div>
			<div>
				<dt>Rows flagged for a human check</dt>
				<dd>{data.counts.needingCheck}</dd>
			</div>
		</dl>
	</section>

	<section>
		<h2>Matching companies</h2>
		<p>
			The company list comes from the <a href={SOURCES.shortlist}>BDS divestment shortlist</a>, plus
			the UK subsidiaries and trading names those companies win contracts under.
		</p>
		<p>{data.matchingNote}</p>
		<p>
			A match on a Companies House number is reliable. A match on a distinctive name phrase is
			usually right. A match on a broad phrase — a common word, a parent group's name, a licensed
			brand — is tagged <span class="tag chk">check</span> and hidden until you ask for it, because these
			are the ones that go wrong.
		</p>
		<p class="caveat">
			Supplier matching is by name. It will miss subsidiaries that do not carry the parent's name,
			and it can wrongly include an unrelated firm with a similar one. Check the original notice
			before relying on any single row.
		</p>
	</section>

	<section>
		<h2>Working out status</h2>
		<p>
			Terminated, cancelled and unsuccessful flags in the compiled release win outright. Otherwise
			status is the contract's published dates measured against today — recalculated in your browser
			each time you open a page, so a contract that expired since the last data refresh shows as
			expired.
		</p>
		<dl class="statuses">
			{#each STATUSES as [name, meaning] (name)}
				<div>
					<dt>{name}</dt>
					<dd>{meaning}</dd>
				</div>
			{/each}
		</dl>
	</section>

	<section>
		<h2>Filling in missing end dates</h2>
		<p>
			Many award notices never publish a contract period. Where one is missing the pipeline tries,
			in order: the contract period on the contract, award, lot or tender; a start date plus a
			published duration; the same contract in the
			<a href={SOURCES.contractsFinder}>Contracts Finder</a> export, matched on company, buyer and title;
			a duration written in the notice text; and finally, for awards over five years old, a note that
			it has probably ended.
		</p>
		<p>
			Each row carries the evidence its end date rests on, shown as a tag in the Ends column. Across
			the current dataset:
		</p>
		<ul class="evidence">
			{#each evidence as [kind, count] (kind)}
				<li><b class="mono">{count}</b> <span>{kind}</span></li>
			{/each}
		</ul>
	</section>

	<section>
		<h2>What the figures do not cover</h2>
		<ul class="caveats">
			<li>
				<b>Published values, not payments.</b> A contract value is what the notice said it was worth,
				not what was spent. Framework values are usually a ceiling shared by every supplier on the framework,
				so the headline total counts single-supplier contracts only.
			</li>
			<li>
				<b>Above-threshold procurement from 2021 onwards.</b> Find a Tender starts in 2021. Smaller contracts,
				and anything below the publication threshold, are not here.
			</li>
			<li>
				<b>Classified defence contracts are not published at all</b>, so they cannot appear.
			</li>
			<li>
				<b>Sub-contracting is invisible.</b> A company supplying a prime contractor does not show up as
				a supplier in the notice.
			</li>
			<li>
				<b>One row per procurement per company.</b> Large frameworks split across dozens of lots are rolled
				up, with the lots counted rather than listed.
			</li>
		</ul>
	</section>

	<section>
		<h2>Take the data</h2>
		<p>
			Everything behind this site is downloadable. The CSVs are one row per procurement per company
			and one row per award; the JSON is what these pages are built from.
		</p>
		<p class="links">
			<a href={resolve('/api/contracts.csv')}>contracts.csv</a>
			<a href={resolve('/api/contracts.json')}>contracts.json</a>
			<a href={resolve('/api/companies.json')}>companies.json</a>
			<a href={resolve('/api/awards.json')}>awards.json</a>
		</p>
		<p class="caveat">
			Contains public sector information licensed under the
			<a href={SOURCES.ogl}>Open Government Licence v3.0</a>. Shortlist fetched from
			<a href={SOURCES.shortlist}>{data.shortlistSource}</a>.
		</p>
	</section>
</div>

<style>
	.wrap {
		max-width: 760px;
		margin: 0 auto;
		padding-inline: clamp(16px, 3vw, 32px);
		padding-block: 28px 0;
		display: grid;
		gap: 36px;
	}

	.intro {
		display: grid;
		gap: 10px;
	}

	section {
		display: grid;
		gap: 12px;
	}

	p {
		max-width: 72ch;
		color: var(--muted);
	}

	.intro p {
		font-size: 1rem;
	}

	h2 {
		font-size: 1.15rem;
		padding-bottom: 6px;
		border-bottom: 2px solid var(--fg);
	}

	code {
		font-family: var(--f-mono);
		font-size: 0.8rem;
		background: var(--surface-2);
		padding: 1px 4px;
		border-radius: 3px;
		color: var(--fg);
	}

	dl {
		margin: 0;
		display: grid;
		gap: 10px;
	}

	.counts {
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		gap: 14px 20px;
		padding: 16px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
	}

	.counts dt {
		font-size: 0.76rem;
		color: var(--muted);
		margin-bottom: 2px;
	}

	.counts dd {
		margin: 0;
		font: 700 1.25rem var(--f-display);
		font-variant-numeric: tabular-nums;
	}

	.statuses div {
		display: grid;
		grid-template-columns: minmax(0, 180px) minmax(0, 1fr);
		gap: 4px 16px;
		padding-block: 9px;
		border-bottom: 1px solid var(--line);
	}

	@media (max-width: 560px) {
		.statuses div {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	.statuses dt {
		font-weight: 600;
		font-size: 0.88rem;
	}

	.statuses dd {
		margin: 0;
		color: var(--muted);
		font-size: 0.88rem;
	}

	.evidence {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0;
	}

	.evidence li {
		display: grid;
		grid-template-columns: 4em minmax(0, 1fr);
		gap: 12px;
		padding-block: 7px;
		border-bottom: 1px solid var(--line);
		font-size: 0.86rem;
	}

	.evidence b {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.evidence span {
		color: var(--muted);
	}

	.caveats {
		margin: 0;
		padding-left: 20px;
		display: grid;
		gap: 10px;
		color: var(--muted);
		font-size: 0.9rem;
		max-width: 72ch;
	}

	.caveats b {
		color: var(--fg);
	}

	.caveat {
		font-size: 0.85rem;
		border-left: 3px solid var(--warn);
		padding-left: 12px;
	}

	.links {
		display: flex;
		gap: 18px;
		flex-wrap: wrap;
		font-family: var(--f-mono);
		font-size: 0.85rem;
	}
</style>
