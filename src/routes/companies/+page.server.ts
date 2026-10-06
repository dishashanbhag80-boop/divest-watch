import { dataset } from '#lib/server/data';
import { slugify } from '#lib/format';
import type { CompanySummary } from '#lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const { meta, contracts, companies } = dataset();

	const byCompany = new Map<string, typeof contracts>();
	for (const row of contracts) {
		const bucket = byCompany.get(row.company);
		if (bucket) bucket.push(row);
		else byCompany.set(row.company, [row]);
	}

	// `live` and `liveValue` are left to the client, which knows today's date;
	// everything here is date-independent.
	const summaries: Omit<CompanySummary, 'live' | 'liveValue'>[] = [...byCompany].map(
		([name, rows]) => ({
			name,
			slug: slugify(name),
			country: companies.get(name)?.country ?? rows[0].company_country ?? '',
			total: rows.length,
			buyers: new Set(rows.map((r) => r.buyer)).size,
			firstSeen:
				rows
					.map((r) => r.start_date)
					.filter(Boolean)
					.sort()[0] ?? '',
			lastUpdated:
				rows
					.map((r) => r.last_updated)
					.filter(Boolean)
					.sort()
					.at(-1) ?? '',
			confidence: rows.every((r) => r.confidence === 'check') ? 'check' : 'name'
		})
	);

	return {
		meta,
		summaries: summaries.sort((a, b) => a.name.localeCompare(b.name)),
		/** Only the fields the per-company tallies need, to keep the payload small. */
		statuses: contracts.map((r) => ({
			company: r.company,
			confidence: r.confidence,
			status: r.status,
			type: r.type,
			value: r.value,
			start_date: r.start_date,
			end_date: r.end_date,
			max_end_date: r.max_end_date,
			end_date_source: r.end_date_source
		}))
	};
};
