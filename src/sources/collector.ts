import { mkdir, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import { env } from "../config/env.js";
import { sha256 } from "../utils/hash.js";
import type { CollectedSourceDocument, DisclosureSource } from "../types/pipeline.js";
import { dataSourceDefinitions } from "./definitions.js";

export interface CollectOptions {
	source: DisclosureSource;
	year: number;
	urls?: string[];
	limit?: number;
}

export interface CollectResult {
	source: DisclosureSource;
	year: number;
	documents: CollectedSourceDocument[];
	warnings: string[];
}

const houseReportIndexUrl = "https://disclosures-clerk.house.gov/FinancialDisclosure/ViewReport";

export async function collectPtrDocuments(options: CollectOptions): Promise<CollectResult> {
	if (options.source === "house") {
		return collectHousePtrDocuments(options);
	}

	return collectSenatePtrDocuments(options);
}

async function collectHousePtrDocuments(options: CollectOptions): Promise<CollectResult> {
	const urls = options.urls?.length ? options.urls : await discoverHousePdfUrls(options.year);
	const result = await downloadDocuments({
		...options,
		urls: limitValues(urls, options.limit)
	});

	if (urls.length === 0 && !options.urls?.length) {
		result.warnings.push(
			`No House PTR PDF links were discovered for ${options.year}; pass official document URLs with --url if the index layout has changed.`
		);
	}

	return result;
}

async function collectSenatePtrDocuments(options: CollectOptions): Promise<CollectResult> {
	if (!options.urls?.length) {
		return {
			source: "senate",
			year: options.year,
			documents: [],
			warnings: [
				"Senate collection requires one or more official efdsearch.senate.gov document URLs via --url."
			]
		};
	}

	return downloadDocuments({
		...options,
		urls: limitValues(options.urls, options.limit)
	});
}

async function discoverHousePdfUrls(year: number): Promise<string[]> {
	const response = await fetch(houseReportIndexUrl);

	if (!response.ok) {
		throw new Error(`Failed to fetch House disclosure index: ${response.status} ${response.statusText}`);
	}

	const html = await response.text();
	const urls = new Set<string>();
	const matcher = /href=["']([^"']*ptr-pdfs\/\d{4}\/[^"']+\.pdf[^"']*)["']/giu;

	for (const match of html.matchAll(matcher)) {
		const href = match[1];

		if (href?.includes(`/ptr-pdfs/${year}/`)) {
			urls.add(new URL(href, dataSourceDefinitions.house.baseUrl).toString());
		}
	}

	return [...urls].sort();
}

async function downloadDocuments(options: Required<Pick<CollectOptions, "source" | "year">> & {
	urls: string[];
}): Promise<CollectResult> {
	const warnings: string[] = [];
	const documents: CollectedSourceDocument[] = [];

	for (const url of options.urls) {
		const response = await fetch(url);

		if (!response.ok) {
			warnings.push(`Failed to download ${url}: ${response.status} ${response.statusText}`);
			continue;
		}

		const bytes = Buffer.from(await response.arrayBuffer());
		const hash = sha256(bytes);
		const contentType = response.headers.get("content-type") ?? undefined;
		const storagePath = await writeRawDocument(options.source, options.year, url, bytes, hash);

		documents.push({
			source: options.source,
			chamber: options.source,
			year: options.year,
			url,
			documentType: "periodic_transaction_report",
			...(contentType ? { contentType } : {}),
			sha256: hash,
			storagePath,
			retrievedAt: new Date().toISOString(),
			rawMetadata: {
				fileName: basename(new URL(url).pathname),
				contentLength: bytes.byteLength
			}
		});
	}

	return {
		source: options.source,
		year: options.year,
		documents,
		warnings
	};
}

async function writeRawDocument(
	source: DisclosureSource,
	year: number,
	url: string,
	bytes: Buffer,
	hash: string
): Promise<string> {
	const extension = extname(new URL(url).pathname) || ".bin";
	const directory = join(env.RAW_DATA_DIR, source, String(year));
	const storagePath = join(directory, `${hash}${extension}`);

	await mkdir(directory, { recursive: true });
	await writeFile(storagePath, bytes);

	return storagePath;
}

function limitValues<T>(values: T[], limit: number | undefined): T[] {
	if (limit === undefined) {
		return values;
	}

	return values.slice(0, limit);
}
