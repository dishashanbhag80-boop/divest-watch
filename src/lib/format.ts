import { daysBetween } from '#lib/status';

/** `2026-10-05` for a Date, in UTC — the format every date in the data uses. */
export const isoDate = (d: Date = new Date()): string => d.toISOString().slice(0, 10);

/** Money, rounded. `compact` gives £1.2bn / £340m / £75k for headline figures. */
export function money(value: number | null | undefined, compact = false): string {
	if (value == null) return '—';
	if (!compact) return '£' + Math.round(value).toLocaleString('en-GB');
	const abs = Math.abs(value);
	if (abs >= 1e9) return '£' + (value / 1e9).toFixed(1) + 'bn';
	if (abs >= 1e6) return '£' + (value / 1e6).toFixed(1) + 'm';
	if (abs >= 1e3) return '£' + Math.round(value / 1e3) + 'k';
	return '£' + Math.round(value);
}

const PLURAL = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** `3 months`, `2y 4m`, `17 days` — a rough span for humans. */
export function duration(days: number): string {
	const abs = Math.abs(days);
	if (abs < 31) return PLURAL(abs, 'day');
	const years = Math.floor(abs / 365);
	const months = Math.floor((abs % 365) / 30.4);
	if (years) return `${years}y ${months}m`;
	return PLURAL(Math.max(1, months), 'month');
}

/** `ends in 4 months` / `ended 2y 1m ago`, relative to `today`. */
export function untilText(endDate: string, today: string): string {
	const n = daysBetween(today, endDate);
	if (n == null) return '';
	return n >= 0 ? `ends in ${duration(n)}` : `ended ${duration(n)} ago`;
}

/** `5 Oct 2026`, or the raw string if it isn't a date we understand. */
export function prettyDate(iso: string): string {
	if (!iso) return '—';
	const t = Date.parse(iso);
	if (Number.isNaN(t)) return iso;
	return new Date(t).toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

const LEGAL_SUFFIX =
	/\s+(Inc|Corp|Co|PLC|plc|Ltd|AG|SpA|ASA|SE|NV|SAB de CV|Holdings|Technologies|Gruppen)\b\.?/g;

/** Drop the legal suffix so company names fit in a table cell. */
export const shortName = (name: string): string => String(name).replace(LEGAL_SUFFIX, '').trim();

/** URL-safe id for a company name. Stable as long as the name is. */
export const slugify = (name: string): string =>
	name
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

/** `data 3 days old` freshness banding for the header. */
export function dataAge(
	asOf: string,
	today: string
): { days: number; label: string; level: 'fresh' | 'stale' | 'old' } | null {
	const days = asOf ? daysBetween(asOf, today) : null;
	if (days == null) return null;
	const label =
		days <= 0 ? 'Data updated today' : days === 1 ? 'Data 1 day old' : `Data ${days} days old`;
	return { days, label, level: days > 14 ? 'old' : days > 8 ? 'stale' : 'fresh' };
}
