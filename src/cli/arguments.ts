import type { DisclosureSource } from "../types/pipeline.js";

export type CliCommand =
	| "collect"
	| "parse"
	| "load"
	| "run-pipeline"
	| "migrate"
	| "seed"
	| "audit-parse";

export interface CliOptions {
	command: CliCommand;
	source?: DisclosureSource;
	year?: number;
	urls: string[];
	limit?: number;
}

const commands = new Set<CliCommand>([
	"collect",
	"parse",
	"load",
	"run-pipeline",
	"migrate",
	"seed",
	"audit-parse"
]);
const sources = new Set<DisclosureSource>(["house", "senate"]);

export function parseCliArguments(argv: string[]): CliOptions {
	const [commandValue, ...rest] = argv;

	if (!commandValue || !commands.has(commandValue as CliCommand)) {
		throw new Error(`Expected command: ${[...commands].join(", ")}`);
	}

	const options: CliOptions = {
		command: commandValue as CliCommand,
		urls: []
	};

	for (let index = 0; index < rest.length; index += 1) {
		const argument = rest[index];
		const next = rest[index + 1];

		if (argument === "--source") {
			if (!next || !sources.has(next as DisclosureSource)) {
				throw new Error("Expected --source house|senate");
			}

			options.source = next as DisclosureSource;
			index += 1;
			continue;
		}

		if (argument === "--year") {
			if (!next) {
				throw new Error("Expected --year YYYY");
			}

			options.year = parseYear(next);
			index += 1;
			continue;
		}

		if (argument === "--url") {
			if (!next) {
				throw new Error("Expected --url URL");
			}

			options.urls.push(next);
			index += 1;
			continue;
		}

		if (argument === "--limit") {
			if (!next) {
				throw new Error("Expected --limit number");
			}

			options.limit = parseLimit(next);
			index += 1;
			continue;
		}

		throw new Error(`Unknown argument: ${argument ?? ""}`);
	}

	return options;
}

export function requireSourceAndYear(options: CliOptions): {
	source: DisclosureSource;
	year: number;
} {
	if (!options.source) {
		throw new Error("Missing required --source house|senate");
	}

	if (!options.year) {
		throw new Error("Missing required --year YYYY");
	}

	return {
		source: options.source,
		year: options.year
	};
}

function parseYear(value: string): number {
	const year = Number(value);

	if (!Number.isInteger(year) || year < 2008 || year > 2100) {
		throw new Error(`Invalid year: ${value}`);
	}

	return year;
}

function parseLimit(value: string): number {
	const limit = Number(value);

	if (!Number.isInteger(limit) || limit < 1) {
		throw new Error(`Invalid limit: ${value}`);
	}

	return limit;
}
