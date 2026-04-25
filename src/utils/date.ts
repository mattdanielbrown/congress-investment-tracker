export function parseIsoDate(value: string): Date {
	const date = new Date(`${value}T00:00:00.000Z`);

	if (Number.isNaN(date.getTime())) {
		throw new Error(`Invalid ISO date: ${value}`);
	}

	return date;
}

export function formatIsoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function isWeekend(date: Date): boolean {
	const day = date.getUTCDay();

	return day === 0 || day === 6;
}

export function getPreviousUtcDate(date: Date): Date {
	const previous = new Date(date);
	previous.setUTCDate(previous.getUTCDate() - 1);

	return previous;
}

export function getNearestPriorWeekday(date: Date): Date {
	let cursor = new Date(date);

	while (isWeekend(cursor)) {
		cursor = getPreviousUtcDate(cursor);
	}

	return cursor;
}

export function todayIsoDate(): string {
	return formatIsoDate(new Date());
}
