import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function extractDocumentText(path: string): Promise<string> {
	const extension = extname(path).toLowerCase();

	if ([".txt", ".text", ".html", ".htm", ".csv"].includes(extension)) {
		return readFile(path, "utf8");
	}

	if (extension === ".pdf") {
		return extractPdfText(path);
	}

	throw new Error(`Unsupported document extension for text extraction: ${extension || "(none)"}`);
}

async function extractPdfText(path: string): Promise<string> {
	try {
		const result = await execFileAsync("pdftotext", ["-layout", path, "-"], {
			maxBuffer: 20 * 1024 * 1024
		});

		return result.stdout;
	} catch (error) {
		throw new Error(
			`Unable to extract PDF text from ${path}. Install poppler/pdftotext or provide a text fixture. ${
				error instanceof Error ? error.message : String(error)
			}`
		);
	}
}
