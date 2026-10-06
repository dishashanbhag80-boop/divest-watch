import { describe, expect, it } from 'vitest';
import {
	daysBetween,
	evidenceFor,
	isEstimated,
	isLive,
	liveStatus,
	statusRank,
	termProgress
} from './status';
import type { Contract, Status } from './types';

const TODAY = '2026-06-15';

/** Only the fields liveStatus() reads. */
const row = (over: Partial<Contract> = {}) => ({
	status: 'Active' as Status,
	start_date: '2024-01-01',
	end_date: '2027-01-01',
	max_end_date: '',
	end_date_source: 'contract',
	...over
});

describe('liveStatus', () => {
	it('passes through flags that cannot change without new data', () => {
		for (const status of ['Terminated', 'Cancelled', 'Not awarded'] as Status[]) {
			// an end date in the future must not revive a terminated contract
			expect(liveStatus(row({ status, end_date: '2030-01-01' }), TODAY)).toBe(status);
		}
	});

	it('expires a contract whose published end date has passed', () => {
		expect(liveStatus(row({ end_date: '2026-01-01' }), TODAY)).toBe('Expired');
	});

	it('is the whole point: a row built as Active expires once today moves past its end', () => {
		const built = row({ status: 'Active', end_date: '2026-06-14' });
		expect(liveStatus(built, '2026-06-13')).toBe('Active');
		expect(liveStatus(built, '2026-06-15')).toBe('Expired');
	});

	it('uses the extension window when an option still runs past the end date', () => {
		expect(liveStatus(row({ end_date: '2026-01-01', max_end_date: '2027-01-01' }), TODAY)).toBe(
			'Extension window'
		);
	});

	it('prefers Expired when the extension option has also passed', () => {
		expect(liveStatus(row({ end_date: '2026-01-01', max_end_date: '2026-02-01' }), TODAY)).toBe(
			'Expired'
		);
	});

	it('marks a future start date as Upcoming, even with an end date set', () => {
		expect(liveStatus(row({ start_date: '2027-01-01', end_date: '2030-01-01' }), TODAY)).toBe(
			'Upcoming'
		);
	});

	it('keeps Pending while there is no contract period to judge', () => {
		expect(liveStatus(row({ status: 'Pending', end_date: '', start_date: '' }), TODAY)).toBe(
			'Pending'
		);
	});

	it('leaves No end date alone rather than guessing', () => {
		expect(
			liveStatus(row({ status: 'No end date', end_date: '', end_date_source: '' }), TODAY)
		).toBe('No end date');
	});

	it('downgrades notice-text estimates to Probably active / Probably ended', () => {
		const est = { end_date_source: 'notice text' };
		expect(liveStatus(row({ ...est, end_date: '2027-01-01' }), TODAY)).toBe('Probably active');
		expect(liveStatus(row({ ...est, end_date: '2026-01-01' }), TODAY)).toBe('Probably ended');
	});

	it('downgrades framework legal maximum estimates the same way', () => {
		expect(liveStatus(row({ end_date_source: 'framework legal maximum (4 yrs)' }), TODAY)).toBe(
			'Probably active'
		);
	});

	it('does not downgrade a Contracts Finder date, which is published', () => {
		expect(
			liveStatus(row({ end_date_source: 'Contracts Finder (ocds-abc, match 0.82)' }), TODAY)
		).toBe('Active');
	});

	it('treats an age-based guess as probably ended whatever else it says', () => {
		expect(
			liveStatus(
				row({
					status: 'Probably ended',
					end_date: '',
					end_date_source: 'age (awarded over 5 years ago, no period published)'
				}),
				TODAY
			)
		).toBe('Probably ended');
	});
});

describe('isLive', () => {
	it('counts the four running statuses and nothing else', () => {
		expect(['Active', 'Extension window', 'Upcoming', 'Pending'].every(isLive)).toBe(true);
		expect(['Probably active', 'No end date', 'Expired', 'Terminated'].some(isLive)).toBe(false);
	});
});

describe('statusRank', () => {
	it('sorts live work above finished work', () => {
		expect(statusRank('Active')).toBeLessThan(statusRank('Expired'));
		expect(statusRank('Expired')).toBeLessThan(statusRank('Cancelled'));
	});

	it('puts an unrecognised status last instead of first', () => {
		expect(statusRank('Something new')).toBeGreaterThan(statusRank('Not awarded'));
	});
});

describe('isEstimated', () => {
	it('matches only the two weak-evidence sources', () => {
		expect(isEstimated('notice text, approx. start from notice year')).toBe(true);
		expect(isEstimated('framework legal maximum (7 yrs)')).toBe(true);
		expect(isEstimated('estimated (start + duration)')).toBe(false);
		expect(isEstimated(undefined)).toBe(false);
	});
});

describe('evidenceFor', () => {
	it('names the kind of evidence behind each end date', () => {
		expect(evidenceFor({ end_date: '2027-01-01', end_date_source: 'contract' })).toBe('published');
		expect(
			evidenceFor({ end_date: '2027-01-01', end_date_source: 'estimated (start + duration)' })
		).toBe('start-plus-duration');
		expect(
			evidenceFor({ end_date: '2027-01-01', end_date_source: 'Contracts Finder (x, match 0.9)' })
		).toBe('contracts-finder');
		expect(evidenceFor({ end_date: '2027-01-01', end_date_source: 'notice text' })).toBe('approx');
		expect(evidenceFor({ end_date: '', end_date_source: 'age (awarded over 5 years ago)' })).toBe(
			'age'
		);
		expect(evidenceFor({ end_date: '', end_date_source: '' })).toBe('none');
	});
});

describe('daysBetween', () => {
	it('counts whole days forwards and backwards', () => {
		expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30);
		expect(daysBetween('2026-01-31', '2026-01-01')).toBe(-30);
	});

	it('returns null rather than NaN for unusable dates', () => {
		expect(daysBetween('', '2026-01-01')).toBeNull();
		expect(daysBetween('2026-01-01', 'not a date')).toBeNull();
	});
});

describe('termProgress', () => {
	it('is the share of the term elapsed', () => {
		expect(termProgress({ start_date: '2026-01-01', end_date: '2026-01-11' }, '2026-01-06')).toBe(
			50
		);
	});

	it('clamps outside the term instead of reporting negatives or >100', () => {
		expect(termProgress({ start_date: '2026-01-01', end_date: '2026-01-11' }, '2025-01-01')).toBe(
			0
		);
		expect(termProgress({ start_date: '2026-01-01', end_date: '2026-01-11' }, '2027-01-01')).toBe(
			100
		);
	});

	it('gives up without both dates, or on a zero-length term', () => {
		expect(termProgress({ start_date: '', end_date: '2026-01-11' }, '2026-01-06')).toBeNull();
		expect(
			termProgress({ start_date: '2026-01-01', end_date: '2026-01-01' }, '2026-01-01')
		).toBeNull();
	});
});
