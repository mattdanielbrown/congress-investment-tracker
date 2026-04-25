export type SecurityType =
	| "common_stock"
	| "preferred_stock"
	| "etf"
	| "mutual_fund"
	| "bond"
	| "option"
	| "private_company"
	| "unknown";

export interface Company {
	id?: number;
	legalName: string;
	commonName?: string;
	cik?: string;
	lei?: string;
	sicCode?: string;
	naicsCode?: string;
	country?: string;
	websiteUrl?: string;
	createdAt?: Date;
	updatedAt?: Date;
}

export interface Security {
	id?: number;
	companyId?: number;
	ticker?: string;
	exchange?: string;
	securityType: SecurityType;
	currency: string;
	figi?: string;
	isin?: string;
	cusip?: string;
	isActive: boolean;
	createdAt?: Date;
}

export interface Asset {
	id?: number;
	reportedName: string;
	normalizedName?: string;
	assetType?: string;
	companyId?: number;
	securityId?: number;
	confidence?: number;
	createdAt?: Date;
}
