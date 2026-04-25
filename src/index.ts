import { env } from "./config/env.js";
import { todayIsoDate } from "./utils/date.js";
import { errorToLogContext, logger } from "./utils/logger.js";

async function main(): Promise<void> {
	logger.info("Congress stock disclosure tracker initialized.", {
		module: "index",
		nodeEnv: env.NODE_ENV,
		marketDataProvider: env.MARKET_DATA_PROVIDER,
		date: todayIsoDate()
	});

	logger.info("No data collection task was executed.", {
		module: "index",
		reason: "Starter project entrypoint only."
	});
}

main().catch((error: unknown) => {
	logger.error("Fatal application error.", {
		module: "index",
		...errorToLogContext(error)
	});
	process.exitCode = 1;
});
