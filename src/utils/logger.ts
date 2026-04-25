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

export interface LoggerOptions {
	getLogLevel?: () => LogLevel;
	now?: () => Date;
	stdout?: (message: string) => void;
	stderr?: (message: string) => void;
}

function shouldLog(level: LogLevel, configuredLevel: LogLevel): boolean {
	return levelRank[level] >= levelRank[configuredLevel];
}

export function createLogger(options: LoggerOptions = {}): Logger {
	const getLogLevel = options.getLogLevel ?? (() => env.LOG_LEVEL);
	const now = options.now ?? (() => new Date());
	const stdout = options.stdout ?? ((message: string) => console.log(message));
	const stderr = options.stderr ?? ((message: string) => console.error(message));

	function writeLog(level: LogLevel, message: string, context: LogContext = {}): void {
		if (!shouldLog(level, getLogLevel())) {
			return;
		}

		const record = {
			level,
			message,
			timestamp: now().toISOString(),
			...context
		};
		const serialized = JSON.stringify(record);

		if (level === "error" || level === "warn") {
			stderr(serialized);
			return;
		}

		stdout(serialized);
	}

	return {
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
}

export const logger: Logger = createLogger();

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
