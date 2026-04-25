import { describe, expect, it } from "vitest";

import { estimateReportedValue, parseReportedValueRange } from "../../src/normalize/values.js";

describe("parseReportedValueRange", () => {
	it("parses common disclosure value ranges", () => {
		expect(parseReportedValueRange("$1,001 - $15,000")).toEqual({
			label: "$1,001 - $15,000",
			min: 1001,
			max: 15000,
			currency: "USD",
			certainty: "reported_range"
		});
	});

	it("parses ranges using textual separators", () => {
		expect(parseReportedValueRange("$15,001 to $50,000")).toMatchObject({
			min: 15001,
			max: 50000,
			certainty: "reported_range"
		});
	});

	it("preserves over ranges without inventing a maximum", () => {
		expect(parseReportedValueRange("Over $50,000,000")).toEqual({
			label: "Over $50,000,000",
			min: 50000000,
			currency: "USD",
			certainty: "reported_range"
		});
	});

	it("treats none and missing values as unavailable", () => {
		expect(parseReportedValueRange("None")).toEqual({
			label: "None",
			currency: "USD",
			certainty: "unavailable"
		});
		expect(parseReportedValueRange(undefined)).toEqual({
			currency: "USD",
			certainty: "unavailable"
		});
	});

	it("preserves unknown labels as unverifiable", () => {
		expect(parseReportedValueRange("Value not legible")).toEqual({
			label: "Value not legible",
			currency: "USD",
			certainty: "unverifiable"
		});
	});
});

describe("estimateReportedValue", () => {
	const range = parseReportedValueRange("$1,001 - $15,000");

	it("supports low, high, and midpoint estimates for bounded ranges", () => {
		expect(estimateReportedValue(range, "range_low")).toBe(1001);
		expect(estimateReportedValue(range, "range_high")).toBe(15000);
		expect(estimateReportedValue(range, "range_midpoint")).toBe(8000.5);
	});

	it("does not invent midpoint estimates for unbounded ranges", () => {
		const overRange = parseReportedValueRange("Over $50,000,000");

		expect(estimateReportedValue(overRange, "range_midpoint")).toBeUndefined();
		expect(estimateReportedValue(overRange, "range_low")).toBe(50000000);
		expect(estimateReportedValue(overRange, "range_high")).toBeUndefined();
	});
});
