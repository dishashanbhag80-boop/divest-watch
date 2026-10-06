import { dataset } from '#lib/server/data';
import type { PageServerLoad } from './$types';

/**
 * Turns the pipeline's `end_date_source` into something readable.
 *
 * The published-period sources say which record the period came from
 * (`contract`, `award`, `lot`, `tender`); for this tally they are one group.
 */
function evidenceLabel(source: string, endDate: string): string {
	if (!source) return endDate ? 'published contract period' : 'no period published';
	if (['contract', 'award', 'lot', 'tender'].includes(source)) return 'published contract period';
	if (source.startsWith('Contracts Finder')) return 'matched Contracts Finder notice';
	if (source.startsWith('estimated')) return 'start date plus published duration';
	if (source.startsWith('notice text')) return 'duration found in the notice text';
	if (source.startsWith('framework legal maximum')) return 'framework legal maximum';
	if (source.startsWith('age')) return 'no period published, awarded 5+ years ago';
	return source;
}

export const load: PageServerLoad = () => {
	const { meta, shortlist, contracts, awards } = dataset();
	return {
		meta,
		shortlistSource: shortlist._source,
		matchingNote: shortlist._how_matching_works,
		counts: {
			shortlisted: shortlist.companies.length,
			matched: new Set(contracts.map((r) => r.company)).size,
			procurements: new Set(contracts.map((r) => r.ocid)).size,
			awards: awards.length,
			needingCheck: contracts.filter((r) => r.confidence === 'check').length
		},
		/** How many rows rest on each kind of end-date evidence. */
		evidence: contracts.reduce<Record<string, number>>((acc, r) => {
			const key = evidenceLabel(r.end_date_source, r.end_date);
			acc[key] = (acc[key] ?? 0) + 1;
			return acc;
		}, {})
	};
};
