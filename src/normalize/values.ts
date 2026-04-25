import type { ReportedValueRange } from "../types/transaction.js";

export type ValueEstimationMethod =
	| "range_midpoint"
	| "range_low"
	| "range_high"
	| "price_times_disclosed_shares"
	| "unknown";

const overPattern = /^over\s+\$?([\d,]+(?:\.\d{1,2})?)$/i;
const rangePattern = /^\$?([\d,]+(?:\.\d{1,2})?)\s*(?:-|–|—|to)\s*\$?([\d,]+(?:\.\d{1,2})?)$/i;

function parseMoney(value: string): number {
	return Number(value.replaceAll(",", ""));
}

function createRange(range: ReportedValueRange): ReportedValueRange {
	return range;
}

export function parseReportedValueRange(label: string | null | undefined): ReportedValueRange {
	const normalizedLabel = label?.trim();

	if (!normalizedLabel) {
		return createRange({
			currency: "USD",
			certainty: "unavailable"
		});
	}

	if (/^(none|n\/a|not applicable)$/i.test(normalizedLabel)) {
		return createRange({
			label: normalizedLabel,
			currency: "USD",
			certainty: "unavailable"
		});
	}

	const rangeMatch = normalizedLabel.match(rangePattern);

	if (rangeMatch?.[1] && rangeMatch[2]) {
		return createRange({
			label: normalizedLabel,
			min: parseMoney(rangeMatch[1]),
			max: parseMoney(rangeMatch[2]),
			currency: "USD",
			certainty: "reported_range"
		});
	}

	const overMatch = normalizedLabel.match(overPattern);

	if (overMatch?.[1]) {
		return createRange({
			label: normalizedLabel,
			min: parseMoney(overMatch[1]),
			currency: "USD",
			certainty: "reported_range"
		});
	}

	return createRange({
		label: normalizedLabel,
		currency: "USD",
		certainty: "unverifiable"
	});
}

export function estimateReportedValue(
	range: ReportedValueRange,
	method: ValueEstimationMethod
): number | undefined {
	if (method === "range_low") {
		return range.min;
	}

	if (method === "range_high") {
		return range.max;
	}

	if (method === "range_midpoint" && range.min !== undefined && range.max !== undefined) {
		return (range.min + range.max) / 2;
	}

	return undefined;
}
