import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import { requireDatabaseUrl } from "../config/env.js";
import { dataSourceDefinitions } from "../sources/definitions.js";

const { Client } = pg;

export type DatabaseClient = pg.Client;

export async function createDatabaseClient(): Promise<DatabaseClient> {
	const client = new Client({
		connectionString: requireDatabaseUrl()
	});

	await client.connect();

	return client;
}

export async function withDatabaseClient<T>(
	callback: (client: DatabaseClient) => Promise<T>
): Promise<T> {
	const client = await createDatabaseClient();

	try {
		return await callback(client);
	} finally {
		await client.end();
	}
}

export async function runSchemaMigration(client: DatabaseClient): Promise<void> {
	const schema = await readSchemaSql();

	await client.query(schema);
}

async function readSchemaSql(): Promise<string> {
	const moduleDirectory = dirname(fileURLToPath(import.meta.url));
	const candidatePaths = [
		join(moduleDirectory, "schema.sql"),
		join(process.cwd(), "src", "db", "schema.sql")
	];

	for (const path of candidatePaths) {
		try {
			return await readFile(path, "utf8");
		} catch (error) {
			if (!isMissingFileError(error)) {
				throw error;
			}
		}
	}

	throw new Error("Unable to locate src/db/schema.sql for database migration.");
}

function isMissingFileError(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export async function seedReferenceData(client: DatabaseClient): Promise<void> {
	await client.query(
		`INSERT INTO chambers (code, name)
			VALUES
				('house', 'U.S. House of Representatives'),
				('senate', 'U.S. Senate')
			ON CONFLICT (code) DO UPDATE
			SET name = EXCLUDED.name`
	);

	for (const source of Object.values(dataSourceDefinitions)) {
		await client.query(
			`INSERT INTO data_sources (
				name,
				base_url,
				source_type,
				is_official_government,
				notes
			)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (name) DO UPDATE
			SET
				base_url = EXCLUDED.base_url,
				source_type = EXCLUDED.source_type,
				is_official_government = EXCLUDED.is_official_government,
				notes = EXCLUDED.notes`,
			[
				source.name,
				source.baseUrl,
				source.sourceType,
				source.isOfficialGovernment,
				source.notes
			]
		);
	}
}

export async function migrateAndSeed(client: DatabaseClient): Promise<void> {
	await runSchemaMigration(client);
	await seedReferenceData(client);
}
