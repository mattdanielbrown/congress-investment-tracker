import { readParsedPtrBatch } from "./parse.js";
import type { DisclosureSource, ParsedPtrBatch } from "../types/pipeline.js";

interface CountRecord {
	name: string;
	count: number;
}

interface ParseAuditSummary {
	source: DisclosureSource;
	year: number;
	parserVersion: string;
	documentCount: number;
	statusCounts: CountRecord[];
	transactionCount: number;
	warningDocumentCount: number;
	warningCount: number;
	missingMemberCount: number;
	missingFilingDateCount: number;
	ownerCategoryCounts: CountRecord[];
	transactionTypeCounts: CountRecord[];
	topWarnings: CountRecord[];
}

export async function auditParsedPtrBatch(input: {
	source: DisclosureSource;
	year: number;
}): Promise<ParseAuditSummary> {
	const batch = await readParsedPtrBatch(input);

	return summarizeParsedPtrBatch(batch);
}

export function summarizeParsedPtrBatch(batch: ParsedPtrBatch): ParseAuditSummary {
	const statusCounts = new Map<string, number>();
	const ownerCategoryCounts = new Map<string, number>();
	const transactionTypeCounts = new Map<string, number>();
	const warningCounts = new Map<string, number>();
	let transactionCount = 0;
	let warningDocumentCount = 0;
	let warningCount = 0;
	let missingMemberCount = 0;
	let missingFilingDateCount = 0;

	for (const result of batch.results) {
		increment(statusCounts, result.status);

		if (!result.member) {
			missingMemberCount += 1;
		}

		if (!result.filingDate) {
			missingFilingDateCount += 1;
		}

		if (result.warnings.length > 0) {
			warningDocumentCount += 1;
			warningCount += result.warnings.length;
		}

		for (const warning of result.warnings) {
			increment(warningCounts, warning);
		}

		for (const transaction of result.transactions) {
			transactionCount += 1;
			increment(ownerCategoryCounts, transaction.reportedOwnerCategory);
			increment(transactionTypeCounts, transaction.transactionType);
		}
	}

	return {
		source: batch.source,
		year: batch.year,
		parserVersion: batch.parserVersion,
		documentCount: batch.results.length,
		statusCounts: toCountRecords(statusCounts),
		transactionCount,
		warningDocumentCount,
		warningCount,
		missingMemberCount,
		missingFilingDateCount,
		ownerCategoryCounts: toCountRecords(ownerCategoryCounts),
		transactionTypeCounts: toCountRecords(transactionTypeCounts),
		topWarnings: toCountRecords(warningCounts).slice(0, 10)
	};
}

function increment(counts: Map<string, number>, name: string): void {
	counts.set(name, (counts.get(name) ?? 0) + 1);
}

function toCountRecords(counts: Map<string, number>): CountRecord[] {
	return [...counts.entries()]
		.map(([name, count]) => ({ name, count }))
		.sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}
