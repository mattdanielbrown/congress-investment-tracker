import type { DatabaseClient } from "./client.js";
import { dataSourceDefinitions } from "../sources/definitions.js";
import type {
	LoadSummary,
	ParsedMember,
	ParsedPtrBatch,
	ParsedPtrTransaction,
	PtrParserResult
} from "../types/pipeline.js";

export async function loadParsedPtrBatch(
	client: DatabaseClient,
	batch: ParsedPtrBatch
): Promise<LoadSummary> {
	const summary: LoadSummary = {
		sourceDocuments: 0,
		members: 0,
		reports: 0,
		assets: 0,
		transactions: 0,
		warnings: 0
	};

	await client.query("BEGIN");

	try {
		for (const result of batch.results) {
			await loadParserResult(client, result, summary);
		}

		await client.query("COMMIT");
		return summary;
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	}
}

async function loadParserResult(
	client: DatabaseClient,
	result: PtrParserResult,
	summary: LoadSummary
): Promise<void> {
	const dataSourceId = await getDataSourceId(client, result.sourceDocument.source);
	const sourceDocumentId = await ensureSourceDocument(client, dataSourceId, result);
	summary.sourceDocuments += 1;
	summary.warnings += result.warnings.length;

	const memberId = result.member
		? await ensureMember(client, result.member, sourceDocumentId)
		: undefined;

	if (memberId !== undefined) {
		summary.members += 1;
	}

	const reportId = await ensureDisclosureReport(client, result, sourceDocumentId, memberId);
	summary.reports += 1;

	for (const transaction of result.transactions) {
		const assetId = await ensureAsset(client, transaction);
		summary.assets += 1;
		const inserted = await ensureTransaction(client, reportId, memberId, assetId, transaction);

		if (inserted) {
			summary.transactions += 1;
		}
	}

	await insertAuditLog(client, {
		entityType: "source_document",
		entityId: sourceDocumentId,
		action: "load_ptr_parser_result",
		sourceDocumentId,
		dataSourceId,
		confidence: result.extractionConfidence,
		details: {
			parserVersion: result.parserVersion,
			status: result.status,
			warnings: result.warnings,
			transactionCount: result.transactions.length
		}
	});
}

async function getDataSourceId(client: DatabaseClient, source: "house" | "senate"): Promise<number> {
	const definition = dataSourceDefinitions[source];
	const result = await client.query<{ id: string }>(
		"SELECT id FROM data_sources WHERE name = $1",
		[definition.name]
	);

	if (result.rows[0]?.id) {
		return Number(result.rows[0].id);
	}

	const inserted = await client.query<{ id: string }>(
		`INSERT INTO data_sources (
			name,
			base_url,
			source_type,
			is_official_government,
			notes
		)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id`,
		[
			definition.name,
			definition.baseUrl,
			definition.sourceType,
			definition.isOfficialGovernment,
			definition.notes
		]
	);

	return Number(inserted.rows[0]?.id);
}

async function ensureSourceDocument(
	client: DatabaseClient,
	dataSourceId: number,
	result: PtrParserResult
): Promise<number> {
	const existing = await client.query<{ id: string }>(
		`SELECT id
			FROM source_documents
			WHERE sha256 = $1 OR url = $2
			ORDER BY id
			LIMIT 1`,
		[result.sourceDocument.sha256, result.sourceDocument.url]
	);

	if (existing.rows[0]?.id) {
		await client.query(
			`UPDATE source_documents
				SET parser_version = $1,
					raw_metadata = $2
				WHERE id = $3`,
			[
				result.parserVersion,
				JSON.stringify(result.sourceDocument.rawMetadata),
				existing.rows[0].id
			]
		);

		return Number(existing.rows[0].id);
	}

	const inserted = await client.query<{ id: string }>(
		`INSERT INTO source_documents (
			data_source_id,
			url,
			document_type,
			content_type,
			sha256,
			storage_path,
			retrieved_at,
			source_published_at,
			parser_version,
			raw_metadata
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id`,
		[
			dataSourceId,
			result.sourceDocument.url,
			result.sourceDocument.documentType,
			result.sourceDocument.contentType,
			result.sourceDocument.sha256,
			result.sourceDocument.storagePath,
			result.sourceDocument.retrievedAt,
			result.sourceDocument.sourcePublishedAt,
			result.parserVersion,
			JSON.stringify(result.sourceDocument.rawMetadata)
		]
	);

	return Number(inserted.rows[0]?.id);
}

async function ensureMember(
	client: DatabaseClient,
	member: ParsedMember,
	sourceDocumentId: number
): Promise<number> {
	const chamberId = await getChamberId(client, member.chamber);
	const existing = await client.query<{ id: string }>(
		`SELECT id
			FROM members
			WHERE chamber_id = $1
				AND full_name = $2
				AND state = $3
				AND COALESCE(district, '') = COALESCE($4, '')
			ORDER BY id
			LIMIT 1`,
		[chamberId, member.fullName, member.state, member.district]
	);

	if (existing.rows[0]?.id) {
		await client.query(
			`UPDATE members
				SET source_document_id = COALESCE(source_document_id, $1),
					updated_at = now()
				WHERE id = $2`,
			[sourceDocumentId, existing.rows[0].id]
		);

		return Number(existing.rows[0].id);
	}

	const inserted = await client.query<{ id: string }>(
		`INSERT INTO members (
			official_id,
			bioguide_id,
			full_name,
			chamber_id,
			state,
			district,
			party,
			official_profile_url,
			is_current,
			source_document_id
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)
		RETURNING id`,
		[
			member.officialId,
			member.bioguideId,
			member.fullName,
			chamberId,
			member.state,
			member.district,
			member.party,
			member.officialProfileUrl,
			sourceDocumentId
		]
	);

	return Number(inserted.rows[0]?.id);
}

async function getChamberId(client: DatabaseClient, chamber: "house" | "senate"): Promise<number> {
	const result = await client.query<{ id: string }>(
		"SELECT id FROM chambers WHERE code = $1",
		[chamber]
	);

	if (!result.rows[0]?.id) {
		throw new Error(`Missing seeded chamber: ${chamber}`);
	}

	return Number(result.rows[0].id);
}

async function ensureDisclosureReport(
	client: DatabaseClient,
	result: PtrParserResult,
	sourceDocumentId: number,
	memberId: number | undefined
): Promise<number> {
	const existing = await client.query<{ id: string }>(
		"SELECT id FROM disclosure_reports WHERE source_document_id = $1 ORDER BY id LIMIT 1",
		[sourceDocumentId]
	);

	if (existing.rows[0]?.id) {
		await client.query(
			`UPDATE disclosure_reports
				SET member_id = COALESCE(member_id, $1),
					status = $2,
					extraction_confidence = $3
				WHERE id = $4`,
			[memberId, result.status, result.extractionConfidence, existing.rows[0].id]
		);

		return Number(existing.rows[0].id);
	}

	const inserted = await client.query<{ id: string }>(
		`INSERT INTO disclosure_reports (
			member_id,
			source_document_id,
			report_type,
			filing_date,
			status,
			extraction_confidence
		)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id`,
		[
			memberId,
			sourceDocumentId,
			result.reportType,
			result.filingDate,
			result.status,
			result.extractionConfidence
		]
	);

	return Number(inserted.rows[0]?.id);
}

async function ensureAsset(
	client: DatabaseClient,
	transaction: ParsedPtrTransaction
): Promise<number> {
	const existing = await client.query<{ id: string }>(
		`SELECT id
			FROM assets
			WHERE normalized_name = $1 OR reported_name = $2
			ORDER BY id
			LIMIT 1`,
		[transaction.normalizedAssetName, transaction.assetName]
	);

	if (existing.rows[0]?.id) {
		return Number(existing.rows[0].id);
	}

	const inserted = await client.query<{ id: string }>(
		`INSERT INTO assets (
			reported_name,
			normalized_name,
			asset_type,
			confidence
		)
		VALUES ($1, $2, $3, $4)
		RETURNING id`,
		[
			transaction.assetName,
			transaction.normalizedAssetName,
			"reported_security",
			transaction.confidence
		]
	);

	return Number(inserted.rows[0]?.id);
}

async function ensureTransaction(
	client: DatabaseClient,
	disclosureReportId: number,
	memberId: number | undefined,
	assetId: number,
	transaction: ParsedPtrTransaction
): Promise<boolean> {
	const existing = await client.query<{ id: string }>(
		`SELECT id
			FROM transactions
			WHERE disclosure_report_id = $1
				AND asset_id = $2
				AND transaction_type = $3
				AND COALESCE(transaction_date::text, '') = COALESCE($4, '')
				AND COALESCE(reported_value_label, '') = COALESCE($5, '')
				AND COALESCE(reported_owner_category, '') = COALESCE($6, '')
			LIMIT 1`,
		[
			disclosureReportId,
			assetId,
			transaction.transactionType,
			transaction.transactionDate,
			transaction.reportedValue.label,
			transaction.reportedOwnerCategory
		]
	);

	if (existing.rows[0]?.id) {
		return false;
	}

	await client.query(
		`INSERT INTO transactions (
			disclosure_report_id,
			member_id,
			asset_id,
			reported_owner_category,
			transaction_type,
			transaction_date,
			filing_date,
			reported_value_min,
			reported_value_max,
			reported_value_label,
			estimated_value,
			estimation_method,
			currency,
			confidence,
			notes
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
		[
			disclosureReportId,
			memberId,
			assetId,
			transaction.reportedOwnerCategory,
			transaction.transactionType,
			transaction.transactionDate,
			transaction.filingDate,
			transaction.reportedValue.min,
			transaction.reportedValue.max,
			transaction.reportedValue.label,
			transaction.estimatedValue,
			transaction.estimationMethod,
			transaction.reportedValue.currency,
			transaction.confidence,
			transaction.notes
		]
	);

	return true;
}

async function insertAuditLog(
	client: DatabaseClient,
	input: {
		entityType: string;
		entityId: number;
		action: string;
		sourceDocumentId: number;
		dataSourceId: number;
		confidence: number;
		details: Record<string, unknown>;
	}
): Promise<void> {
	await client.query(
		`INSERT INTO audit_logs (
			entity_type,
			entity_id,
			action,
			source_document_id,
			data_source_id,
			confidence,
			details
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		[
			input.entityType,
			input.entityId,
			input.action,
			input.sourceDocumentId,
			input.dataSourceId,
			input.confidence,
			JSON.stringify(input.details)
		]
	);
}
