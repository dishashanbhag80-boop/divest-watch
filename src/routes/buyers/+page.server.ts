import { buyerGroups, dataset } from '#lib/server/data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const { meta, contracts } = dataset();
	const groups = buyerGroups();
	const bySlug = new Map<string, (typeof contracts)[number][]>();
	for (const row of contracts) {
		for (const [slug, group] of groups) {
			if (group.variants.includes(row.buyer)) {
				(bySlug.get(slug) ?? bySlug.set(slug, []).get(slug)!).push(row);
				break;
			}
		}
	}

	return {
		meta,
		buyers: [...groups.values()].map((group) => {
			const rows = bySlug.get(group.slug) ?? [];
			return {
				slug: group.slug,
				name: group.name,
				variants: group.variants.length,
				procurements: group.ocids.size,
				companies: [...new Set(rows.map((r) => r.company))].sort(),
				// recomputed client-side against today's date
				statuses: rows.map((r) => ({
					status: r.status,
					type: r.type,
					value: r.value,
					confidence: r.confidence,
					start_date: r.start_date,
					end_date: r.end_date,
					max_end_date: r.max_end_date,
					end_date_source: r.end_date_source
				}))
			};
		})
	};
};
