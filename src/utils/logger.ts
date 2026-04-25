import { env } from "../config/env.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

const levelRank: Record<LogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40
};

export interface LogContext {
	module?: string;
	action?: string;
	[key: string]: unknown;
}

export interface Logger {
	debug(message: string, context?: LogContext): void;
	info(message: string, context?: LogContext): void;
	warn(message: string, context?: LogContext): void;
	error(message: string, context?: LogContext): void;
}

function shouldLog(level: LogLevel): boolean {
	return levelRank[level] >= levelRank[env.LOG_LEVEL];
}

function writeLog(level: LogLevel, message: string, context: LogContext = {}): void {
	if (!shouldLog(level)) {
		return;
	}

	const record = {
		level,
		message,
		timestamp: new Date().toISOString(),
		...context
	};
	const serialized = JSON.stringify(record);

	if (level === "error") {
		console.error(serialized);
		return;
	}

	if (level === "warn") {
		console.warn(serialized);
		return;
	}

	console.log(serialized);
}

export const logger: Logger = {
	debug(message, context) {
		writeLog("debug", message, context);
	},
	info(message, context) {
		writeLog("info", message, context);
	},
	warn(message, context) {
		writeLog("warn", message, context);
	},
	error(message, context) {
		writeLog("error", message, context);
	}
};

export function errorToLogContext(error: unknown): Record<string, unknown> {
	if (error instanceof Error) {
		return {
			errorName: error.name,
			errorMessage: error.message,
			stack: error.stack
		};
	}

	return {
		errorValue: String(error)
	};
}
