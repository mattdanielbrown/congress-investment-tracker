import type { ChamberCode } from "./member.js";
import type { OwnerCategory, ReportedValueRange, TransactionType } from "./transaction.js";

export type DisclosureSource = "house" | "senate";

export interface DataSourceDefinition {
	source: DisclosureSource;
	name: string;
	baseUrl: string;
	sourceType: "official_disclosure_repository";
	isOfficialGovernment: boolean;
	notes: string;
}

export interface CollectedSourceDocument {
	source: DisclosureSource;
	chamber: ChamberCode;
	year: number;
	url: string;
	documentType: "periodic_transaction_report";
	contentType?: string;
	sha256: string;
	storagePath: string;
	retrievedAt: string;
	sourcePublishedAt?: string;
	rawMetadata: Record<string, unknown>;
}

export interface ParsedMember {
	fullName: string;
	chamber: ChamberCode;
	state: string;
	district?: string;
	party?: string;
	officialId?: string;
	bioguideId?: string;
	officialProfileUrl?: string;
}

export interface ParsedPtrTransaction {
	sourceTransactionIndex?: number;
	reportedOwnerCategory: OwnerCategory;
	reportedOwnerLabel?: string;
	assetName: string;
	normalizedAssetName: string;
	transactionType: TransactionType;
	transactionTypeLabel: string;
	transactionDate?: string;
	notificationDate?: string;
	filingDate?: string;
	reportedValue: ReportedValueRange;
	estimatedValue?: number;
	estimationMethod?: string;
	notes?: string;
	confidence: number;
}

export interface PtrParserResult {
	sourceDocument: CollectedSourceDocument;
	member?: ParsedMember;
	reportType: "periodic_transaction_report";
	status: "parsed" | "partially_parsed" | "failed" | "needs_review";
	filingDate?: string;
	isAmendment: boolean;
	transactions: ParsedPtrTransaction[];
	warnings: string[];
	extractionConfidence: number;
	parserVersion: string;
}

export interface ParsedPtrBatch {
	source: DisclosureSource;
	year: number;
	parserVersion: string;
	results: PtrParserResult[];
}

export interface LoadSummary {
	sourceDocuments: number;
	members: number;
	reports: number;
	assets: number;
	transactions: number;
	warnings: number;
}
