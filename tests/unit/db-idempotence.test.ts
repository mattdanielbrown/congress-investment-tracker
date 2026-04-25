import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function readProjectFile(path: string): string {
	return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("database idempotence guards", () => {
	it("defines database uniqueness for repeatable PTR loads", () => {
		const schema = readProjectFile("src/db/schema.sql");

		expect(schema).toContain("idx_source_documents_unique_sha256");
		expect(schema).toContain("idx_source_documents_unique_url");
		expect(schema).toContain("idx_disclosure_reports_unique_source_document");
		expect(schema).toContain("idx_assets_unique_normalized_name");
		expect(schema).toContain("idx_transactions_unique_report_source_index");
	});

	it("uses conflict-aware inserts for source-indexed PTR rows", () => {
		const loader = readProjectFile("src/db/load-ptr.ts");

		expect(loader).toContain("ON CONFLICT (source_document_id) DO UPDATE");
		expect(loader).toContain("ON CONFLICT (normalized_name) WHERE normalized_name IS NOT NULL DO UPDATE");
		expect(loader).toContain("ON CONFLICT (disclosure_report_id, source_transaction_index)");
		expect(loader).toContain("DO NOTHING");
	});
});
