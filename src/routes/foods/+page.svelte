<script lang="ts">
	import { onMount } from 'svelte';
	import { getFoods, createFood, deleteFood } from '$lib/db/queries';
	import { llmState } from '$lib/stores/llm.svelte';
	import { scanLabel } from '$lib/llm/client';
	import type { Food } from '$lib/db/types';
	import type { NutritionData } from '$lib/llm/types';
	import NutritionForm from '$lib/components/NutritionForm.svelte';
	import CameraCapture from '$lib/components/CameraCapture.svelte';

	let foods = $state<Food[]>([]);
	let searchQuery = $state('');
	let expandedId = $state<string | null>(null);
	let showAddForm = $state(false);
	let saving = $state(false);

	// Scan state
	let showScan = $state(false);
	let showCamera = $state(false);
	let scanError = $state<string | null>(null);
	let scanNullFields = $state<string[]>([]);

	let filteredFoods = $derived.by(() => {
		if (!searchQuery.trim()) return foods;
		const q = searchQuery.toLowerCase();
		return foods.filter(
			(f) =>
				f.name.toLowerCase().includes(q) ||
				(f.brand && f.brand.toLowerCase().includes(q))
		);
	});

	// New food form data (using NutritionData shape)
	let newFoodData = $state<NutritionData>(emptyNutritionData());

	function emptyNutritionData(): NutritionData {
		return {
			product_name: null,
			brand: null,
			serving_size_text: '',
			serving_size_g: null,
			serving_size_ml: null,
			servings_per_container: null,
			calories: 0,
			total_fat_g: null,
			saturated_fat_g: null,
			trans_fat_g: null,
			polyunsaturated_fat_g: null,
			monounsaturated_fat_g: null,
			cholesterol_mg: null,
			sodium_mg: null,
			total_carbohydrate_g: null,
			dietary_fiber_g: null,
			total_sugars_g: null,
			added_sugars_g: null,
			sugar_alcohols_g: null,
			protein_g: null,
			vitamin_d_mcg: null,
			calcium_mg: null,
			iron_mg: null,
			potassium_mg: null,
			vitamin_a_mcg: null,
			vitamin_c_mg: null,
			barcode: null,
			ingredients_text: null,
			allergens: null
		};
	}

	function loadFoods() {
		foods = getFoods();
	}

	function toggleExpand(id: string) {
		expandedId = expandedId === id ? null : id;
	}

	async function handleDelete(id: string) {
		if (!confirm('Delete this food? It will be removed from your food list.')) return;
		await deleteFood(id);
		loadFoods();
		if (expandedId === id) expandedId = null;
	}

	async function handleCapture(base64: string) {
		showCamera = false;
		scanError = null;
		if (!llmState.config.apiKey && llmState.config.provider !== 'ollama') {
			scanError = 'Configure an LLM API key in Settings first.';
			return;
		}
		llmState.scanning = true;
		try {
			const result = await scanLabel(llmState.config, base64);
			scanNullFields = Object.entries(result)
				.filter(([, v]) => v === null)
				.map(([k]) => k);
			newFoodData = result;
		} catch (err) {
			scanError = err instanceof Error ? err.message : 'Scan failed';
		} finally {
			llmState.scanning = false;
		}
	}

	async function handleAddFood() {
		if (!newFoodData.product_name?.trim()) {
			alert('Please enter a food name.');
			return;
		}
		saving = true;
		try {
			await createFood({
				name: newFoodData.product_name.trim(),
				brand: newFoodData.brand ?? null,
				serving_size_g: newFoodData.serving_size_g ?? 100,
				serving_unit: newFoodData.serving_size_text || 'g',
				calories: newFoodData.calories ?? 0,
				protein_g: newFoodData.protein_g ?? 0,
				carbs_g: newFoodData.total_carbohydrate_g ?? 0,
				fat_g: newFoodData.total_fat_g ?? 0,
				fiber_g: newFoodData.dietary_fiber_g ?? null,
				sugar_g: newFoodData.total_sugars_g ?? null,
				sodium_mg: newFoodData.sodium_mg ?? null,
				barcode: newFoodData.barcode ?? null,
				source: 'manual'
			});
			newFoodData = emptyNutritionData();
			showAddForm = false;
			showScan = false;
			loadFoods();
		} catch (err) {
			console.error('Failed to create food:', err);
			alert('Failed to save food.');
		} finally {
			saving = false;
		}
	}

	onMount(() => {
		loadFoods();
	});

	const inputClass =
		'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';
	const btnPrimary =
		'inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
	const btnSecondary =
		'inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors';
	const btnDanger =
		'inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors';
</script>

<svelte:head>
	<title>My Foods - OpenNutrition</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-6 space-y-4">
	<div class="flex items-center justify-between gap-2 flex-wrap">
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white">My Foods</h1>
		<div class="flex gap-2">
			<button
				type="button"
				class={btnSecondary}
				onclick={() => {
					showScan = !showScan;
					showAddForm = false;
					scanError = null;
					if (showScan) {
						newFoodData = emptyNutritionData();
						showCamera = true;
					}
				}}
			>
				{showScan ? 'Cancel' : '📷 Scan Label'}
			</button>
			<button
				type="button"
				class={btnPrimary}
				onclick={() => {
					showAddForm = !showAddForm;
					showScan = false;
					if (showAddForm) newFoodData = emptyNutritionData();
				}}
			>
				{showAddForm ? 'Cancel' : '+ Add Food'}
			</button>
		</div>
	</div>

	<!-- Scan Label Flow -->
	{#if showScan}
		<div class="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-800 p-5 space-y-4">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Scan Nutrition Label</h2>

			{#if llmState.scanning}
				<div class="flex flex-col items-center py-8 gap-3">
					<div class="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-500"></div>
					<p class="text-sm text-gray-500 dark:text-gray-400">Scanning nutrition label...</p>
				</div>
			{:else if showCamera}
				<CameraCapture oncapture={handleCapture} onclose={() => { showCamera = false; showScan = false; }} />
			{:else if newFoodData.calories > 0 || newFoodData.product_name}
				<p class="text-xs text-gray-500 dark:text-gray-400">Review the extracted data and edit as needed. Yellow-highlighted fields were missing from the label.</p>
				<NutritionForm bind:data={newFoodData} nullFields={scanNullFields} />
				<div class="flex gap-3 pt-2">
					<button type="button" class={btnPrimary} disabled={saving} onclick={handleAddFood}>
						{saving ? 'Saving...' : 'Save Food'}
					</button>
					<button type="button" class={btnSecondary} onclick={() => { showCamera = true; newFoodData = emptyNutritionData(); }}>
						Rescan
					</button>
				</div>
			{:else}
				<button type="button" class={btnPrimary} onclick={() => (showCamera = true)}>Open Camera</button>
			{/if}

			{#if scanError}
				<div class="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
					<p class="text-sm text-red-700 dark:text-red-300">{scanError}</p>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Add Food Form -->
	{#if showAddForm}
		<div class="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-800 p-5 space-y-4">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Add Food Manually</h2>
			<NutritionForm bind:data={newFoodData} />
			<div class="flex gap-3 pt-2">
				<button type="button" class={btnPrimary} disabled={saving} onclick={handleAddFood}>
					{saving ? 'Saving...' : 'Save Food'}
				</button>
				<button
					type="button"
					class={btnSecondary}
					onclick={() => {
						showAddForm = false;
						newFoodData = emptyNutritionData();
					}}
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}

	<!-- Search -->
	<div class="relative">
		<svg
			class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
		</svg>
		<input
			type="text"
			bind:value={searchQuery}
			placeholder="Search foods..."
			class="{inputClass} pl-10"
		/>
	</div>

	<!-- Food List -->
	{#if filteredFoods.length === 0}
		<div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center">
			{#if foods.length === 0}
				<p class="text-gray-500 dark:text-gray-400">No foods yet. Add your first food above!</p>
			{:else}
				<p class="text-gray-500 dark:text-gray-400">No foods match "{searchQuery}"</p>
			{/if}
		</div>
	{:else}
		<div class="space-y-2">
			{#each filteredFoods as food (food.id)}
				<div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
					<!-- Food summary row -->
					<button
						type="button"
						class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
						onclick={() => toggleExpand(food.id)}
					>
						<div class="min-w-0 flex-1">
							<div class="flex items-baseline gap-2">
								<span class="font-medium text-gray-900 dark:text-white truncate">{food.name}</span>
								{#if food.brand}
									<span class="text-xs text-gray-500 dark:text-gray-400 truncate">{food.brand}</span>
								{/if}
							</div>
							<div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
								{food.calories} kcal per {food.serving_size_g}{food.serving_unit}
							</div>
						</div>
						<svg
							class="ml-2 h-4 w-4 flex-shrink-0 text-gray-400 transition-transform {expandedId === food.id ? 'rotate-180' : ''}"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
						</svg>
					</button>

					<!-- Expanded details -->
					{#if expandedId === food.id}
						<div class="border-t border-gray-200 dark:border-gray-700 px-4 py-3 space-y-3">
							<div class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
								<div class="flex justify-between">
									<span class="text-gray-500 dark:text-gray-400">Calories</span>
									<span class="font-medium text-gray-900 dark:text-white">{food.calories} kcal</span>
								</div>
								<div class="flex justify-between">
									<span class="text-gray-500 dark:text-gray-400">Protein</span>
									<span class="font-medium text-gray-900 dark:text-white">{food.protein_g}g</span>
								</div>
								<div class="flex justify-between">
									<span class="text-gray-500 dark:text-gray-400">Carbs</span>
									<span class="font-medium text-gray-900 dark:text-white">{food.carbs_g}g</span>
								</div>
								<div class="flex justify-between">
									<span class="text-gray-500 dark:text-gray-400">Fat</span>
									<span class="font-medium text-gray-900 dark:text-white">{food.fat_g}g</span>
								</div>
								{#if food.fiber_g !== null}
									<div class="flex justify-between">
										<span class="text-gray-500 dark:text-gray-400">Fiber</span>
										<span class="font-medium text-gray-900 dark:text-white">{food.fiber_g}g</span>
									</div>
								{/if}
								{#if food.sugar_g !== null}
									<div class="flex justify-between">
										<span class="text-gray-500 dark:text-gray-400">Sugar</span>
										<span class="font-medium text-gray-900 dark:text-white">{food.sugar_g}g</span>
									</div>
								{/if}
								{#if food.sodium_mg !== null}
									<div class="flex justify-between">
										<span class="text-gray-500 dark:text-gray-400">Sodium</span>
										<span class="font-medium text-gray-900 dark:text-white">{food.sodium_mg}mg</span>
									</div>
								{/if}
							</div>

							<div class="text-xs text-gray-400 dark:text-gray-500">
								Serving: {food.serving_size_g}{food.serving_unit}
								{#if food.barcode}
									&middot; Barcode: {food.barcode}
								{/if}
								&middot; Source: {food.source}
							</div>

							<div class="flex justify-end">
								<button type="button" class={btnDanger} onclick={() => handleDelete(food.id)}>
									Delete
								</button>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
