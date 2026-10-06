import csv from '../../../../data/contracts.csv?raw';
import type { RequestHandler } from './$types';

export const prerender = true;

/** Served verbatim from the pipeline's output so the download matches the repo. */
export const GET: RequestHandler = () =>
	new Response(csv, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': 'attachment; filename="divest-contracts.csv"',
			'cache-control': 'public, max-age=3600'
		}
	});
