import { describe, expect, it } from "vitest";

import { migrateAndSeed, withDatabaseClient } from "../../src/db/client.js";
import { loadParsedPtrBatch } from "../../src/db/load-ptr.js";
import type { ParsedPtrBatch } from "../../src/types/pipeline.js";

const describeIfDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDatabase("database PTR loading", () => {
	it("migrates the schema and loads parser results idempotently", async () => {
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
						url: "https://example.test/test-house-ptr.pdf",
						documentType: "periodic_transaction_report",
						contentType: "application/pdf",
						sha256: "test-house-ptr-hash",
						storagePath: "/tmp/test-house-ptr.pdf",
						retrievedAt: "2026-04-24T00:00:00.000Z",
						rawMetadata: {
							test: true
						}
					},
					member: {
						fullName: "Database Test Member",
						chamber: "house",
						state: "CA",
						district: "17"
					},
					reportType: "periodic_transaction_report",
					status: "parsed",
					filingDate: "2025-08-12",
					isAmendment: false,
					transactions: [
						{
							reportedOwnerCategory: "member",
							assetName: "Apple Inc. (AAPL)",
							normalizedAssetName: "Apple Inc. (AAPL)",
							transactionType: "purchase",
							transactionTypeLabel: "P",
							transactionDate: "2025-06-02",
							filingDate: "2025-08-12",
							reportedValue: {
								label: "$1,001 - $15,000",
								min: 1001,
								max: 15000,
								currency: "USD",
								certainty: "reported_range"
							},
							estimatedValue: 8000.5,
							estimationMethod: "range_midpoint",
							confidence: 0.9
						}
					],
					warnings: [],
					extractionConfidence: 1,
					parserVersion: "test-parser"
				}
			]
		};

		await withDatabaseClient(async (client) => {
			await migrateAndSeed(client);

			const first = await loadParsedPtrBatch(client, batch);
			const second = await loadParsedPtrBatch(client, batch);

			expect(first.transactions).toBe(1);
			expect(second.transactions).toBe(0);

			const lineage = await client.query<{ source_document_id: string }>(
				`SELECT source_document_id
					FROM disclosure_reports
					WHERE filing_date = $1
					ORDER BY id DESC
					LIMIT 1`,
				["2025-08-12"]
			);

			expect(lineage.rows[0]?.source_document_id).toBeTruthy();
		});
	});
});
