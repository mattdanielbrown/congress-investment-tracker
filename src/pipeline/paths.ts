import { join } from "node:path";

import { env } from "../config/env.js";
import type { DisclosureSource } from "../types/pipeline.js";

export function rawManifestPath(source: DisclosureSource, year: number): string {
	return join(env.RAW_DATA_DIR, source, String(year), "manifest.json");
}

export function parsedBatchPath(source: DisclosureSource, year: number): string {
	return join(env.PROCESSED_DATA_DIR, source, String(year), "parsed-ptrs.json");
}
