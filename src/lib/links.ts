/** Where the source notices live. Kept apart from the server loader so both
 *  sides of the app can build the same links. */
export const NOTICE_URL_BASE = 'https://www.find-tender.service.gov.uk/Notice/';
export const RECORD_URL_BASE = 'https://www.find-tender.service.gov.uk/api/1.0/ocdsRecordPackages/';

export const recordUrl = (ocid: string): string => RECORD_URL_BASE + ocid;

export const SOURCES = {
	shortlist: 'https://investigate.info/divest',
	registry: 'https://data.open-contracting.org',
	fts: 'https://data.open-contracting.org/en/publication/41',
	contractsFinder: 'https://data.open-contracting.org/en/publication/128',
	ogl: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/'
} as const;
