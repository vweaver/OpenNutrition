import type { Food, FoodLog } from '$lib/db/types';

const NUTRITION_FIELDS = [
	'calories',
	'protein_g',
	'carbs_g',
	'fat_g',
	'fiber_g',
	'sugar_g',
	'sodium_mg'
] as const;

type NutritionFields = Pick<Food, (typeof NUTRITION_FIELDS)[number]>;

export function scaleNutrition(food: NutritionFields, servings: number): NutritionFields {
	return {
		calories: food.calories * servings,
		protein_g: food.protein_g * servings,
		carbs_g: food.carbs_g * servings,
		fat_g: food.fat_g * servings,
		fiber_g: food.fiber_g != null ? food.fiber_g * servings : null,
		sugar_g: food.sugar_g != null ? food.sugar_g * servings : null,
		sodium_mg: food.sodium_mg != null ? food.sodium_mg * servings : null
	};
}

export interface NutritionTotals {
	calories: number;
	protein_g: number;
	carbs_g: number;
	fat_g: number;
	fiber_g: number;
	sugar_g: number;
	sodium_mg: number;
}

export function sumNutrition(entries: NutritionFields[]): NutritionTotals {
	return entries.reduce<NutritionTotals>(
		(totals, entry) => {
			totals.calories += entry.calories;
			totals.protein_g += entry.protein_g;
			totals.carbs_g += entry.carbs_g;
			totals.fat_g += entry.fat_g;
			totals.fiber_g += entry.fiber_g ?? 0;
			totals.sugar_g += entry.sugar_g ?? 0;
			totals.sodium_mg += entry.sodium_mg ?? 0;
			return totals;
		},
		{ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0 }
	);
}

export interface MacroPercentages {
	protein: number;
	carbs: number;
	fat: number;
}

export function calculateMacroPercentages(
	protein_g: number,
	carb_g: number,
	fat_g: number
): MacroPercentages {
	const totalCalories = caloriesFromMacros(protein_g, carb_g, fat_g);
	if (totalCalories === 0) {
		return { protein: 0, carbs: 0, fat: 0 };
	}
	return {
		protein: ((protein_g * 4) / totalCalories) * 100,
		carbs: ((carb_g * 4) / totalCalories) * 100,
		fat: ((fat_g * 9) / totalCalories) * 100
	};
}

export function caloriesFromMacros(protein_g: number, carb_g: number, fat_g: number): number {
	return protein_g * 4 + carb_g * 4 + fat_g * 9;
}
