import type { OwnerCategory, TransactionType } from "../types/transaction.js";

const twoDigitYearPivot = 70;

export function normalizeWhitespace(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

export function normalizeAssetName(value: string): string {
	return normalizeWhitespace(value)
		.replace(/\s+\[[^\]]+\]$/u, "")
		.replace(/\s+-\s+Common Stock$/iu, "")
		.trim();
}

export function normalizeOwnerCategory(label: string | null | undefined): OwnerCategory {
	const normalized = normalizeWhitespace(label ?? "").toLowerCase();

	if (!normalized) {
		return "unknown";
	}

	if (["sp", "s", "spouse"].includes(normalized)) {
		return "spouse";
	}

	if (["dc", "dependent child", "dependent_child", "child"].includes(normalized)) {
		return "dependent_child";
	}

	if (["jt", "joint"].includes(normalized)) {
		return "joint";
	}

	if (["trust", "tr"].includes(normalized)) {
		return "trust";
	}

	if (["self", "member", "m", "filer"].includes(normalized)) {
		return "member";
	}

	return "other";
}

export function normalizeTransactionType(label: string | null | undefined): TransactionType {
	const normalized = normalizeWhitespace(label ?? "").toLowerCase();

	if (!normalized) {
		return "unknown";
	}

	if (["p", "purchase", "buy", "bought"].includes(normalized)) {
		return "purchase";
	}

	if (["e", "exchange"].includes(normalized)) {
		return "exchange";
	}

	if (
		["ps", "partial sale", "partial_sale", "s (partial)", "sale (partial)"].includes(normalized)
		|| /^s\s*\(\s*partial\s*\)$/u.test(normalized)
	) {
		return "partial_sale";
	}

	if (["s", "sale", "sell", "sold"].includes(normalized)) {
		return "sale";
	}

	return "other";
}

export function parseDisclosureDate(value: string | null | undefined): string | undefined {
	const normalized = normalizeWhitespace(value ?? "");

	if (!normalized) {
		return undefined;
	}

	const slashMatch = normalized.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b/u);

	if (slashMatch?.[1] && slashMatch[2] && slashMatch[3]) {
		const month = Number(slashMatch[1]);
		const day = Number(slashMatch[2]);
		const year = normalizeYear(Number(slashMatch[3]));

		return formatDateParts(year, month, day);
	}

	const isoMatch = normalized.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/u);

	if (isoMatch?.[1] && isoMatch[2] && isoMatch[3]) {
		return formatDateParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
	}

	return undefined;
}

function normalizeYear(year: number): number {
	if (year >= 100) {
		return year;
	}

	return year >= twoDigitYearPivot ? 1900 + year : 2000 + year;
}

function formatDateParts(year: number, month: number, day: number): string | undefined {
	if (month < 1 || month > 12 || day < 1 || day > 31) {
		return undefined;
	}

	const date = new Date(Date.UTC(year, month - 1, day));

	if (
		date.getUTCFullYear() !== year
		|| date.getUTCMonth() !== month - 1
		|| date.getUTCDate() !== day
	) {
		return undefined;
	}

	return date.toISOString().slice(0, 10);
}
