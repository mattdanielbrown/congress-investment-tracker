import { describe, expect, it } from "vitest";

import {
	formatIsoDate,
	getNearestPriorWeekday,
	getPreviousUtcDate,
	isWeekend,
	parseIsoDate
} from "../../src/utils/date.js";

describe("date utilities", () => {
	it("parses and formats ISO dates in UTC", () => {
		const date = parseIsoDate("2026-04-24");

		expect(date.toISOString()).toBe("2026-04-24T00:00:00.000Z");
		expect(formatIsoDate(date)).toBe("2026-04-24");
	});

	it("rejects invalid dates", () => {
		expect(() => parseIsoDate("not-a-date")).toThrow("Invalid ISO date");
	});

	it("detects weekends using UTC day", () => {
		expect(isWeekend(parseIsoDate("2026-04-25"))).toBe(true);
		expect(isWeekend(parseIsoDate("2026-04-26"))).toBe(true);
		expect(isWeekend(parseIsoDate("2026-04-27"))).toBe(false);
	});

	it("returns previous UTC calendar date without mutating the input", () => {
		const input = parseIsoDate("2026-04-24");
		const previous = getPreviousUtcDate(input);

		expect(formatIsoDate(previous)).toBe("2026-04-23");
		expect(formatIsoDate(input)).toBe("2026-04-24");
	});

	it("returns nearest prior weekday for weekend dates", () => {
		expect(formatIsoDate(getNearestPriorWeekday(parseIsoDate("2026-04-25")))).toBe("2026-04-24");
		expect(formatIsoDate(getNearestPriorWeekday(parseIsoDate("2026-04-26")))).toBe("2026-04-24");
		expect(formatIsoDate(getNearestPriorWeekday(parseIsoDate("2026-04-27")))).toBe("2026-04-27");
	});
});
