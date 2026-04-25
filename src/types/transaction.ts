export type TransactionType =
	| "purchase"
	| "sale"
	| "exchange"
	| "partial_sale"
	| "other"
	| "unknown";

export type OwnerCategory =
	| "member"
	| "spouse"
	| "dependent_child"
	| "joint"
	| "trust"
	| "other"
	| "unknown";

export type ValueCertainty =
	| "confirmed_disclosed"
	| "reported_range"
	| "estimated"
	| "inferred"
	| "unavailable"
	| "unverifiable";

export interface ReportedValueRange {
	label?: string;
	min?: number;
	max?: number;
	currency: string;
	certainty: ValueCertainty;
}

export interface Transaction {
	id?: number;
	disclosureReportId: number;
	memberId?: number;
	assetId?: number;
	securityId?: number;
	reportedOwnerCategory?: OwnerCategory;
	transactionType: TransactionType;
	transactionDate?: string;
	filingDate?: string;
	reportedValue: ReportedValueRange;
	estimatedValue?: number;
	estimationMethod?: string;
	shareCount?: number;
	shareCountSource?: string;
	priceOnTransactionDate?: number;
	currency: string;
	confidence?: number;
	notes?: string;
	createdAt?: Date;
}
