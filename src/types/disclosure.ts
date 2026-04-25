export type DisclosureReportType =
	| "periodic_transaction_report"
	| "annual_report"
	| "amendment"
	| "extension"
	| "unknown";

export type DisclosureStatus =
	| "new"
	| "parsed"
	| "partially_parsed"
	| "failed"
	| "needs_review";

export interface SourceDocument {
	id?: number;
	dataSourceId: number;
	url?: string;
	documentType: string;
	contentType?: string;
	sha256?: string;
	storagePath?: string;
	retrievedAt: Date;
	sourcePublishedAt?: Date;
	parserVersion?: string;
	rawMetadata?: Record<string, unknown>;
}

export interface DisclosureReport {
	id?: number;
	memberId?: number;
	sourceDocumentId: number;
	reportType: DisclosureReportType;
	filingDate?: string;
	periodStartDate?: string;
	periodEndDate?: string;
	amendmentOfReportId?: number;
	status: DisclosureStatus;
	extractionConfidence?: number;
	createdAt?: Date;
}
