import { describe, expect, it } from 'vitest';
import {
	dataAge,
	duration,
	isoDate,
	money,
	prettyDate,
	shortName,
	slugify,
	untilText
} from './format';

describe('money', () => {
	it('writes full pounds with thousands separators', () => {
		expect(money(1234567)).toBe('£1,234,567');
	});

	it('compacts to bn / m / k for headline figures', () => {
		expect(money(2_400_000_000, true)).toBe('£2.4bn');
		expect(money(3_450_000, true)).toBe('£3.5m');
		expect(money(74_600, true)).toBe('£75k');
		expect(money(420, true)).toBe('£420');
	});

	it('renders a missing value as an em dash, not £0', () => {
		expect(money(null)).toBe('—');
		expect(money(undefined)).toBe('—');
		expect(money(0)).toBe('£0');
	});
});

describe('duration', () => {
	it('uses days under a month, then months, then years and months', () => {
		expect(duration(1)).toBe('1 day');
		expect(duration(17)).toBe('17 days');
		expect(duration(90)).toBe('2 months');
		expect(duration(800)).toBe('2y 2m');
	});
});

describe('untilText', () => {
	it('says how long is left, or how long ago it ended', () => {
		expect(untilText('2026-07-01', '2026-06-15')).toBe('ends in 16 days');
		expect(untilText('2026-01-01', '2026-06-15')).toBe('ended 5 months ago');
	});

	it('is empty when there is no usable end date', () => {
		expect(untilText('', '2026-06-15')).toBe('');
	});
});

describe('prettyDate', () => {
	it('formats an ISO date in UTC so it never slips a day', () => {
		expect(prettyDate('2026-10-05')).toBe('5 Oct 2026');
	});

	it('passes through anything it cannot parse', () => {
		expect(prettyDate('')).toBe('—');
		expect(prettyDate('unknown')).toBe('unknown');
	});
});

describe('shortName', () => {
	it('drops the legal suffix so names fit a table cell', () => {
		expect(shortName('Rolls-Royce Holdings plc')).toBe('Rolls-Royce');
		expect(shortName('Cemex SAB de CV')).toBe('Cemex');
	});

	it('leaves a name with no suffix alone', () => {
		expect(shortName('Palantir')).toBe('Palantir');
	});
});

describe('slugify', () => {
	it('makes a URL-safe id', () => {
		expect(slugify('Rolls-Royce Holdings plc')).toBe('rolls-royce-holdings-plc');
		expect(slugify('Alony-Hetz Properties & Investments Ltd')).toBe(
			'alony-hetz-properties-and-investments-ltd'
		);
	});

	it('collapses spellings that differ only in punctuation or case', () => {
		expect(slugify('Ministry of Defence')).toBe(slugify('Ministry Of Defence'));
	});

	it('leaves no leading or trailing dashes', () => {
		expect(slugify('  (Leading) & trailing!  ')).toBe('leading-and-trailing');
	});
});

describe('dataAge', () => {
	it('bands freshness so a stale build is visible', () => {
		expect(dataAge('2026-06-15', '2026-06-15')).toEqual({
			days: 0,
			label: 'Data updated today',
			level: 'fresh'
		});
		expect(dataAge('2026-06-14', '2026-06-15')?.label).toBe('Data 1 day old');
		expect(dataAge('2026-06-05', '2026-06-15')?.level).toBe('stale');
		expect(dataAge('2026-05-15', '2026-06-15')?.level).toBe('old');
	});

	it('is null when the source date is missing', () => {
		expect(dataAge('', '2026-06-15')).toBeNull();
	});
});

describe('isoDate', () => {
	it('returns a plain YYYY-MM-DD date', () => {
		expect(isoDate(new Date('2026-10-05T23:30:00Z'))).toBe('2026-10-05');
	});
});
