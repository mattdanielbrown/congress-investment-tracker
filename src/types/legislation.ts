export type LegislativeDocumentType =
	| "bill"
	| "law"
	| "resolution"
	| "committee_report"
	| "hearing"
	| "federal_register_document"
	| "other";

export type LegislativeMatchType =
	| "direct_company_name"
	| "ticker_symbol"
	| "subsidiary_name"
	| "parent_company_name"
	| "brand_name"
	| "industry_term"
	| "agency_domain"
	| "other";

export interface LegislativeDocument {
	id?: number;
	sourceDocumentId?: number;
	externalId?: string;
	documentType: LegislativeDocumentType;
	title?: string;
	congressNumber?: number;
	introducedDate?: string;
	latestActionDate?: string;
	sponsorMemberId?: number;
	url?: string;
	textHash?: string;
	metadata?: Record<string, unknown>;
	createdAt?: Date;
}

export interface LegislativeCompanyMatch {
	id?: number;
	legislativeDocumentId: number;
	companyId?: number;
	securityId?: number;
	matchType: LegislativeMatchType;
	matchedText?: string;
	contextExcerpt?: string;
	relevanceScore?: number;
	confidence?: number;
	createdAt?: Date;
}
