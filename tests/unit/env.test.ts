import { describe, expect, it } from "vitest";

import { parseAppEnv } from "../../src/config/env.js";

describe("parseAppEnv", () => {
	it("applies defaults without requiring optional API keys or database URL", () => {
		expect(parseAppEnv({})).toMatchObject({
			NODE_ENV: "development",
			LOG_LEVEL: "info",
			MARKET_DATA_PROVIDER: "none",
			RAW_DATA_DIR: "./data/raw",
			PROCESSED_DATA_DIR: "./data/processed",
			REPORTS_DIR: "./data/reports"
		});
	});

	it("treats empty optional values as missing", () => {
		const parsed = parseAppEnv({
			DATABASE_URL: "",
			CONGRESS_GOV_API_KEY: "",
			GOVINFO_API_KEY: "",
			ALPHA_VANTAGE_API_KEY: "",
			POLYGON_API_KEY: ""
		});

		expect(parsed.DATABASE_URL).toBeUndefined();
		expect(parsed.CONGRESS_GOV_API_KEY).toBeUndefined();
		expect(parsed.GOVINFO_API_KEY).toBeUndefined();
		expect(parsed.ALPHA_VANTAGE_API_KEY).toBeUndefined();
		expect(parsed.POLYGON_API_KEY).toBeUndefined();
	});

	it("rejects invalid enum values", () => {
		expect(() => parseAppEnv({ LOG_LEVEL: "trace" })).toThrow();
		expect(() => parseAppEnv({ MARKET_DATA_PROVIDER: "unknown" })).toThrow();
	});
});
