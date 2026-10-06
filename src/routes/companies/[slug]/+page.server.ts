import { error } from '@sveltejs/kit';
import { companySlugs, contractsForCompany, dataset } from '#lib/server/data';
import type { EntryGenerator, PageServerLoad } from './$types';

/** One page per company in the data, so every row has a permalink. */
export const entries: EntryGenerator = () => [...companySlugs().keys()].map((slug) => ({ slug }));

export const load: PageServerLoad = ({ params }) => {
	const name = companySlugs().get(params.slug);
	if (!name) error(404, 'No shortlisted company with that name holds a UK public contract.');

	const { meta, companies, awards } = dataset();
	const rows = contractsForCompany(name);
	const entry = companies.get(name);

	return {
		meta,
		company: {
			name,
			slug: params.slug,
			country: entry?.country ?? rows[0]?.company_country ?? '',
			aliases: entry?.aliases ?? [],
			broad: entry?.broad ?? [],
			companiesHouse: (entry?.ch ?? []).map(String)
		},
		rows,
		/** Published supplier names this company was matched through. */
		suppliers: [
			...new Set(
				awards
					.filter((a) => a.company === name)
					.flatMap((a) => a.supplier_name.split('; '))
					.map((s) => s.trim())
					.filter(Boolean)
			)
		].sort()
	};
};
