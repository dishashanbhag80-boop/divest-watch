import { buildTimeTotals, categories, dataset } from '#lib/server/data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const { meta, contracts } = dataset();
	return {
		meta,
		rows: contracts,
		categories: categories(),
		companies: [...new Set(contracts.map((r) => r.company))].sort(),
		totals: buildTimeTotals()
	};
};
