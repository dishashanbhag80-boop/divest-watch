import { dataset } from '#lib/server/data';
import { slugify } from '#lib/format';
import type { RequestHandler } from './$types';

export const prerender = true;

/** The shortlist, annotated with how much UK public work each company holds. */
export const GET: RequestHandler = () => {
	const { meta, shortlist, contracts } = dataset();
	const counts = new Map<string, number>();
	for (const row of contracts) counts.set(row.company, (counts.get(row.company) ?? 0) + 1);

	return Response.json(
		{
			meta,
			source: shortlist._source,
			companies: shortlist.companies.map((c) => ({
				name: c.name,
				slug: slugify(c.name),
				country: c.country ?? '',
				aliases: c.aliases ?? [],
				companies_house: (c.ch ?? []).map(String),
				procurements: counts.get(c.name) ?? 0,
				url: counts.has(c.name) ? `/companies/${slugify(c.name)}/` : null
			}))
		},
		{ headers: { 'cache-control': 'public, max-age=3600' } }
	);
};
