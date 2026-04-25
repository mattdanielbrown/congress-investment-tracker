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
const transactionLinePattern = /^(?:(SP|DC|JT|Self|Member|Trust|TR|S|M)\s+)?(.+?)\s+(S\s*\(partial\)|Sale\s*\(partial\)|Partial Sale|Purchase|Sale|Exchange|PS|P|S|E)\s+(\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4}))\s+(\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4}))\s+(.+)$/iu;
const transactionAnchorPattern = /^(?:(SP|DC|JT|Self|Member|Trust|TR|S|M)\s+)?(.+?)\s+(S\s*\(partial\)|Sale\s*\(partial\)|Partial Sale|Purchase|Sale|Exchange|PS|P|S|E)\s+(\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4}))\s+(\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4}))\s+(.+?)\s*$/iu;
const moneyPattern = /\$[\d,]+(?:\.\d{1,2})?/gu;

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
	const member = parseMember(lines, options.sourceDocument);
	const filingDate = parseFilingDate(lines);
	const transactions = parseTransactions(lines, filingDate);
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

function parseMember(lines: string[], sourceDocument: CollectedSourceDocument): ParsedMember | undefined {
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

	if (!fullName && sourceDocument.source === "house") {
		const metadataMember = parseHouseIndexMember(sourceDocument);

		if (metadataMember) {
			return metadataMember;
		}
	}

	if (!fullName) {
		return undefined;
	}

	return {
		fullName,
		chamber: sourceDocument.chamber,
		state,
		...(district ? { district } : {})
	};
}

function parseHouseIndexMember(sourceDocument: CollectedSourceDocument): ParsedMember | undefined {
	const metadata = sourceDocument.rawMetadata;
	const firstName = getMetadataString(metadata, "filerFirstName");
	const lastName = getMetadataString(metadata, "filerLastName");

	if (!firstName || !lastName) {
		return undefined;
	}

	const suffix = getMetadataString(metadata, "filerSuffix");
	const stateDistrict = getMetadataString(metadata, "stateDistrict");
	const stateMatch = stateDistrict?.match(/^([A-Z]{2})([A-Z0-9-]+)?$/u);
	const state = stateMatch?.[1] ?? "NA";
	const district = parseDistrictValue(state, stateMatch?.[2]);

	return {
		fullName: normalizeWhitespace([firstName, lastName, suffix].filter(Boolean).join(" ")),
		chamber: sourceDocument.chamber,
		state,
		...(district ? { district } : {})
	};
}

function getMetadataString(metadata: Record<string, unknown>, key: string): string | undefined {
	const value = metadata[key];

	if (typeof value !== "string") {
		return undefined;
	}

	const normalized = normalizeWhitespace(value);

	return normalized || undefined;
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
	filingDate: string | undefined
): ParsedPtrTransaction[] {
	const transactions: ParsedPtrTransaction[] = [];

	for (let index = 0; index < lines.length; index += 1) {
		const parsed = parseTransactionLine(lines, index, filingDate);

		if (!parsed) {
			continue;
		}

		transactions.push(parsed);
	}

	return transactions;
}

function parseTransactionLine(
	lines: string[],
	index: number,
	filingDate: string | undefined
): ParsedPtrTransaction | undefined {
	const line = lines[index];

	if (!line) {
		return undefined;
	}

	const amountMatch = line.match(amountPattern);

	const structuredMatch = line.match(transactionLinePattern);

	if (amountMatch?.[0] && structuredMatch?.[2] && structuredMatch[3]) {
		return createParsedTransaction({
			ownerLabel: structuredMatch[1],
			assetName: buildWrappedAssetName(structuredMatch[2], lines.slice(index + 1)),
			transactionTypeLabel: structuredMatch[3],
			transactionDateLabel: structuredMatch[4],
			notificationDateLabel: structuredMatch[5],
			amountLabel: amountMatch[0],
			filingDate
		});
	}

	const anchoredMatch = line.match(transactionAnchorPattern);

	if (!anchoredMatch?.[2] || !anchoredMatch[3] || !anchoredMatch[4] || !anchoredMatch[5]) {
		return undefined;
	}

	const amountLabel = buildWrappedAmountLabel(anchoredMatch[6] ?? "", lines.slice(index + 1));

	if (!amountLabel) {
		return undefined;
	}

	const assetName = buildWrappedAssetName(anchoredMatch[2], lines.slice(index + 1));

	return createParsedTransaction({
		ownerLabel: anchoredMatch[1],
		assetName,
		transactionTypeLabel: anchoredMatch[3],
		transactionDateLabel: anchoredMatch[4],
		notificationDateLabel: anchoredMatch[5],
		amountLabel,
		filingDate
	});
}

function createParsedTransaction(input: {
	ownerLabel: string | undefined;
	assetName: string;
	transactionTypeLabel: string;
	transactionDateLabel: string | undefined;
	notificationDateLabel: string | undefined;
	amountLabel: string;
	filingDate: string | undefined;
}): ParsedPtrTransaction {
	const assetName = normalizeWhitespace(input.assetName);
	const transactionTypeLabel = normalizeWhitespace(input.transactionTypeLabel);
	const transactionDate = parseDisclosureDate(input.transactionDateLabel);
	const notificationDate = parseDisclosureDate(input.notificationDateLabel);
	const reportedValue = parseReportedValueRange(input.amountLabel);
	const estimatedValue = estimateReportedValue(reportedValue, "range_midpoint");

	return {
		reportedOwnerCategory: normalizeOwnerCategory(input.ownerLabel),
		...(input.ownerLabel ? { reportedOwnerLabel: input.ownerLabel } : {}),
		assetName,
		normalizedAssetName: normalizeAssetName(assetName),
		transactionType: normalizeTransactionType(transactionTypeLabel),
		transactionTypeLabel,
		...(transactionDate ? { transactionDate } : {}),
		...(notificationDate ? { notificationDate } : {}),
		...(input.filingDate ? { filingDate: input.filingDate } : {}),
		reportedValue,
		...(estimatedValue !== undefined ? {
			estimatedValue,
			estimationMethod: "range_midpoint"
		} : {}),
		confidence: transactionDate ? 0.9 : 0.75
	};
}

function buildWrappedAmountLabel(firstValueFragment: string, followingLines: string[]): string | undefined {
	const firstValue = normalizeWhitespace(firstValueFragment);
	const completeAmount = firstValue.match(amountPattern)?.[0];

	if (completeAmount) {
		return normalizeWhitespace(completeAmount);
	}

	const firstMoney = firstValue.match(/\$[\d,]+(?:\.\d{1,2})?\s*(?:-|–|—|to)?/u)?.[0];

	if (!firstMoney) {
		return undefined;
	}

	if (!/(?:-|–|—|to)\s*$/iu.test(firstMoney)) {
		return normalizeWhitespace(firstMoney);
	}

	for (const line of followingLines) {
		if (isTransactionContinuationBoundary(line)) {
			break;
		}

		const moneyMatches = [...line.matchAll(moneyPattern)];
		const lastMoney = moneyMatches.at(-1)?.[0];

		if (lastMoney) {
			return normalizeWhitespace(`${firstMoney} ${lastMoney}`);
		}
	}

	return normalizeWhitespace(firstMoney);
}

function buildWrappedAssetName(firstAssetFragment: string, followingLines: string[]): string {
	const assetParts = [firstAssetFragment];

	for (const line of followingLines) {
		if (isTransactionContinuationBoundary(line)) {
			break;
		}

		const assetContinuation = cleanAssetContinuation(line);

		if (assetContinuation) {
			assetParts.push(assetContinuation);
		}
	}

	return normalizeWhitespace(assetParts.join(" "));
}

function cleanAssetContinuation(line: string): string | undefined {
	const beforeAmount = line.split(/\$[\d,]+/u)[0] ?? "";
	const cleaned = normalizeWhitespace(beforeAmount)
		.replace(/\s*\[[A-Z]{2,}\]\s*$/u, "")
		.trim();

	if (!cleaned || /^\[[A-Z]{2,}\]$/u.test(cleaned)) {
		return undefined;
	}

	return cleaned;
}

function isTransactionContinuationBoundary(line: string): boolean {
	return transactionAnchorPattern.test(line)
		|| /^(F\s+S|S\s+O|L\s*:|I\s+P|C\s+S|I\s+V|Yes\b|No\b|Digitally Signed\b|\*)/iu.test(line);
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
