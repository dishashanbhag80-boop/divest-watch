import { error } from '@sveltejs/kit';
import { buyerGroups, contractsForBuyer, dataset } from '#lib/server/data';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => [...buyerGroups().keys()].map((slug) => ({ slug }));

export const load: PageServerLoad = ({ params }) => {
	const group = buyerGroups().get(params.slug);
	if (!group) error(404, 'No public buyer on record under that name.');

	return {
		meta: dataset().meta,
		buyer: { slug: group.slug, name: group.name, variants: group.variants },
		rows: contractsForBuyer(params.slug)
	};
};
