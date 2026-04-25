import { describe, expect, it } from "vitest";

import { createLogger, errorToLogContext } from "../../src/utils/logger.js";

describe("createLogger", () => {
	it("writes JSON log records with deterministic timestamps", () => {
		const stdout: string[] = [];
		const logger = createLogger({
			getLogLevel: () => "debug",
			now: () => new Date("2026-04-24T12:00:00.000Z"),
			stdout: (message) => stdout.push(message)
		});

		logger.info("Test message.", {
			module: "logger-test",
			action: "write"
		});

		expect(stdout).toHaveLength(1);
		expect(JSON.parse(stdout[0] ?? "{}")).toEqual({
			level: "info",
			message: "Test message.",
			timestamp: "2026-04-24T12:00:00.000Z",
			module: "logger-test",
			action: "write"
		});
	});

	it("filters messages below the configured log level", () => {
		const stdout: string[] = [];
		const logger = createLogger({
			getLogLevel: () => "warn",
			stdout: (message) => stdout.push(message)
		});

		logger.info("Filtered.");

		expect(stdout).toEqual([]);
	});

	it("routes warning and error logs to stderr", () => {
		const stderr: string[] = [];
		const logger = createLogger({
			getLogLevel: () => "debug",
			stderr: (message) => stderr.push(message)
		});

		logger.warn("Warning.");
		logger.error("Error.");

		expect(stderr.map((message) => JSON.parse(message).level)).toEqual(["warn", "error"]);
	});
});

describe("errorToLogContext", () => {
	it("serializes Error instances", () => {
		expect(errorToLogContext(new Error("Failure."))).toMatchObject({
			errorName: "Error",
			errorMessage: "Failure."
		});
	});

	it("serializes unknown thrown values", () => {
		expect(errorToLogContext("plain failure")).toEqual({
			errorValue: "plain failure"
		});
	});
});
