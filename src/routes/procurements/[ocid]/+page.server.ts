import { error } from '@sveltejs/kit';
import { dataset } from '#lib/server/data';
import { slugify } from '#lib/format';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => [...dataset().byOcid.keys()].map((ocid) => ({ ocid }));

export const load: PageServerLoad = ({ params }) => {
	const { meta, byOcid, awardsByOcid } = dataset();
	const rows = byOcid.get(params.ocid);
	if (!rows?.length) error(404, 'No procurement with that OCID is in this dataset.');

	const first = rows[0];
	return {
		meta,
		ocid: params.ocid,
		procurement: {
			buyer: first.buyer,
			buyerSlug: slugify(first.buyer),
			title: first.title,
			category: first.category,
			type: first.type,
			suppliers_on_award: first.suppliers_on_award,
			notice_url: first.notice_url,
			last_updated:
				rows
					.map((r) => r.last_updated)
					.filter(Boolean)
					.sort()
					.at(-1) ?? ''
		},
		rows,
		awards: awardsByOcid.get(params.ocid) ?? []
	};
};
