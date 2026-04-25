import { readParsedPtrBatch } from "./parse.js";
import type { DisclosureSource, ParsedPtrBatch, PtrParserResult } from "../types/pipeline.js";

interface CountRecord {
	name: string;
	count: number;
}

interface ReviewDocumentRecord {
	sourceDocumentIndex: number;
	status: PtrParserResult["status"];
	url: string;
	storagePath: string;
	documentId?: string;
	memberName?: string;
	transactionCount: number;
	warnings: string[];
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
	missingTransactionDateCount: number;
	missingNotificationDateCount: number;
	unparsedValueCount: number;
	lowConfidenceTransactionCount: number;
	ownerCategoryCounts: CountRecord[];
	transactionTypeCounts: CountRecord[];
	topWarnings: CountRecord[];
	reviewDocuments: ReviewDocumentRecord[];
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
	let missingTransactionDateCount = 0;
	let missingNotificationDateCount = 0;
	let unparsedValueCount = 0;
	let lowConfidenceTransactionCount = 0;
	const reviewDocuments: ReviewDocumentRecord[] = [];

	for (const [sourceDocumentIndex, result] of batch.results.entries()) {
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

			if (!transaction.transactionDate) {
				missingTransactionDateCount += 1;
			}

			if (!transaction.notificationDate) {
				missingNotificationDateCount += 1;
			}

			if (transaction.reportedValue.certainty === "unverifiable") {
				unparsedValueCount += 1;
			}

			if (transaction.confidence < 0.9) {
				lowConfidenceTransactionCount += 1;
			}
		}

		if (shouldReviewDocument(result)) {
			reviewDocuments.push({
				sourceDocumentIndex,
				status: result.status,
				url: result.sourceDocument.url,
				storagePath: result.sourceDocument.storagePath,
				...getAuditDocumentId(result.sourceDocument.rawMetadata),
				...(result.member ? { memberName: result.member.fullName } : {}),
				transactionCount: result.transactions.length,
				warnings: result.warnings
			});
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
		missingTransactionDateCount,
		missingNotificationDateCount,
		unparsedValueCount,
		lowConfidenceTransactionCount,
		ownerCategoryCounts: toCountRecords(ownerCategoryCounts),
		transactionTypeCounts: toCountRecords(transactionTypeCounts),
		topWarnings: toCountRecords(warningCounts).slice(0, 10),
		reviewDocuments
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

function shouldReviewDocument(result: PtrParserResult): boolean {
	return result.status !== "parsed" || result.warnings.length > 0;
}

function getAuditDocumentId(metadata: Record<string, unknown>): { documentId?: string } {
	const documentId = metadata.documentId;

	if (typeof documentId !== "string" || documentId.trim().length === 0) {
		return {};
	}

	return { documentId: documentId.trim() };
}
