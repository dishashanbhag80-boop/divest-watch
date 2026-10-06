/** Shapes of the JSON the Python pipeline writes into `data/`. */

export const LIVE_STATUSES = ['Active', 'Extension window', 'Upcoming', 'Pending'] as const;

export const ALL_STATUSES = [
	'Active',
	'Extension window',
	'Upcoming',
	'Pending',
	'Probably active',
	'No end date',
	'Probably ended',
	'Expired',
	'Terminated',
	'Cancelled',
	'Not awarded'
] as const;

export type Status = (typeof ALL_STATUSES)[number];

/** How confident the supplier-name match is. `check` needs a human look. */
export type Confidence = 'high' | 'name' | 'check';

export interface Meta {
	/** When the pipeline last ran, ISO 8601 with a Z suffix. */
	generated: string;
	/** Date of the most recent notice in the source export. */
	data_as_of: string;
	/** Filename of the source export. */
	source: string;
	/** Procurements scanned, not just matched ones. */
	procurements: number;
}

/** One row per (procurement, company) — a company's whole involvement in one tender. */
export interface Contract {
	company: string;
	company_country: string;
	confidence: Confidence;
	status: Status;
	buyer: string;
	title: string;
	type: 'Contract' | 'Framework / multi-supplier';
	suppliers_on_award: number;
	lots_won: number;
	value: number | null;
	value_basis: string;
	currency: string;
	start_date: string;
	end_date: string;
	/** Free text saying where `end_date` came from; drives the est./CF/approx. tags. */
	end_date_source: string;
	max_end_date: string;
	date_signed: string;
	last_updated: string;
	category: string;
	/** Supplier names as published, `; `-joined when a company matched several. */
	supplier_name: string;
	ocid: string;
	notice_url: string;
	record_url: string;
}

/** One row per (award or lot, contract, company) — what a Contract rolls up. */
export interface Award {
	company: string;
	company_country: string;
	confidence: Confidence;
	buyer: string;
	title: string;
	status: Status;
	award_status: string;
	contract_status: string;
	tender_status: string;
	value: number | null;
	value_basis: string;
	currency: string;
	framework: boolean;
	suppliers_on_award: number;
	category: string;
	award_date: string;
	date_signed: string;
	start_date: string;
	end_date: string;
	end_date_source: string;
	max_end_date: string;
	last_updated: string;
	ocid: string;
	award_id: string;
	contract_id: string;
	notice_url: string;
	supplier_name: string;
}

/** A company as listed in pipeline/shortlist.json. */
export interface ShortlistCompany {
	name: string;
	country?: string;
	aliases?: string[];
	broad?: string[];
	exclude?: string[];
	ch?: (string | number)[];
}

export interface Shortlist {
	_source: string;
	_how_matching_works: string;
	companies: ShortlistCompany[];
}

/** Per-company rollup built by the server loader. */
export interface CompanySummary {
	name: string;
	slug: string;
	country: string;
	/** Procurements in total, after the `check` filter the caller asked for. */
	total: number;
	live: number;
	/** Published value of live direct contracts only — frameworks are ceilings. */
	liveValue: number;
	buyers: number;
	/** Earliest start date seen, or '' when none published. */
	firstSeen: string;
	/** Latest notice date across the company's procurements. */
	lastUpdated: string;
	confidence: Confidence;
}
