import { ALL_STATUSES, LIVE_STATUSES, type Contract, type Status } from '#lib/types';

/** `end_date_source` prefixes that mean the date is a guess, not a published period. */
const ESTIMATED_PREFIXES = ['notice text', 'framework legal maximum'];

const LIVE = new Set<string>(LIVE_STATUSES);
const SETTLED = new Set<string>(['Terminated', 'Cancelled', 'Not awarded']);

export const isLive = (status: string): boolean => LIVE.has(status);

/** Sort key matching the pipeline's ORDER: live work first, dead contracts last. */
export const statusRank = (status: string): number => {
	const i = (ALL_STATUSES as readonly string[]).indexOf(status);
	return i === -1 ? ALL_STATUSES.length : i;
};

export const isEstimated = (source: string | undefined): boolean =>
	ESTIMATED_PREFIXES.some((p) => (source ?? '').startsWith(p));

export type Evidence =
	'published' | 'start-plus-duration' | 'contracts-finder' | 'approx' | 'age' | 'none';

/** What kind of evidence the row's end date rests on. */
export function evidenceFor(row: Pick<Contract, 'end_date' | 'end_date_source'>): Evidence {
	const src = row.end_date_source ?? '';
	if (src.startsWith('age')) return 'age';
	if (isEstimated(src)) return 'approx';
	if (src.startsWith('Contracts Finder')) return 'contracts-finder';
	if (src.startsWith('estimated')) return 'start-plus-duration';
	return row.end_date ? 'published' : 'none';
}

export const EVIDENCE_LABELS: Record<Evidence, { tag: string; title: string } | null> = {
	published: null,
	'start-plus-duration': {
		tag: 'est.',
		title: 'Start date plus the duration published in the notice'
	},
	'contracts-finder': {
		tag: 'CF',
		title: 'End date taken from the matching Contracts Finder notice'
	},
	approx: {
		tag: 'approx.',
		title: 'Duration found in the notice text, not a published contract period'
	},
	age: { tag: 'age', title: 'No contract period published; awarded more than five years ago' },
	none: null
};

/**
 * Recompute a date-driven status against `today`.
 *
 * The pipeline stamps a status when it runs, but a contract that was Active in
 * last month's build may have expired since. Flags that can't change without
 * new data (terminated, cancelled, never awarded) are passed through.
 */
export function liveStatus(
	row: Pick<Contract, 'status' | 'start_date' | 'end_date' | 'max_end_date' | 'end_date_source'>,
	today: string
): Status {
	if (SETTLED.has(row.status)) return row.status;
	if (row.status === 'No end date') return row.status;
	if ((row.end_date_source ?? '').startsWith('age')) return 'Probably ended';

	const { start_date: start, end_date: end, max_end_date: max } = row;
	let status: Status;
	if (start && start > today) status = 'Upcoming';
	else if (end && end < today) status = max && max >= today ? 'Extension window' : 'Expired';
	else if (row.status === 'Pending') status = 'Pending';
	else status = end ? 'Active' : row.status;

	if (isEstimated(row.end_date_source)) {
		if (status === 'Expired') return 'Probably ended';
		if (status === 'Active' || status === 'Upcoming' || status === 'Extension window')
			return 'Probably active';
	}
	return status;
}

/** Whole days from `from` to `to`, or null if either date is unusable. */
export function daysBetween(from: string, to: string): number | null {
	const a = Date.parse(from),
		b = Date.parse(to);
	if (Number.isNaN(a) || Number.isNaN(b)) return null;
	return Math.round((b - a) / 864e5);
}

/** How far through its term a contract is, 0–100, or null when undatable. */
export function termProgress(
	row: Pick<Contract, 'start_date' | 'end_date'>,
	today: string
): number | null {
	if (!row.start_date || !row.end_date) return null;
	const total = daysBetween(row.start_date, row.end_date);
	const done = daysBetween(row.start_date, today);
	if (total == null || done == null || total <= 0) return null;
	return Math.max(0, Math.min(100, (done / total) * 100));
}
