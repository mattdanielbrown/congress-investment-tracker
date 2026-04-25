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
const houseFinancialDisclosureIndexPath = "/public_disc/financial-pdfs";
const housePtrPdfPath = "/public_disc/ptr-pdfs";

interface DownloadTarget {
	url: string;
	sourcePublishedAt?: string;
	rawMetadata?: Record<string, unknown>;
}

interface HouseIndexRow {
	prefix: string;
	last: string;
	first: string;
	suffix: string;
	filingType: string;
	stateDistrict: string;
	year: string;
	filingDate: string;
	documentId: string;
}

export async function collectPtrDocuments(options: CollectOptions): Promise<CollectResult> {
	if (options.source === "house") {
		return collectHousePtrDocuments(options);
	}

	return collectSenatePtrDocuments(options);
}

async function collectHousePtrDocuments(options: CollectOptions): Promise<CollectResult> {
	const targets = options.urls?.length
		? options.urls.map((url) => ({ url }))
		: await discoverHousePdfTargets(options.year);
	const result = await downloadDocuments({
		...options,
		targets: limitValues(targets, options.limit)
	});

	if (targets.length === 0 && !options.urls?.length) {
		result.warnings.push(
			`No House PTR PDF links were discovered for ${options.year}; pass official document URLs with --url if the official index layout has changed.`
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
		targets: limitValues(options.urls.map((url) => ({ url })), options.limit)
	});
}

async function discoverHousePdfTargets(year: number): Promise<DownloadTarget[]> {
	const indexTargets = await discoverHousePdfTargetsFromYearIndex(year);

	if (indexTargets.length > 0) {
		return indexTargets;
	}

	return discoverHousePdfTargetsFromReportPage(year);
}

async function discoverHousePdfTargetsFromYearIndex(year: number): Promise<DownloadTarget[]> {
	const indexUrl = new URL(`${houseFinancialDisclosureIndexPath}/${year}FD.txt`, dataSourceDefinitions.house.baseUrl);
	const response = await fetch(indexUrl);

	if (!response.ok) {
		return [];
	}

	const rows = parseHouseIndexRows(await response.text());

	return rows
		.filter((row) => row.filingType.toUpperCase() === "P" && row.year === String(year))
		.map((row) => {
			const url = new URL(`${housePtrPdfPath}/${year}/${row.documentId}.pdf`, dataSourceDefinitions.house.baseUrl);
			const sourcePublishedAt = parseHouseIndexDate(row.filingDate);
			const rawMetadata: Record<string, unknown> = {
				documentId: row.documentId,
				filingType: row.filingType,
				filerPrefix: row.prefix,
				filerFirstName: row.first,
				filerLastName: row.last,
				filerSuffix: row.suffix,
				stateDistrict: row.stateDistrict,
				indexUrl: indexUrl.toString()
			};

			return {
				url: url.toString(),
				...(sourcePublishedAt ? { sourcePublishedAt } : {}),
				rawMetadata
			};
		});
}

async function discoverHousePdfTargetsFromReportPage(year: number): Promise<DownloadTarget[]> {
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

	return [...urls].sort().map((url) => ({ url }));
}

async function downloadDocuments(options: Required<Pick<CollectOptions, "source" | "year">> & {
	targets: DownloadTarget[];
}): Promise<CollectResult> {
	const warnings: string[] = [];
	const documents: CollectedSourceDocument[] = [];

	for (const target of options.targets) {
		const response = await fetch(target.url);

		if (!response.ok) {
			warnings.push(`Failed to download ${target.url}: ${response.status} ${response.statusText}`);
			continue;
		}

		const bytes = Buffer.from(await response.arrayBuffer());
		const hash = sha256(bytes);
		const contentType = response.headers.get("content-type") ?? undefined;
		const storagePath = await writeRawDocument(options.source, options.year, target.url, bytes, hash);
		const rawMetadata = {
			...target.rawMetadata,
			fileName: basename(new URL(target.url).pathname),
			contentLength: bytes.byteLength
		};

		documents.push({
			source: options.source,
			chamber: options.source,
			year: options.year,
			url: target.url,
			documentType: "periodic_transaction_report",
			...(contentType ? { contentType } : {}),
			sha256: hash,
			storagePath,
			retrievedAt: new Date().toISOString(),
			...(target.sourcePublishedAt ? { sourcePublishedAt: target.sourcePublishedAt } : {}),
			rawMetadata
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

function parseHouseIndexRows(text: string): HouseIndexRow[] {
	const lines = text.split(/\r?\n/u).filter(Boolean);
	const rows: HouseIndexRow[] = [];

	for (const line of lines.slice(1)) {
		const [
			prefix = "",
			last = "",
			first = "",
			suffix = "",
			filingType = "",
			stateDistrict = "",
			year = "",
			filingDate = "",
			documentId = ""
		] = line.split("\t");

		if (!documentId) {
			continue;
		}

		rows.push({
			prefix,
			last,
			first,
			suffix,
			filingType,
			stateDistrict,
			year,
			filingDate,
			documentId
		});
	}

	return rows;
}

function parseHouseIndexDate(value: string): string | undefined {
	const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/u);

	if (!match?.[1] || !match[2] || !match[3]) {
		return undefined;
	}

	const month = match[1].padStart(2, "0");
	const day = match[2].padStart(2, "0");

	return `${match[3]}-${month}-${day}`;
}
