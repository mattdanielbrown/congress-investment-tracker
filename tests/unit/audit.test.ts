import { describe, expect, it } from "vitest";

import { summarizeParsedPtrBatch } from "../../src/pipeline/audit.js";
import type { ParsedPtrBatch } from "../../src/types/pipeline.js";

describe("summarizeParsedPtrBatch", () => {
	it("summarizes parse quality metrics in stable count order", () => {
		const batch: ParsedPtrBatch = {
			source: "house",
			year: 2025,
			parserVersion: "test-parser",
			results: [
				{
					sourceDocument: {
						source: "house",
						chamber: "house",
						year: 2025,
						url: "https://example.test/one.pdf",
						documentType: "periodic_transaction_report",
						sha256: "one",
						storagePath: "/tmp/one.pdf",
						retrievedAt: "2026-04-24T00:00:00.000Z",
						rawMetadata: {}
					},
					member: {
						fullName: "Example Member",
						chamber: "house",
						state: "CA"
					},
					reportType: "periodic_transaction_report",
					status: "parsed",
					filingDate: "2025-08-12",
					isAmendment: false,
					transactions: [
						{
							sourceTransactionIndex: 0,
							reportedOwnerCategory: "member",
							assetName: "Apple Inc. (AAPL)",
							normalizedAssetName: "Apple Inc. (AAPL)",
							transactionType: "purchase",
							transactionTypeLabel: "P",
							transactionDate: "2025-06-02",
							reportedValue: {
								label: "$1,001 - $15,000",
								min: 1001,
								max: 15000,
								currency: "USD",
								certainty: "reported_range"
							},
							confidence: 0.9
						}
					],
					warnings: [],
					extractionConfidence: 1,
					parserVersion: "test-parser"
				},
				{
					sourceDocument: {
						source: "house",
						chamber: "house",
						year: 2025,
						url: "https://example.test/two.pdf",
						documentType: "periodic_transaction_report",
						sha256: "two",
						storagePath: "/tmp/two.pdf",
						retrievedAt: "2026-04-24T00:00:00.000Z",
						rawMetadata: {}
					},
					reportType: "periodic_transaction_report",
					status: "needs_review",
					isAmendment: false,
					transactions: [],
					warnings: ["Extracted document text is empty; source document needs manual review."],
					extractionConfidence: 0.4,
					parserVersion: "test-parser"
				}
			]
		};

		expect(summarizeParsedPtrBatch(batch)).toMatchObject({
			source: "house",
			year: 2025,
			documentCount: 2,
			transactionCount: 1,
			warningDocumentCount: 1,
			warningCount: 1,
			missingMemberCount: 1,
			missingFilingDateCount: 1,
			statusCounts: [
				{ name: "needs_review", count: 1 },
				{ name: "parsed", count: 1 }
			],
			ownerCategoryCounts: [
				{ name: "member", count: 1 }
			],
			transactionTypeCounts: [
				{ name: "purchase", count: 1 }
			],
			topWarnings: [
				{
					name: "Extracted document text is empty; source document needs manual review.",
					count: 1
				}
			]
		});
	});
});
