import { describe, it, expect } from 'vitest';
import { kgToLbs, lbsToKg, cmToIn, inToCm, formatWeight, formatHeight } from './units';

describe('units', () => {
	it('kgToLbs is the inverse of lbsToKg', () => {
		expect(lbsToKg(kgToLbs(100))).toBeCloseTo(100, 4);
	});

	it('cmToIn is the inverse of inToCm within rounding', () => {
		expect(inToCm(cmToIn(100))).toBeCloseTo(100, 3);
	});

	it('formatWeight metric returns kg', () => {
		expect(formatWeight(75, 'metric')).toBe('75.0 kg');
	});

	it('formatWeight imperial converts to lbs', () => {
		expect(formatWeight(75, 'imperial')).toMatch(/lbs$/);
		expect(formatWeight(75, 'imperial')).toBe('165.3 lbs');
	});

	it('formatHeight metric returns cm', () => {
		expect(formatHeight(180, 'metric')).toBe('180 cm');
	});

	it('formatHeight imperial returns feet and inches', () => {
		expect(formatHeight(180, 'imperial')).toMatch(/^\d+'\d+"$/);
	});
});
