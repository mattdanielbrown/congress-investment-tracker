import {
	normalizeAssetName,
	normalizeOwnerCategory,
	normalizeTransactionType,
	normalizeWhitespace,
	parseDisclosureDate
} from "../normalize/disclosures.js";
import { estimateReportedValue, parseReportedValueRange } from "../normalize/values.js";
import type {
	CollectedSourceDocument,
	ParsedMember,
	ParsedPtrTransaction,
	PtrParserResult
} from "../types/pipeline.js";

export const ptrParserVersion = "ptr-text-parser-v1";

interface PtrParserOptions {
	sourceDocument: CollectedSourceDocument;
	text: string;
}

const amountPattern = /\$[\d,]+(?:\.\d{1,2})?\s*(?:-|–|—|to)\s*\$?[\d,]+(?:\.\d{1,2})?|Over\s+\$[\d,]+(?:\.\d{1,2})?/iu;
const transactionLinePattern = /^(?:(SP|DC|JT|Self|Member|Trust|TR|S|M)\s+)?(.+?)\s+(P|S|E|PS|Purchase|Sale|Exchange|Partial Sale)\s+(\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4}))\s+(\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4}))\s+(.+)$/iu;

export function parseHousePtrText(options: PtrParserOptions): PtrParserResult {
	return parsePtrText(options);
}

export function parseSenatePtrText(options: PtrParserOptions): PtrParserResult {
	return parsePtrText(options);
}

function parsePtrText(options: PtrParserOptions): PtrParserResult {
	const lines = options.text
		.split(/\r?\n/u)
		.map(normalizeWhitespace)
		.filter(Boolean);
	const warnings: string[] = [];
	const member = parseMember(lines, options.sourceDocument.chamber);
	const filingDate = parseFilingDate(lines);
	const transactions = parseTransactions(lines, filingDate, warnings);
	const isAmendment = /\bamend(?:ment|ed)?\b/iu.test(options.text);

	if (!member) {
		warnings.push("Unable to parse member identity from document text.");
	}

	if (transactions.length === 0) {
		warnings.push("No PTR transactions were parsed from document text.");
	}

	const status = transactions.length === 0
		? "failed"
		: warnings.length > 0
			? "partially_parsed"
			: "parsed";

	return {
		sourceDocument: options.sourceDocument,
		...(member ? { member } : {}),
		reportType: "periodic_transaction_report",
		status,
		...(filingDate ? { filingDate } : {}),
		isAmendment,
		transactions,
		warnings,
		extractionConfidence: calculateConfidence(member, transactions, warnings),
		parserVersion: ptrParserVersion
	};
}

function parseMember(lines: string[], chamber: "house" | "senate"): ParsedMember | undefined {
	let fullName: string | undefined;
	let state = "NA";
	let district: string | undefined;

	for (const line of lines) {
		const nameMatch = line.match(/\b(?:name|filer name):\s*(?:hon\.\s*)?(.+?)(?:\s+\||$)/iu);

		if (nameMatch?.[1]) {
			fullName = cleanMemberName(nameMatch[1]);
		}

		const stateDistrictMatch = line.match(/\bState\/District:\s*([A-Z]{2})\s*([A-Z0-9-]+)?\b/iu);

		if (stateDistrictMatch?.[1]) {
			state = stateDistrictMatch[1].toUpperCase();
			district = parseDistrictValue(state, stateDistrictMatch[2]);
		}

		const separateStateMatch = line.match(/\bState:\s*([A-Z]{2})\b/iu);
		const separateDistrictMatch = line.match(/\bDistrict:\s*([A-Z0-9-]+)\b/iu);

		if (separateStateMatch?.[1]) {
			state = separateStateMatch[1].toUpperCase();
		}

		if (separateDistrictMatch?.[1]) {
			district = parseDistrictValue(state, separateDistrictMatch[1]);
		}
	}

	if (!fullName) {
		return undefined;
	}

	return {
		fullName,
		chamber,
		state,
		...(district ? { district } : {})
	};
}

function parseFilingDate(lines: string[]): string | undefined {
	for (const line of lines) {
		if (/digitally signed|date signed|filing date|date filed/iu.test(line)) {
			const date = parseDisclosureDate(line);

			if (date) {
				return date;
			}
		}
	}

	return undefined;
}

function parseTransactions(
	lines: string[],
	filingDate: string | undefined,
	warnings: string[]
): ParsedPtrTransaction[] {
	const transactions: ParsedPtrTransaction[] = [];
	const seenKeys = new Set<string>();

	for (const line of lines) {
		const parsed = parseTransactionLine(line, filingDate);

		if (!parsed) {
			continue;
		}

		const key = [
			parsed.reportedOwnerCategory,
			parsed.normalizedAssetName.toLowerCase(),
			parsed.transactionType,
			parsed.transactionDate ?? "",
			parsed.reportedValue.label ?? ""
		].join("|");

		if (seenKeys.has(key)) {
			warnings.push(`Duplicate transaction row skipped: ${parsed.assetName}`);
			continue;
		}

		seenKeys.add(key);
		transactions.push(parsed);
	}

	return transactions;
}

function parseTransactionLine(
	line: string,
	filingDate: string | undefined
): ParsedPtrTransaction | undefined {
	const amountMatch = line.match(amountPattern);

	if (!amountMatch?.[0]) {
		return undefined;
	}

	const structuredMatch = line.match(transactionLinePattern);

	if (!structuredMatch?.[2] || !structuredMatch[3]) {
		return undefined;
	}

	const ownerLabel = structuredMatch[1];
	const assetName = normalizeWhitespace(structuredMatch[2]);
	const transactionTypeLabel = normalizeWhitespace(structuredMatch[3]);
	const transactionDate = parseDisclosureDate(structuredMatch[4]);
	const notificationDate = parseDisclosureDate(structuredMatch[5]);
	const reportedValue = parseReportedValueRange(amountMatch[0]);
	const estimatedValue = estimateReportedValue(reportedValue, "range_midpoint");

	return {
		reportedOwnerCategory: normalizeOwnerCategory(ownerLabel),
		...(ownerLabel ? { reportedOwnerLabel: ownerLabel } : {}),
		assetName,
		normalizedAssetName: normalizeAssetName(assetName),
		transactionType: normalizeTransactionType(transactionTypeLabel),
		transactionTypeLabel,
		...(transactionDate ? { transactionDate } : {}),
		...(notificationDate ? { notificationDate } : {}),
		...(filingDate ? { filingDate } : {}),
		reportedValue,
		...(estimatedValue !== undefined ? {
			estimatedValue,
			estimationMethod: "range_midpoint"
		} : {}),
		confidence: transactionDate ? 0.9 : 0.75
	};
}

function cleanMemberName(value: string): string {
	return normalizeWhitespace(value)
		.replace(/^hon\.\s*/iu, "")
		.replace(/\s*,?\s*(member of congress|u\.s\. senator|u\.s\. representative)$/iu, "");
}

function parseDistrictValue(state: string, value: string | undefined): string | undefined {
	if (!value) {
		return undefined;
	}

	if (value.toUpperCase().startsWith(state)) {
		return value.slice(state.length);
	}

	return value;
}

function calculateConfidence(
	member: ParsedMember | undefined,
	transactions: ParsedPtrTransaction[],
	warnings: string[]
): number {
	let confidence = 0.5;

	if (member) {
		confidence += 0.2;
	}

	if (transactions.length > 0) {
		confidence += 0.2;
	}

	if (warnings.length === 0) {
		confidence += 0.1;
	}

	return Math.min(confidence, 1);
}
