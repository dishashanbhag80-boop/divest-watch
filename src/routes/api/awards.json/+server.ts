import { dataset } from '#lib/server/data';
import type { RequestHandler } from './$types';

export const prerender = true;

/** Award- and lot-level detail: what the summary rows roll up. */
export const GET: RequestHandler = () => {
	const { meta, awards } = dataset();
	return Response.json(
		{ meta, rows: awards },
		{ headers: { 'cache-control': 'public, max-age=3600' } }
	);
};
