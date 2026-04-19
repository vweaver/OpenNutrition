const NUTRITION_SCHEMA = `{
  "product_name": string | null,
  "brand": string | null,
  "serving_size_text": string,
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
  "ingredients_text": string | null
}`;

export const SYSTEM_PROMPT = `You are a nutrition estimation engine. Your job is to estimate or extract nutritional information for foods and return it as JSON.

You may receive:
- A text description of a meal or food item (e.g. "four scrambled eggs with butter")
- A photo of a nutrition facts label
- A photo of food, a menu, a recipe, or a restaurant dish
- A combination of text and a photo

In all cases, estimate the nutritional values as accurately as possible and return valid JSON matching this schema. If a field cannot be determined, set it to null. Always return valid JSON and nothing else.

${NUTRITION_SCHEMA}`;

export function buildNaturalLanguagePrompt(description: string): string {
	return `Estimate the nutrition facts for the following and return JSON matching the schema.\n\n"${description}"`;
}

export function buildImagePrompt(description?: string): string {
	if (description?.trim()) {
		return `The user provided this image along with the following description: "${description.trim()}"\n\nExtract or estimate nutrition facts from the image and description. Return JSON matching the schema.`;
	}
	return 'Extract or estimate nutrition facts from this image. Return JSON matching the schema.';
}

export function buildRevisePrompt(current: unknown, instruction: string): string {
	return `The user has an existing food entry and wants to adjust it. Below is the current nutrition data as JSON, followed by the user's adjustment instruction. Return an updated JSON object matching the same schema, applying the requested adjustments and recalculating any affected nutrient values. Preserve fields that are not affected by the change. If a field is unknown, leave it null.

Current data:
${JSON.stringify(current, null, 2)}

Adjustment instruction: "${instruction}"`;
}
