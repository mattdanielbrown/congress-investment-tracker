import type { DataSourceDefinition, DisclosureSource } from "../types/pipeline.js";

export const dataSourceDefinitions: Record<DisclosureSource, DataSourceDefinition> = {
	house: {
		source: "house",
		name: "U.S. House Clerk Financial Disclosure Reports",
		baseUrl: "https://disclosures-clerk.house.gov",
		sourceType: "official_disclosure_repository",
		isOfficialGovernment: true,
		notes: "Official House Clerk public financial disclosure repository."
	},
	senate: {
		source: "senate",
		name: "U.S. Senate Public Financial Disclosure Database",
		baseUrl: "https://efdsearch.senate.gov",
		sourceType: "official_disclosure_repository",
		isOfficialGovernment: true,
		notes: "Official Senate public financial disclosure search database."
	}
};
