import { ALL_STATUSES, LIVE_STATUSES, type Contract, type Status } from '#lib/types';
import { daysBetween, statusRank } from '#lib/status';

export type SortKey =
	'status' | 'company' | 'buyer' | 'title' | 'value' | 'end_date' | 'start_date';

export interface Filters {
	/** Free text, matched against buyer, title, supplier and company. */
	q: string;
	type: '' | 'Contract' | 'Framework / multi-supplier';
	company: string;
	category: string;
	/** Include rows whose supplier match was a broad name guess. */
	includeCheck: boolean;
	/** Empty set means "no status filter"; the default is the live four. */
	statuses: Set<Status>;
	/** Only rows ending within this many days, or null for no limit. */
	endsWithin: number | null;
	sort: SortKey;
	dir: 'asc' | 'desc';
}

const DEFAULT_STATUSES = new Set<Status>(LIVE_STATUSES);

export const defaultFilters = (): Filters => ({
	q: '',
	type: '',
	company: '',
	category: '',
	includeCheck: false,
	statuses: new Set(DEFAULT_STATUSES),
	endsWithin: null,
	sort: 'status',
	dir: 'asc'
});

const SORT_KEYS = new Set<string>([
	'status',
	'company',
	'buyer',
	'title',
	'value',
	'end_date',
	'start_date'
]);

const sameSet = (a: Set<string>, b: Set<string>) =>
	a.size === b.size && [...a].every((x) => b.has(x));

/** The read half of URLSearchParams, so `page.url.searchParams` works here too. */
export interface ReadableParams {
	get(name: string): string | null;
}

/** Read filter state out of a URL. Unknown or malformed values fall back to defaults. */
export function filtersFromParams(params: ReadableParams): Filters {
	const f = defaultFilters();
	f.q = params.get('q') ?? '';
	const type = params.get('type') ?? '';
	if (type === 'Contract' || type === 'Framework / multi-supplier') f.type = type;
	f.company = params.get('company') ?? '';
	f.category = params.get('category') ?? '';
	f.includeCheck = params.get('check') === '1';

	const status = params.get('status');
	if (status === 'all') f.statuses = new Set(ALL_STATUSES);
	else if (status !== null) {
		const wanted = new Set(status.split(',').filter(Boolean));
		f.statuses = new Set(ALL_STATUSES.filter((s) => wanted.has(s)));
	}

	const ends = Number(params.get('ends'));
	if (Number.isFinite(ends) && ends > 0) f.endsWithin = Math.floor(ends);

	const sort = params.get('sort') ?? '';
	const [key, dir] = sort.split(':');
	if (SORT_KEYS.has(key)) f.sort = key as SortKey;
	if (dir === 'desc' || dir === 'asc') f.dir = dir;
	return f;
}

/**
 * Serialise filters back to a query string, omitting anything at its default so
 * shared links stay readable.
 */
export function paramsFromFilters(f: Filters): URLSearchParams {
	const p = new URLSearchParams();
	if (f.q) p.set('q', f.q);
	if (f.type) p.set('type', f.type);
	if (f.company) p.set('company', f.company);
	if (f.category) p.set('category', f.category);
	if (f.includeCheck) p.set('check', '1');
	if (!sameSet(f.statuses as Set<string>, DEFAULT_STATUSES as Set<string>)) {
		p.set(
			'status',
			f.statuses.size === ALL_STATUSES.length
				? 'all'
				: ALL_STATUSES.filter((s) => f.statuses.has(s)).join(',')
		);
	}
	if (f.endsWithin) p.set('ends', String(f.endsWithin));
	if (f.sort !== 'status' || f.dir !== 'asc') p.set('sort', `${f.sort}:${f.dir}`);
	return p;
}

export const queryString = (f: Filters): string => {
	const s = paramsFromFilters(f).toString();
	return s ? `?${s}` : '';
};

export const isDefault = (f: Filters): boolean => paramsFromFilters(f).toString() === '';

/**
 * The `check` toggle is applied before counts are taken, so chip and company
 * tallies describe the same pool the table draws from.
 */
export const confidencePool = <T extends Pick<Contract, 'confidence'>>(
	rows: T[],
	includeCheck: boolean
): T[] => (includeCheck ? rows : rows.filter((r) => r.confidence !== 'check'));

export function applyFilters(rows: Contract[], f: Filters, today: string): Contract[] {
	const q = f.q.trim().toLowerCase();
	const terms = q ? q.split(/\s+/) : [];
	return confidencePool(rows, f.includeCheck).filter((r) => {
		if (f.statuses.size && !f.statuses.has(r.status)) return false;
		if (f.type && r.type !== f.type) return false;
		if (f.company && r.company !== f.company) return false;
		if (f.category && r.category !== f.category) return false;
		if (f.endsWithin != null) {
			const left = r.end_date ? daysBetween(today, r.end_date) : null;
			if (left == null || left < 0 || left > f.endsWithin) return false;
		}
		if (terms.length) {
			const hay = `${r.company} ${r.buyer} ${r.title} ${r.supplier_name}`.toLowerCase();
			if (!terms.every((t) => hay.includes(t))) return false;
		}
		return true;
	});
}

export function sortRows(rows: Contract[], sort: SortKey, dir: 'asc' | 'desc'): Contract[] {
	const sign = dir === 'asc' ? 1 : -1;
	const key = (r: Contract): string | number => {
		if (sort === 'status') return statusRank(r.status);
		if (sort === 'value') return r.value ?? -1;
		// undated rows sort last ascending rather than first
		if (sort === 'end_date' || sort === 'start_date') return r[sort] || '9999-12-31';
		return String(r[sort] ?? '').toLowerCase();
	};
	return rows.slice().sort((a, b) => {
		const ka = key(a),
			kb = key(b);
		if (ka === kb) return a.company.localeCompare(b.company) || a.ocid.localeCompare(b.ocid);
		return (ka > kb ? 1 : -1) * sign;
	});
}
