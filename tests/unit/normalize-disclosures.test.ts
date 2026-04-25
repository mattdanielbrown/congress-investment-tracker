import { describe, expect, it } from "vitest";

import {
	normalizeOwnerCategory,
	normalizeTransactionType,
	parseDisclosureDate
} from "../../src/normalize/disclosures.js";

describe("normalizeOwnerCategory", () => {
	it("normalizes common House and Senate owner labels", () => {
		expect(normalizeOwnerCategory("SP")).toBe("spouse");
		expect(normalizeOwnerCategory("DC")).toBe("dependent_child");
		expect(normalizeOwnerCategory("JT")).toBe("joint");
		expect(normalizeOwnerCategory("Self")).toBe("member");
		expect(normalizeOwnerCategory("Trust")).toBe("trust");
	});

	it("keeps missing owner labels explicit", () => {
		expect(normalizeOwnerCategory(undefined)).toBe("unknown");
		expect(normalizeOwnerCategory("managed account")).toBe("other");
	});
});

describe("normalizeTransactionType", () => {
	it("normalizes abbreviated and spelled-out transaction types", () => {
		expect(normalizeTransactionType("P")).toBe("purchase");
		expect(normalizeTransactionType("S")).toBe("sale");
		expect(normalizeTransactionType("E")).toBe("exchange");
		expect(normalizeTransactionType("Partial Sale")).toBe("partial_sale");
		expect(normalizeTransactionType("Purchase")).toBe("purchase");
	});
});

describe("parseDisclosureDate", () => {
	it("parses two-digit and four-digit disclosure dates", () => {
		expect(parseDisclosureDate("03/07/15")).toBe("2015-03-07");
		expect(parseDisclosureDate("03/07/2015")).toBe("2015-03-07");
		expect(parseDisclosureDate("2025-10-23")).toBe("2025-10-23");
	});

	it("rejects invalid dates without throwing", () => {
		expect(parseDisclosureDate("02/31/2025")).toBeUndefined();
		expect(parseDisclosureDate("not a date")).toBeUndefined();
	});
});
