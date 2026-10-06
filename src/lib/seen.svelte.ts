/**
 * Remembers which procurements were present at the previous data refresh, so
 * rows added by the latest one can be badged NEW.
 *
 * The previous generation's key list is kept alongside the current one, which
 * means the badges stay put when you come back to the page mid-month instead of
 * vanishing after the first visit.
 */
import { browser } from '$app/env';

const KEY = 'dcw-seen';

interface Stored {
	gen: string;
	keys: string[];
	prev: string[] | null;
}

export const rowKey = (row: { ocid: string; company: string }): string =>
	`${row.ocid}|${row.company}`;

/** Call once the page has hydrated. Returns null on a first-ever visit. */
export function recordVisit(generated: string, keys: string[]): Set<string> | null {
	if (!browser) return null;
	let stored: Stored | null = null;
	try {
		stored = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Stored | null;
	} catch {
		// unreadable or corrupt entry; `stored` stays null and we start over
	}

	const baseline = !stored ? null : stored.gen !== generated ? stored.keys : stored.prev;

	if (!stored || stored.gen !== generated) {
		try {
			const next: Stored = { gen: generated, keys, prev: stored ? stored.keys : null };
			localStorage.setItem(KEY, JSON.stringify(next));
		} catch {
			// nothing to do; badges just won't persist
		}
	}
	return baseline ? new Set(baseline) : null;
}
