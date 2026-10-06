/**
 * Loads the JSON the Python pipeline wrote into `data/`.
 *
 * Only ever imported from `.server.ts` / `+server.ts` modules, so this runs at
 * build time (every route is prerendered) and nothing here reaches the browser.
 */
// The pipeline's output is inlined as text at build time rather than read from
// disk, because the bundled server chunk does not sit where this source file
// does. It also makes a data refresh a normal dev-server reload.
import contractsRaw from '../../../data/contracts.json?raw';
import awardsRaw from '../../../data/awards.json?raw';
import shortlistRaw from '../../../pipeline/shortlist.json?raw';

import { slugify } from '#lib/format';
import { isLive, statusRank } from '#lib/status';
import type { Award, Contract, Meta, Shortlist, ShortlistCompany } from '#lib/types';

/** `record_url` is just the base plus the ocid, so it is dropped before the rows
 *  are serialised into the page and rebuilt on the client. */
export type WireContract = Omit<Contract, 'record_url'>;

export interface Dataset {
	meta: Meta;
	contracts: WireContract[];
	awards: Award[];
	shortlist: Shortlist;
	byOcid: Map<string, WireContract[]>;
	awardsByOcid: Map<string, Award[]>;
	companies: Map<string, ShortlistCompany>;
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
	const out = new Map<string, T[]>();
	for (const row of rows) {
		const k = key(row);
		const bucket = out.get(k);
		if (bucket) bucket.push(row);
		else out.set(k, [row]);
	}
	return out;
}

let cached: Dataset | undefined;

export function dataset(): Dataset {
	if (cached) return cached;

	const summary = JSON.parse(contractsRaw) as { meta: Meta; rows: Contract[] };
	const detail = JSON.parse(awardsRaw) as { meta: Meta; rows: Award[] };
	const shortlist = JSON.parse(shortlistRaw) as Shortlist;

	const contracts: WireContract[] = summary.rows.map(({ record_url: _drop, ...row }) => row);

	cached = {
		meta: summary.meta,
		contracts,
		awards: detail.rows,
		shortlist,
		byOcid: groupBy(contracts, (r) => r.ocid),
		awardsByOcid: groupBy(detail.rows, (r) => r.ocid),
		companies: new Map(shortlist.companies.map((c) => [c.name, c]))
	};
	return cached;
}

/** Company name → slug, and back. Slugs are derived from the name only, so they
 *  stay stable across data refreshes. */
export function companySlugs(): Map<string, string> {
	const out = new Map<string, string>();
	for (const row of dataset().contracts) {
		const slug = slugify(row.company);
		if (!out.has(slug)) out.set(slug, row.company);
	}
	return out;
}

/** Procurements a single company appears on, best status first. */
export function contractsForCompany(company: string): WireContract[] {
	return dataset()
		.contracts.filter((r) => r.company === company)
		.sort(
			(a, b) => statusRank(a.status) - statusRank(b.status) || a.end_date.localeCompare(b.end_date)
		);
}

export function awardsForCompany(company: string): Award[] {
	return dataset().awards.filter((r) => r.company === company);
}

/** Every distinct procurement category present in the data, for the filter select. */
export function categories(): string[] {
	return [
		...new Set(
			dataset()
				.contracts.map((r) => r.category)
				.filter(Boolean)
		)
	].sort();
}

/** Headline numbers as of the build. The client recomputes these against the
 *  real current date once it hydrates. */
export function buildTimeTotals() {
	const rows = dataset().contracts.filter((r) => r.confidence !== 'check');
	const live = rows.filter((r) => isLive(r.status));
	return {
		procurements: rows.length,
		live: live.length,
		companies: new Set(live.map((r) => r.company)).size
	};
}

export interface BuyerGroup {
	slug: string;
	/** Most frequently published spelling, used as the display name. */
	name: string;
	/** Every spelling that slugs to the same key — the data has several. */
	variants: string[];
	ocids: Set<string>;
}

/**
 * Buyers keyed by slug. Several buyers appear under more than one spelling
 * ("Ministry of Defence" / "Ministry Of Defence"); slugging collapses those into
 * one page instead of splitting a department's contracts across two.
 */
export function buyerGroups(): Map<string, BuyerGroup> {
	const counts = new Map<string, Map<string, number>>();
	const ocids = new Map<string, Set<string>>();
	for (const row of dataset().contracts) {
		const slug = slugify(row.buyer);
		if (!slug) continue;
		const spellings = counts.get(slug) ?? new Map<string, number>();
		spellings.set(row.buyer, (spellings.get(row.buyer) ?? 0) + 1);
		counts.set(slug, spellings);
		(ocids.get(slug) ?? ocids.set(slug, new Set()).get(slug)!).add(row.ocid);
	}

	const out = new Map<string, BuyerGroup>();
	for (const [slug, spellings] of counts) {
		const variants = [...spellings.entries()].sort(
			(a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
		);
		out.set(slug, {
			slug,
			name: variants[0][0],
			variants: variants.map(([name]) => name),
			ocids: ocids.get(slug) ?? new Set()
		});
	}
	return out;
}

/** Procurements for one buyer slug, across every spelling of its name. */
export function contractsForBuyer(slug: string): WireContract[] {
	const group = buyerGroups().get(slug);
	if (!group) return [];
	const names = new Set(group.variants);
	return dataset()
		.contracts.filter((r) => names.has(r.buyer))
		.sort(
			(a, b) => statusRank(a.status) - statusRank(b.status) || a.company.localeCompare(b.company)
		);
}
