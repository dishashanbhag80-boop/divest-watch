import { dataset } from '#lib/server/data';
import { recordUrl } from '#lib/links';
import type { RequestHandler } from './$types';

export const prerender = true;

/** The summary rows these pages are built from, one per procurement per company. */
export const GET: RequestHandler = () => {
	const { meta, contracts } = dataset();
	return Response.json(
		{
			meta: { ...meta, note: 'Statuses are as of the build date; recompute against today.' },
			rows: contracts.map((r) => ({ ...r, record_url: recordUrl(r.ocid) }))
		},
		{ headers: { 'cache-control': 'public, max-age=3600' } }
	);
};
