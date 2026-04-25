import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
	LOG_LEVEL: z
		.enum(["debug", "info", "warn", "error"])
		.default("info"),
	DATABASE_URL: z.string().min(1).optional(),
	CONGRESS_GOV_API_KEY: z.string().optional(),
	GOVINFO_API_KEY: z.string().optional(),
	MARKET_DATA_PROVIDER: z
		.enum(["none", "alpha_vantage", "polygon", "stooq"])
		.default("none"),
	ALPHA_VANTAGE_API_KEY: z.string().optional(),
	POLYGON_API_KEY: z.string().optional(),
	RAW_DATA_DIR: z.string().default("./data/raw"),
	PROCESSED_DATA_DIR: z.string().default("./data/processed"),
	REPORTS_DIR: z.string().default("./data/reports")
});

export type AppEnv = z.infer<typeof envSchema>;

export const env: AppEnv = envSchema.parse(process.env);

export function requireDatabaseUrl(): string {
	if (!env.DATABASE_URL) {
		throw new Error("DATABASE_URL is required for database operations.");
	}

	return env.DATABASE_URL;
}
