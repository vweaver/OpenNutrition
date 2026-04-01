export function today(): string {
	return new Date().toISOString().split('T')[0];
}

export function formatDate(dateStr: string): string {
	const date = new Date(dateStr + 'T00:00:00');
	return date.toLocaleDateString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric'
	});
}

export function formatDateLong(dateStr: string): string {
	const date = new Date(dateStr + 'T00:00:00');
	return date.toLocaleDateString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	});
}

export function daysAgo(n: number): string {
	const date = new Date();
	date.setDate(date.getDate() - n);
	return date.toISOString().split('T')[0];
}

export function getWeekDates(dateStr: string): string[] {
	const date = new Date(dateStr + 'T00:00:00');
	const day = date.getDay();
	const monday = new Date(date);
	monday.setDate(date.getDate() - ((day + 6) % 7));

	const dates: string[] = [];
	for (let i = 0; i < 7; i++) {
		const d = new Date(monday);
		d.setDate(monday.getDate() + i);
		dates.push(d.toISOString().split('T')[0]);
	}
	return dates;
}

export function isToday(dateStr: string): boolean {
	return dateStr === today();
}
