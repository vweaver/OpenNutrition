export type LLMProvider = 'openrouter' | 'ollama' | 'openai' | 'anthropic';

export interface LLMConfig {
	provider: LLMProvider;
	apiKey: string;
	baseUrl?: string; // custom endpoint URL
	model: string; // model name/id
}

export interface NutritionData {
	product_name: string | null;
	brand: string | null;
	serving_size_text: string;
	serving_size_g: number | null;
	serving_size_ml: number | null;
	servings_per_container: number | null;
	calories: number;
	total_fat_g: number | null;
	saturated_fat_g: number | null;
	trans_fat_g: number | null;
	polyunsaturated_fat_g: number | null;
	monounsaturated_fat_g: number | null;
	cholesterol_mg: number | null;
	sodium_mg: number | null;
	total_carbohydrate_g: number | null;
	dietary_fiber_g: number | null;
	total_sugars_g: number | null;
	added_sugars_g: number | null;
	sugar_alcohols_g: number | null;
	protein_g: number | null;
	vitamin_d_mcg: number | null;
	calcium_mg: number | null;
	iron_mg: number | null;
	potassium_mg: number | null;
	vitamin_a_mcg: number | null;
	vitamin_c_mg: number | null;
	barcode: string | null;
	ingredients_text: string | null;
	allergens: string[] | null;
}

export interface LLMResponse {
	data: NutritionData;
	raw?: string;
}
