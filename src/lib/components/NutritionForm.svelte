<script lang="ts">
	import type { NutritionData } from '$lib/llm/types';

	let {
		data = $bindable(),
		nullFields = []
	}: {
		data: NutritionData;
		nullFields?: string[];
	} = $props();

	function isNullField(field: string): boolean {
		return nullFields.includes(field);
	}

	function numVal(field: keyof NutritionData): number | string {
		const v = data[field];
		if (v === null || v === undefined) return '';
		return v as number;
	}

	function setNum(field: keyof NutritionData, e: Event) {
		const input = e.target as HTMLInputElement;
		const val = input.value === '' ? null : Number(input.value);
		(data as Record<string, unknown>)[field] = val;
	}

	function setStr(field: keyof NutritionData, e: Event) {
		const input = e.target as HTMLInputElement;
		(data as Record<string, unknown>)[field] = input.value || null;
	}

	const inputBase =
		'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';
	const nullHighlight = 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-600';

	function fieldClass(field: string): string {
		return isNullField(field) ? `${inputBase} ${nullHighlight}` : inputBase;
	}
</script>

<div class="space-y-5">
	<!-- Basic Info -->
	<section>
		<h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
			Basic Info
		</h3>
		<div class="grid grid-cols-1 gap-3">
			<div>
				<label for="nf-product-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Name</label>
				<input
					id="nf-product-name"
					type="text"
					value={data.product_name ?? ''}
					oninput={(e) => setStr('product_name', e)}
					placeholder="--"
					class={fieldClass('product_name')}
				/>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label for="nf-brand" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Brand</label>
					<input
						id="nf-brand"
						type="text"
						value={data.brand ?? ''}
						oninput={(e) => setStr('brand', e)}
						placeholder="--"
						class={fieldClass('brand')}
					/>
				</div>
				<div>
					<label for="nf-barcode" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Barcode</label>
					<input
						id="nf-barcode"
						type="text"
						value={data.barcode ?? ''}
						oninput={(e) => setStr('barcode', e)}
						placeholder="--"
						class={fieldClass('barcode')}
					/>
				</div>
			</div>
		</div>
	</section>

	<!-- Serving -->
	<section>
		<h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
			Serving
		</h3>
		<div class="grid grid-cols-2 gap-3">
			<div class="col-span-2">
				<label for="nf-serving-text" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Serving Size Text</label>
				<input
					id="nf-serving-text"
					type="text"
					value={data.serving_size_text ?? ''}
					oninput={(e) => setStr('serving_size_text', e)}
					placeholder="--"
					class={fieldClass('serving_size_text')}
				/>
			</div>
			<div>
				<label for="nf-serving-g" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Grams (g)</label>
				<input
					id="nf-serving-g"
					type="number"
					value={numVal('serving_size_g')}
					oninput={(e) => setNum('serving_size_g', e)}
					placeholder="--"
					class={fieldClass('serving_size_g')}
				/>
			</div>
			<div>
				<label for="nf-serving-ml" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Milliliters (ml)</label>
				<input
					id="nf-serving-ml"
					type="number"
					value={numVal('serving_size_ml')}
					oninput={(e) => setNum('serving_size_ml', e)}
					placeholder="--"
					class={fieldClass('serving_size_ml')}
				/>
			</div>
			<div>
				<label for="nf-servings-container" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Servings/Container</label>
				<input
					id="nf-servings-container"
					type="number"
					value={numVal('servings_per_container')}
					oninput={(e) => setNum('servings_per_container', e)}
					placeholder="--"
					class={fieldClass('servings_per_container')}
				/>
			</div>
		</div>
	</section>

	<!-- Calories -->
	<section>
		<h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
			Calories
		</h3>
		<div>
			<label for="nf-calories" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Calories</label>
			<input
				id="nf-calories"
				type="number"
				value={numVal('calories')}
				oninput={(e) => setNum('calories', e)}
				placeholder="--"
				class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-lg font-bold text-gray-900 dark:text-white placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 {isNullField('calories') ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-600' : ''}"
			/>
		</div>
	</section>

	<!-- Fats -->
	<section>
		<h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
			Fats
		</h3>
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label for="nf-total-fat" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Fat (g)</label>
				<input id="nf-total-fat" type="number" step="0.1" value={numVal('total_fat_g')} oninput={(e) => setNum('total_fat_g', e)} placeholder="--" class={fieldClass('total_fat_g')} />
			</div>
			<div>
				<label for="nf-sat-fat" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Saturated (g)</label>
				<input id="nf-sat-fat" type="number" step="0.1" value={numVal('saturated_fat_g')} oninput={(e) => setNum('saturated_fat_g', e)} placeholder="--" class={fieldClass('saturated_fat_g')} />
			</div>
			<div>
				<label for="nf-trans-fat" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trans (g)</label>
				<input id="nf-trans-fat" type="number" step="0.1" value={numVal('trans_fat_g')} oninput={(e) => setNum('trans_fat_g', e)} placeholder="--" class={fieldClass('trans_fat_g')} />
			</div>
			<div>
				<label for="nf-poly-fat" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Polyunsaturated (g)</label>
				<input id="nf-poly-fat" type="number" step="0.1" value={numVal('polyunsaturated_fat_g')} oninput={(e) => setNum('polyunsaturated_fat_g', e)} placeholder="--" class={fieldClass('polyunsaturated_fat_g')} />
			</div>
			<div>
				<label for="nf-mono-fat" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Monounsaturated (g)</label>
				<input id="nf-mono-fat" type="number" step="0.1" value={numVal('monounsaturated_fat_g')} oninput={(e) => setNum('monounsaturated_fat_g', e)} placeholder="--" class={fieldClass('monounsaturated_fat_g')} />
			</div>
		</div>
	</section>

	<!-- Carbs -->
	<section>
		<h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
			Carbohydrates
		</h3>
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label for="nf-total-carb" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Carbs (g)</label>
				<input id="nf-total-carb" type="number" step="0.1" value={numVal('total_carbohydrate_g')} oninput={(e) => setNum('total_carbohydrate_g', e)} placeholder="--" class={fieldClass('total_carbohydrate_g')} />
			</div>
			<div>
				<label for="nf-fiber" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fiber (g)</label>
				<input id="nf-fiber" type="number" step="0.1" value={numVal('dietary_fiber_g')} oninput={(e) => setNum('dietary_fiber_g', e)} placeholder="--" class={fieldClass('dietary_fiber_g')} />
			</div>
			<div>
				<label for="nf-sugars" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Sugars (g)</label>
				<input id="nf-sugars" type="number" step="0.1" value={numVal('total_sugars_g')} oninput={(e) => setNum('total_sugars_g', e)} placeholder="--" class={fieldClass('total_sugars_g')} />
			</div>
			<div>
				<label for="nf-added-sugars" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Added Sugars (g)</label>
				<input id="nf-added-sugars" type="number" step="0.1" value={numVal('added_sugars_g')} oninput={(e) => setNum('added_sugars_g', e)} placeholder="--" class={fieldClass('added_sugars_g')} />
			</div>
			<div>
				<label for="nf-sugar-alcohols" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sugar Alcohols (g)</label>
				<input id="nf-sugar-alcohols" type="number" step="0.1" value={numVal('sugar_alcohols_g')} oninput={(e) => setNum('sugar_alcohols_g', e)} placeholder="--" class={fieldClass('sugar_alcohols_g')} />
			</div>
		</div>
	</section>

	<!-- Protein -->
	<section>
		<h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
			Protein
		</h3>
		<div>
			<label for="nf-protein" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Protein (g)</label>
			<input id="nf-protein" type="number" step="0.1" value={numVal('protein_g')} oninput={(e) => setNum('protein_g', e)} placeholder="--" class={fieldClass('protein_g')} />
		</div>
	</section>

	<!-- Minerals & Vitamins -->
	<section>
		<h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
			Minerals & Vitamins
		</h3>
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label for="nf-cholesterol" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cholesterol (mg)</label>
				<input id="nf-cholesterol" type="number" step="0.1" value={numVal('cholesterol_mg')} oninput={(e) => setNum('cholesterol_mg', e)} placeholder="--" class={fieldClass('cholesterol_mg')} />
			</div>
			<div>
				<label for="nf-sodium" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sodium (mg)</label>
				<input id="nf-sodium" type="number" step="0.1" value={numVal('sodium_mg')} oninput={(e) => setNum('sodium_mg', e)} placeholder="--" class={fieldClass('sodium_mg')} />
			</div>
			<div>
				<label for="nf-vitamin-d" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vitamin D (mcg)</label>
				<input id="nf-vitamin-d" type="number" step="0.1" value={numVal('vitamin_d_mcg')} oninput={(e) => setNum('vitamin_d_mcg', e)} placeholder="--" class={fieldClass('vitamin_d_mcg')} />
			</div>
			<div>
				<label for="nf-calcium" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Calcium (mg)</label>
				<input id="nf-calcium" type="number" step="0.1" value={numVal('calcium_mg')} oninput={(e) => setNum('calcium_mg', e)} placeholder="--" class={fieldClass('calcium_mg')} />
			</div>
			<div>
				<label for="nf-iron" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Iron (mg)</label>
				<input id="nf-iron" type="number" step="0.1" value={numVal('iron_mg')} oninput={(e) => setNum('iron_mg', e)} placeholder="--" class={fieldClass('iron_mg')} />
			</div>
			<div>
				<label for="nf-potassium" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Potassium (mg)</label>
				<input id="nf-potassium" type="number" step="0.1" value={numVal('potassium_mg')} oninput={(e) => setNum('potassium_mg', e)} placeholder="--" class={fieldClass('potassium_mg')} />
			</div>
			<div>
				<label for="nf-vitamin-a" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vitamin A (mcg)</label>
				<input id="nf-vitamin-a" type="number" step="0.1" value={numVal('vitamin_a_mcg')} oninput={(e) => setNum('vitamin_a_mcg', e)} placeholder="--" class={fieldClass('vitamin_a_mcg')} />
			</div>
			<div>
				<label for="nf-vitamin-c" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vitamin C (mg)</label>
				<input id="nf-vitamin-c" type="number" step="0.1" value={numVal('vitamin_c_mg')} oninput={(e) => setNum('vitamin_c_mg', e)} placeholder="--" class={fieldClass('vitamin_c_mg')} />
			</div>
		</div>
	</section>

	<!-- Other -->
	<section>
		<h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
			Other
		</h3>
		<div class="space-y-3">
			<div>
				<label for="nf-ingredients" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ingredients</label>
				<textarea
					id="nf-ingredients"
					value={data.ingredients_text ?? ''}
					oninput={(e) => {
						const target = e.target as HTMLTextAreaElement;
						data.ingredients_text = target.value || null;
					}}
					placeholder="--"
					rows={3}
					class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 {isNullField('ingredients_text') ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-600' : ''}"
				></textarea>
			</div>
			<div>
				<label for="nf-allergens" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Allergens (comma-separated)</label>
				<input
					id="nf-allergens"
					type="text"
					value={data.allergens?.join(', ') ?? ''}
					oninput={(e) => {
						const target = e.target as HTMLInputElement;
						const val = target.value.trim();
						data.allergens = val ? val.split(',').map((s) => s.trim()) : null;
					}}
					placeholder="--"
					class={fieldClass('allergens')}
				/>
			</div>
		</div>
	</section>
</div>
