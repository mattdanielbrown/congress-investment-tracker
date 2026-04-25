import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseHousePtrText, parseSenatePtrText } from "../../src/parsers/ptr-parser.js";
import type { CollectedSourceDocument } from "../../src/types/pipeline.js";

function readPtrFixture(name: string): string {
	return readFileSync(new URL(`../fixtures/ptr/${name}`, import.meta.url), "utf8");
}

function createDocument(
	source: "house" | "senate",
	rawMetadata: Record<string, unknown> = {}
): CollectedSourceDocument {
	return {
		source,
		chamber: source,
		year: 2025,
		url: `https://example.test/${source}.pdf`,
		documentType: "periodic_transaction_report",
		contentType: "application/pdf",
		sha256: `${source}-hash`,
		storagePath: `/tmp/${source}.txt`,
		retrievedAt: "2026-04-24T00:00:00.000Z",
		rawMetadata
	};
}

describe("parseHousePtrText", () => {
	it("parses member details and multiple transaction rows", () => {
		const result = parseHousePtrText({
			sourceDocument: createDocument("house"),
			text: `
				NAME: Hon. Example Member
				State/District: CA17
				SP Apple Inc. (AAPL) P 06/02/2025 08/11/2025 $1,001 - $15,000
				DC Tesla, Inc. - Common Stock S 06/26/2025 08/11/2025 $15,001-$50,000
				Digitally Signed: Hon. Example Member, 08/12/2025
			`
		});

		expect(result.status).toBe("parsed");
		expect(result.member).toMatchObject({
			fullName: "Example Member",
			chamber: "house",
			state: "CA",
			district: "17"
		});
		expect(result.filingDate).toBe("2025-08-12");
		expect(result.transactions).toHaveLength(2);
		expect(result.transactions[0]).toMatchObject({
			reportedOwnerCategory: "spouse",
			normalizedAssetName: "Apple Inc. (AAPL)",
			transactionType: "purchase",
			transactionDate: "2025-06-02"
		});
		expect(result.transactions[1]?.normalizedAssetName).toBe("Tesla, Inc.");
	});

	it("marks missing transaction text as failed with warnings", () => {
		const result = parseHousePtrText({
			sourceDocument: createDocument("house"),
			text: "NAME: Hon. Empty Report State/District: TX01"
		});

		expect(result.status).toBe("failed");
		expect(result.warnings).toContain("No PTR transactions were parsed from document text.");
	});

	it("falls back to House index metadata and marks empty extracted text for review", () => {
		const result = parseHousePtrText({
			sourceDocument: createDocument("house", {
				filerFirstName: "Gus M.",
				filerLastName: "Bilirakis",
				stateDistrict: "FL12"
			}),
			text: "\f\f"
		});

		expect(result.status).toBe("needs_review");
		expect(result.member).toMatchObject({
			fullName: "Gus M. Bilirakis",
			chamber: "house",
			state: "FL",
			district: "12"
		});
		expect(result.warnings).not.toContain("Unable to parse member identity from document text.");
		expect(result.warnings).toContain("Extracted document text is empty; source document needs manual review.");
		expect(result.warnings).toContain("No PTR transactions were parsed from document text.");
	});

	it("defaults omitted owner labels to the member", () => {
		const result = parseHousePtrText({
			sourceDocument: createDocument("house"),
			text: `
				NAME: Hon. Example Member
				State/District: CA17
				Apple Inc. (AAPL) P 06/02/2025 08/11/2025 $1,001 - $15,000
			`
		});

		expect(result.status).toBe("parsed");
		expect(result.transactions[0]).toMatchObject({
			reportedOwnerCategory: "member",
			assetName: "Apple Inc. (AAPL)"
		});
		expect(result.transactions[0]?.reportedOwnerLabel).toBeUndefined();
	});

	it("continues to preserve explicit owner labels", () => {
		const result = parseHousePtrText({
			sourceDocument: createDocument("house"),
			text: `
				NAME: Hon. Example Member
				State/District: CA17
				SP Apple Inc. (AAPL) P 06/02/2025 08/11/2025 $1,001 - $15,000
				DC Tesla, Inc. - Common Stock S 06/26/2025 08/11/2025 $15,001-$50,000
				JT Microsoft Corporation P 07/01/2025 08/11/2025 $1,001 - $15,000
			`
		});

		expect(result.transactions.map((transaction) => transaction.reportedOwnerCategory)).toEqual([
			"spouse",
			"dependent_child",
			"joint"
		]);
		expect(result.transactions.map((transaction) => transaction.reportedOwnerLabel)).toEqual([
			"SP",
			"DC",
			"JT"
		]);
	});

	it("preserves repeated transaction rows from the source document", () => {
		const text = `
			NAME: Hon. Duplicate Member
			State/District: NY12
			SP Apple Inc. (AAPL) P 06/02/2025 08/11/2025 $1,001 - $15,000
			SP Apple Inc. (AAPL) P 06/02/2025 08/11/2025 $1,001 - $15,000
		`;
		const result = parseHousePtrText({
			sourceDocument: createDocument("house"),
			text
		});

		expect(result.status).toBe("parsed");
		expect(result.transactions).toHaveLength(2);
		expect(result.transactions.map((transaction) => transaction.sourceTransactionIndex)).toEqual([0, 1]);
		expect(result.warnings).toHaveLength(0);
	});

	it("parses House PDF rows with wrapped asset and amount columns", () => {
		const result = parseHousePtrText({
			sourceDocument: createDocument("house"),
			text: `
				Filing ID #20026537
				Name: Hon. Richard W. Allen
				Status: Member
				State/District: GA12

				SP Rollins, Inc. Common Stock (ROL) P 12/12/2024 01/08/2025 $15,001 -
				[ST] $50,000
				F S : New

				SP US TREASU NOTE 4.375% DUE P 12/03/2024 01/08/2025 $100,001 -
				12/15/26 (91282CJP7) [GS] $250,000
				F S : New

				Digitally Signed: Hon. Richard W. Allen , 01/16/2025
			`
		});

		expect(result.status).toBe("parsed");
		expect(result.transactions).toHaveLength(2);
		expect(result.transactions[0]).toMatchObject({
			reportedOwnerCategory: "spouse",
			normalizedAssetName: "Rollins, Inc. Common Stock (ROL)",
			transactionType: "purchase",
			reportedValue: {
				min: 15001,
				max: 50000
			}
		});
		expect(result.transactions[1]).toMatchObject({
			normalizedAssetName: "US TREASU NOTE 4.375% DUE 12/15/26 (91282CJP7)",
			reportedValue: {
				min: 100001,
				max: 250000
			}
		});
	});

	it("parses House partial sale rows labeled S partial", () => {
		const result = parseHousePtrText({
			sourceDocument: createDocument("house"),
			text: `
				Filing ID #20030397
				Name: Hon. Jake Auchincloss
				Status: Member
				State/District: MA04

				SP State Street Corporation Common S (partial) 05/16/2025 05/20/2025 $15,001 -
				Stock (STT) [ST] $50,000
				F S : New
				D : RSU distribution

				Digitally Signed: Hon. Jake Auchincloss , 05/22/2025
			`
		});

		expect(result.status).toBe("parsed");
		expect(result.transactions).toHaveLength(1);
		expect(result.transactions[0]).toMatchObject({
			reportedOwnerCategory: "spouse",
			normalizedAssetName: "State Street Corporation Common Stock (STT)",
			transactionType: "partial_sale",
			transactionTypeLabel: "S (partial)",
			transactionDate: "2025-05-16",
			notificationDate: "2025-05-20",
			reportedValue: {
				min: 15001,
				max: 50000
			}
		});
	});

	it("skips repeated House table headers inside page-broken wrapped rows", () => {
		const result = parseHousePtrText({
			sourceDocument: createDocument("house"),
			text: readPtrFixture("house-page-break-header.txt")
		});

		expect(result.status).toBe("parsed");
		expect(result.transactions).toHaveLength(1);
		expect(result.transactions[0]).toMatchObject({
			reportedOwnerCategory: "joint",
			normalizedAssetName: "New Jersey ST Transn TR FD Auth SYS BDS 5.00% Due Jun 15, 2035",
			transactionType: "partial_sale",
			reportedValue: {
				min: 250001,
				max: 500000
			}
		});
	});

	it("skips collapsed House cap gains headers inside wrapped rows", () => {
		const result = parseHousePtrText({
			sourceDocument: createDocument("house"),
			text: `
				Filing ID #20029070
				Name: Hon. Suzan K. DelBene
				Status: Member
				State/District: WA01

				JT New Jersey ST Transn TR FD Auth S (partial) 03/19/2025 03/19/2025 $250,001 -
				Cap. Gains > $200?
				SYS BDS 5.00% Due Jun 15, 2035 $500,000
				[GS]
				F S : New

				Digitally Signed: Hon. Suzan K. DelBene , 04/10/2025
			`
		});

		expect(result.status).toBe("parsed");
		expect(result.transactions).toHaveLength(1);
		expect(result.transactions[0]).toMatchObject({
			reportedOwnerCategory: "joint",
			normalizedAssetName: "New Jersey ST Transn TR FD Auth SYS BDS 5.00% Due Jun 15, 2035",
			transactionType: "partial_sale",
			reportedValue: {
				min: 250001,
				max: 500000
			}
		});
	});
});

describe("parseSenatePtrText", () => {
	it("parses Senate-style filer text with an amended report marker", () => {
		const result = parseSenatePtrText({
			sourceDocument: createDocument("senate"),
			text: readPtrFixture("senate-amendment-over-range.txt")
		});

		expect(result.isAmendment).toBe(true);
		expect(result.member).toMatchObject({
			fullName: "Sample Senator",
			chamber: "senate",
			state: "IL"
		});
		expect(result.transactions[0]).toMatchObject({
			reportedOwnerCategory: "spouse",
			transactionType: "purchase",
			reportedValue: {
				min: 50000000,
				certainty: "reported_range"
			}
		});
	});

	it("marks Senate fixture text without transactions for review through audit warnings", () => {
		const result = parseSenatePtrText({
			sourceDocument: createDocument("senate"),
			text: readPtrFixture("senate-empty-review.txt")
		});

		expect(result.status).toBe("failed");
		expect(result.member).toMatchObject({
			fullName: "Review Senator",
			chamber: "senate",
			state: "NY"
		});
		expect(result.filingDate).toBe("2025-02-01");
		expect(result.transactions).toHaveLength(0);
		expect(result.warnings).toEqual(["No PTR transactions were parsed from document text."]);
	});
});
