import { describe, expect, it } from "vitest";

import { parseHousePtrText, parseSenatePtrText } from "../../src/parsers/ptr-parser.js";
import type { CollectedSourceDocument } from "../../src/types/pipeline.js";

function createDocument(source: "house" | "senate"): CollectedSourceDocument {
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
		rawMetadata: {}
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

	it("skips duplicate transaction rows and reports a warning", () => {
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

		expect(result.status).toBe("partially_parsed");
		expect(result.transactions).toHaveLength(1);
		expect(result.warnings[0]).toContain("Duplicate transaction row skipped");
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
});

describe("parseSenatePtrText", () => {
	it("parses Senate-style filer text with an amended report marker", () => {
		const result = parseSenatePtrText({
			sourceDocument: createDocument("senate"),
			text: `
				Filer Name: Sample Senator
				State: IL
				Amendment
				S Microsoft Corporation P 01/05/2025 01/15/2025 Over $50,000,000
				Date Filed: 01/20/2025
			`
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
});
