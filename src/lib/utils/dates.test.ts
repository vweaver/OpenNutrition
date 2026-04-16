import { describe, it, expect } from 'vitest';
import { today, daysAgo, getWeekDates, isToday, formatDate } from './dates';

describe('dates', () => {
	it('today() returns a YYYY-MM-DD string', () => {
		expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('isToday(today()) is true', () => {
		expect(isToday(today())).toBe(true);
	});

	it('isToday() is false for other dates', () => {
		expect(isToday('1999-01-01')).toBe(false);
	});

	it('daysAgo(0) equals today()', () => {
		expect(daysAgo(0)).toBe(today());
	});

	it('daysAgo(1) is the day before today()', () => {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		expect(daysAgo(1)).toBe(yesterday.toISOString().split('T')[0]);
	});

	it('getWeekDates returns 7 consecutive ISO dates starting Monday', () => {
		const week = getWeekDates('2026-04-15'); // a Wednesday
		expect(week).toHaveLength(7);
		expect(week[0]).toBe('2026-04-13'); // Monday
		expect(week[6]).toBe('2026-04-19'); // Sunday
	});

	it('formatDate returns a non-empty human string', () => {
		const out = formatDate('2026-04-15');
		expect(out.length).toBeGreaterThan(0);
		expect(out).toMatch(/Apr/);
	});
});
