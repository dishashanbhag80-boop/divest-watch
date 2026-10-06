import { describe, expect, it } from 'vitest';
import {
	applyFilters,
	confidencePool,
	defaultFilters,
	filtersFromParams,
	isDefault,
	paramsFromFilters,
	queryString,
	sortRows
} from './filters';
import { ALL_STATUSES, type Contract, type Status } from './types';

const TODAY = '2026-06-15';

const contract = (over: Partial<Contract> = {}): Contract => ({
	company: 'Acme Corp',
	company_country: 'USA',
	confidence: 'name',
	status: 'Active',
	buyer: 'Ministry of Defence',
	title: 'Radar maintenance',
	type: 'Contract',
	suppliers_on_award: 1,
	lots_won: 1,
	value: 1_000_000,
	value_basis: 'contract',
	currency: 'GBP',
	start_date: '2025-01-01',
	end_date: '2027-01-01',
	end_date_source: 'contract',
	max_end_date: '',
	date_signed: '2024-12-01',
	last_updated: '2025-01-15',
	category: 'services',
	supplier_name: 'Acme UK Ltd',
	ocid: 'ocds-test-0001',
	notice_url: 'https://example.invalid/notice',
	record_url: 'https://example.invalid/record',
	...over
});

describe('filtersFromParams', () => {
	it('defaults to the four live statuses', () => {
		const f = filtersFromParams(new URLSearchParams());
		expect([...f.statuses].sort()).toEqual(
			['Active', 'Extension window', 'Pending', 'Upcoming'].sort()
		);
	});

	it('reads an explicit status list, ignoring names that are not statuses', () => {
		const f = filtersFromParams(new URLSearchParams('status=Active,Expired,Nonsense'));
		expect([...f.statuses]).toEqual(['Active', 'Expired']);
	});

	it('treats status=all as every status', () => {
		expect(filtersFromParams(new URLSearchParams('status=all')).statuses.size).toBe(
			ALL_STATUSES.length
		);
	});

	it('allows an empty status list, meaning no status filter', () => {
		expect(filtersFromParams(new URLSearchParams('status=')).statuses.size).toBe(0);
	});

	it('rejects a type that is not one of the two real values', () => {
		expect(filtersFromParams(new URLSearchParams('type=Nonsense')).type).toBe('');
		expect(filtersFromParams(new URLSearchParams('type=Contract')).type).toBe('Contract');
	});

	it('ignores a junk sort key rather than sorting by it', () => {
		const f = filtersFromParams(new URLSearchParams('sort=drop+table:desc'));
		expect(f.sort).toBe('status');
		expect(f.dir).toBe('desc');
	});

	it('ignores a non-positive ends window', () => {
		expect(filtersFromParams(new URLSearchParams('ends=0')).endsWithin).toBeNull();
		expect(filtersFromParams(new URLSearchParams('ends=abc')).endsWithin).toBeNull();
		expect(filtersFromParams(new URLSearchParams('ends=90')).endsWithin).toBe(90);
	});
});

describe('paramsFromFilters', () => {
	it('writes nothing when everything is at its default', () => {
		expect(queryString(defaultFilters())).toBe('');
		expect(isDefault(defaultFilters())).toBe(true);
	});

	it('round-trips every field it serialises', () => {
		const start = {
			...defaultFilters(),
			q: 'radar',
			type: 'Contract' as const,
			company: 'Acme Corp',
			category: 'services',
			includeCheck: true,
			statuses: new Set<Status>(['Expired', 'Active']),
			endsWithin: 180,
			sort: 'value' as const,
			dir: 'desc' as const
		};
		const back = filtersFromParams(paramsFromFilters(start));
		expect({ ...back, statuses: [...back.statuses].sort() }).toEqual({
			...start,
			statuses: [...start.statuses].sort()
		});
	});

	it('collapses a full status set to status=all', () => {
		const f = { ...defaultFilters(), statuses: new Set<Status>(ALL_STATUSES) };
		expect(paramsFromFilters(f).get('status')).toBe('all');
	});
});

describe('confidencePool', () => {
	it('hides broad name matches unless asked for', () => {
		const rows = [contract(), contract({ confidence: 'check', ocid: 'x' })];
		expect(confidencePool(rows, false)).toHaveLength(1);
		expect(confidencePool(rows, true)).toHaveLength(2);
	});
});

describe('applyFilters', () => {
	const rows = [
		contract({ ocid: 'a', company: 'Acme Corp', status: 'Active', end_date: '2026-07-01' }),
		contract({ ocid: 'b', company: 'Beta Inc', status: 'Expired', end_date: '2026-01-01' }),
		contract({
			ocid: 'c',
			company: 'Acme Corp',
			status: 'Active',
			type: 'Framework / multi-supplier',
			category: 'goods',
			buyer: 'Belfast City Council',
			title: 'Body armour',
			end_date: '2029-01-01'
		}),
		contract({ ocid: 'd', confidence: 'check', status: 'Active' })
	];

	it('filters to the requested statuses', () => {
		const f = { ...defaultFilters(), statuses: new Set<Status>(['Expired']) };
		expect(applyFilters(rows, f, TODAY).map((r) => r.ocid)).toEqual(['b']);
	});

	it('applies no status filter when the set is empty', () => {
		const f = { ...defaultFilters(), statuses: new Set<Status>() };
		expect(applyFilters(rows, f, TODAY)).toHaveLength(3);
	});

	it('requires every search term to match, across all four searched fields', () => {
		const f = { ...defaultFilters(), q: 'belfast armour' };
		expect(applyFilters(rows, f, TODAY).map((r) => r.ocid)).toEqual(['c']);
	});

	it('finds nothing when one of several terms misses', () => {
		expect(applyFilters(rows, { ...defaultFilters(), q: 'belfast radar' }, TODAY)).toHaveLength(0);
	});

	it('searches case-insensitively on the supplier name too', () => {
		expect(applyFilters(rows, { ...defaultFilters(), q: 'ACME uk' }, TODAY).length).toBeGreaterThan(
			0
		);
	});

	it('filters by type, company and category', () => {
		expect(
			applyFilters(rows, { ...defaultFilters(), type: 'Framework / multi-supplier' }, TODAY).map(
				(r) => r.ocid
			)
		).toEqual(['c']);
		expect(
			applyFilters(
				rows,
				{ ...defaultFilters(), company: 'Beta Inc', statuses: new Set<Status>() },
				TODAY
			).map((r) => r.ocid)
		).toEqual(['b']);
		expect(
			applyFilters(rows, { ...defaultFilters(), category: 'goods' }, TODAY).map((r) => r.ocid)
		).toEqual(['c']);
	});

	it('limits to rows ending inside the window, excluding ones already past', () => {
		const f = { ...defaultFilters(), endsWithin: 90 };
		expect(applyFilters(rows, f, TODAY).map((r) => r.ocid)).toEqual(['a']);
	});

	it('excludes undated rows from an ends-within window', () => {
		const undated = [contract({ ocid: 'u', end_date: '', status: 'No end date' })];
		const f = { ...defaultFilters(), endsWithin: 90, statuses: new Set<Status>() };
		expect(applyFilters(undated, f, TODAY)).toHaveLength(0);
	});

	it('still hides check rows by default', () => {
		expect(applyFilters(rows, defaultFilters(), TODAY).map((r) => r.ocid)).not.toContain('d');
	});
});

describe('sortRows', () => {
	const rows = [
		contract({ ocid: 'a', company: 'Zeta', status: 'Expired', value: 50, end_date: '2027-01-01' }),
		contract({ ocid: 'b', company: 'Alpha', status: 'Active', value: null, end_date: '' }),
		contract({ ocid: 'c', company: 'Mid', status: 'Active', value: 900, end_date: '2026-01-01' })
	];

	it('orders by status rank, not alphabetically', () => {
		expect(sortRows(rows, 'status', 'asc').map((r) => r.status)).toEqual([
			'Active',
			'Active',
			'Expired'
		]);
	});

	it('treats a missing value as lower than any real one', () => {
		expect(sortRows(rows, 'value', 'desc').map((r) => r.ocid)).toEqual(['c', 'a', 'b']);
	});

	it('sorts undated rows last when sorting by end date ascending', () => {
		expect(sortRows(rows, 'end_date', 'asc').map((r) => r.ocid)).toEqual(['c', 'a', 'b']);
	});

	it('breaks ties by company then ocid, so the order is stable', () => {
		const tied = [
			contract({ ocid: 'z', company: 'Same', status: 'Active' }),
			contract({ ocid: 'a', company: 'Same', status: 'Active' })
		];
		expect(sortRows(tied, 'status', 'asc').map((r) => r.ocid)).toEqual(['a', 'z']);
	});

	it('does not mutate the array it was given', () => {
		const before = rows.map((r) => r.ocid);
		sortRows(rows, 'company', 'asc');
		expect(rows.map((r) => r.ocid)).toEqual(before);
	});
});
