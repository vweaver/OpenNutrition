import { describe, it, expect } from 'vitest';
import { scaleNutrition, sumNutrition, caloriesFromMacros, calculateMacroPercentages } from './nutrition';
import type { Food } from '$lib/db/types';

const baseFood: Food = {
	id: 'test',
	name: 'Test',
	brand: null,
	serving_size_g: 100,
	serving_unit: 'g',
	calories: 100,
	protein_g: 10,
	carbs_g: 20,
	fat_g: 5,
	fiber_g: 2,
	sugar_g: 3,
	sodium_mg: 100,
	barcode: null,
	source: 'manual',
	is_deleted: 0,
	created_at: '',
	updated_at: ''
};

describe('nutrition', () => {
	it('scaleNutrition scales all numeric fields linearly', () => {
		const scaled = scaleNutrition(baseFood, 2);
		expect(scaled.calories).toBe(200);
		expect(scaled.protein_g).toBe(20);
		expect(scaled.carbs_g).toBe(40);
		expect(scaled.fat_g).toBe(10);
		expect(scaled.fiber_g).toBe(4);
	});

	it('scaleNutrition preserves null for nullable fields', () => {
		const scaled = scaleNutrition({ ...baseFood, fiber_g: null }, 3);
		expect(scaled.fiber_g).toBeNull();
	});

	it('sumNutrition adds across multiple entries', () => {
		const total = sumNutrition([baseFood, baseFood, baseFood]);
		expect(total.calories).toBe(300);
		expect(total.protein_g).toBe(30);
		expect(total.fiber_g).toBe(6);
	});

	it('sumNutrition treats nulls as 0', () => {
		const total = sumNutrition([{ ...baseFood, sodium_mg: null }]);
		expect(total.sodium_mg).toBe(0);
	});

	it('caloriesFromMacros uses 4/4/9 per gram', () => {
		// 10g protein = 40, 20g carbs = 80, 5g fat = 45 => 165
		expect(caloriesFromMacros(10, 20, 5)).toBe(165);
	});

	it('calculateMacroPercentages sums to ~100%', () => {
		const p = calculateMacroPercentages(10, 20, 5);
		const sum = p.protein + p.carbs + p.fat;
		expect(sum).toBeCloseTo(100, 1);
	});

	it('calculateMacroPercentages returns zeros for zero input', () => {
		const p = calculateMacroPercentages(0, 0, 0);
		expect(p).toEqual({ protein: 0, carbs: 0, fat: 0 });
	});
});
