/**
 * System prompt for nutrition label scanning via vision model.
 * Copied from PRD section 2.3.2.
 */
export const LABEL_SCAN_SYSTEM_PROMPT = `You are a nutrition data extraction engine. Given a photo of a nutrition facts label, extract ALL fields into the following JSON schema. If a field is not visible or not applicable, set it to null. Always return valid JSON and nothing else.

{
  "product_name": string | null,
  "brand": string | null,
  "serving_size_text": string,        // e.g. "2/3 cup (55g)"
  "serving_size_g": number | null,
  "serving_size_ml": number | null,
  "servings_per_container": number | null,
  "calories": number,
  "total_fat_g": number | null,
  "saturated_fat_g": number | null,
  "trans_fat_g": number | null,
  "polyunsaturated_fat_g": number | null,
  "monounsaturated_fat_g": number | null,
  "cholesterol_mg": number | null,
  "sodium_mg": number | null,
  "total_carbohydrate_g": number | null,
  "dietary_fiber_g": number | null,
  "total_sugars_g": number | null,
  "added_sugars_g": number | null,
  "sugar_alcohols_g": number | null,
  "protein_g": number | null,
  "vitamin_d_mcg": number | null,
  "calcium_mg": number | null,
  "iron_mg": number | null,
  "potassium_mg": number | null,
  "vitamin_a_mcg": number | null,
  "vitamin_c_mg": number | null,
  "barcode": string | null,
  "ingredients_text": string | null,
  "allergens": string[] | null
}`;

/**
 * Build a prompt for natural language food description parsing.
 * The LLM should extract nutrition data from a free-text description
 * (e.g. "a large apple" or "two scrambled eggs with cheese").
 */
export function buildNaturalLanguagePrompt(description: string): string {
	return `The user described a food item they consumed. Based on your nutritional knowledge, estimate the nutrition facts for the following description and return the data as JSON matching the schema above. Use your best estimate for portion sizes and nutrient values. If you cannot estimate a field, set it to null.

Food description: "${description}"`;
}
