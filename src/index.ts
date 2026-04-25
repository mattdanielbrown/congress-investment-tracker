import { env } from "./config/env.js";
import { migrateAndSeed, seedReferenceData, withDatabaseClient } from "./db/client.js";
import { loadParsedPtrBatch } from "./db/load-ptr.js";
import { parseCliArguments, requireSourceAndYear } from "./cli/arguments.js";
import { auditParsedPtrBatch } from "./pipeline/audit.js";
import { collectAndWriteManifest, parseManifestDocuments, readParsedPtrBatch } from "./pipeline/parse.js";
import { todayIsoDate } from "./utils/date.js";
import { errorToLogContext, logger } from "./utils/logger.js";

async function main(): Promise<void> {
	const options = parseCliArguments(process.argv.slice(2));

	if (options.command === "audit-parse") {
		const { source, year } = requireSourceAndYear(options);
		const summary = await auditParsedPtrBatch({ source, year });

		console.log(JSON.stringify(summary));
		return;
	}

	logger.info("Congress stock disclosure tracker command started.", {
		module: "index",
		command: options.command,
		nodeEnv: env.NODE_ENV,
		marketDataProvider: env.MARKET_DATA_PROVIDER,
		date: todayIsoDate()
	});

	if (options.command === "migrate") {
		await withDatabaseClient(migrateAndSeed);
		logger.info("Database schema migrated and reference data seeded.", { module: "index" });
		return;
	}

	if (options.command === "seed") {
		await withDatabaseClient(seedReferenceData);
		logger.info("Reference data seeded.", { module: "index" });
		return;
	}

	const { source, year } = requireSourceAndYear(options);

	if (options.command === "collect") {
		const result = await collectAndWriteManifest({
			source,
			year,
			urls: options.urls,
			...(options.limit !== undefined ? { limit: options.limit } : {})
		});

		logger.info("Collection complete.", {
			module: "index",
			source,
			year,
			documentCount: result.documents.length,
			warnings: result.warnings
		});
		return;
	}

	if (options.command === "parse") {
		const batch = await parseManifestDocuments({ source, year });

		logger.info("Parsing complete.", {
			module: "index",
			source,
			year,
			documentCount: batch.results.length,
			transactionCount: batch.results.reduce((count, result) => count + result.transactions.length, 0)
		});
		return;
	}

	if (options.command === "load") {
		const batch = await readParsedPtrBatch({ source, year });
		const summary = await withDatabaseClient(async (client) => loadParsedPtrBatch(client, batch));

		logger.info("Loading complete.", {
			module: "index",
			source,
			year,
			...summary
		});
		return;
	}

	const collection = await collectAndWriteManifest({
		source,
		year,
		urls: options.urls,
		...(options.limit !== undefined ? { limit: options.limit } : {})
	});
	const batch = await parseManifestDocuments({ source, year });
	const summary = await withDatabaseClient(async (client) => {
		await migrateAndSeed(client);

		return loadParsedPtrBatch(client, batch);
	});

	logger.info("Pipeline complete.", {
		module: "index",
		source,
		year,
		collectedDocuments: collection.documents.length,
		parsedDocuments: batch.results.length,
		...summary
	});
}

main().catch((error: unknown) => {
	logger.error("Fatal application error.", {
		module: "index",
		...errorToLogContext(error)
	});
	process.exitCode = 1;
});
