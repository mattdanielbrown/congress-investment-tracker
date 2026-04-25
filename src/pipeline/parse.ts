import { collectPtrDocuments } from "../sources/collector.js";
import { readJsonFile, writeJsonFile } from "../io/json.js";
import { parseHousePtrText, parseSenatePtrText, ptrParserVersion } from "../parsers/ptr-parser.js";
import { extractDocumentText } from "../parsers/text-extraction.js";
import type {
	CollectedSourceDocument,
	DisclosureSource,
	ParsedPtrBatch,
	PtrParserResult
} from "../types/pipeline.js";
import { parsedBatchPath, rawManifestPath } from "./paths.js";

interface RawManifest {
	source: DisclosureSource;
	year: number;
	documents: CollectedSourceDocument[];
	warnings: string[];
}

export async function collectAndWriteManifest(input: {
	source: DisclosureSource;
	year: number;
	urls?: string[];
	limit?: number;
}): Promise<RawManifest> {
	const result = await collectPtrDocuments(input);
	const manifest: RawManifest = {
		source: result.source,
		year: result.year,
		documents: result.documents,
		warnings: result.warnings
	};

	await writeJsonFile(rawManifestPath(input.source, input.year), manifest);

	return manifest;
}

export async function parseManifestDocuments(input: {
	source: DisclosureSource;
	year: number;
}): Promise<ParsedPtrBatch> {
	const manifest = await readJsonFile<RawManifest>(rawManifestPath(input.source, input.year));
	const results: PtrParserResult[] = [];

	for (const document of manifest.documents) {
		const text = await extractDocumentText(document.storagePath);
		const result = document.source === "house"
			? parseHousePtrText({ sourceDocument: document, text })
			: parseSenatePtrText({ sourceDocument: document, text });

		results.push(result);
	}

	const batch: ParsedPtrBatch = {
		source: input.source,
		year: input.year,
		parserVersion: ptrParserVersion,
		results
	};

	await writeJsonFile(parsedBatchPath(input.source, input.year), batch);

	return batch;
}

export async function readParsedPtrBatch(input: {
	source: DisclosureSource;
	year: number;
}): Promise<ParsedPtrBatch> {
	return readJsonFile<ParsedPtrBatch>(parsedBatchPath(input.source, input.year));
}
