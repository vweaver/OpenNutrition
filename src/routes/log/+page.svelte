<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { appState } from '$lib/stores/app.svelte';
	import { llmState } from '$lib/stores/llm.svelte';
	import { getFoods, createFood, createLogEntry, getRecentFoods, getFrequentFoods, getLastServings, getFoodById } from '$lib/db/queries';
	import { scanLabel } from '$lib/llm/client';
	import { formatDate } from '$lib/utils/dates';
	import type { Food } from '$lib/db/types';
	import type { NutritionData } from '$lib/llm/types';
	import NutritionForm from '$lib/components/NutritionForm.svelte';
	import CameraCapture from '$lib/components/CameraCapture.svelte';

	type Tab = 'search' | 'scan' | 'quick' | 'recent';

	// URL params
	let mealType = $derived(page.url.searchParams.get('meal') ?? 'snack');

	// Sync date from URL param if present (covers full-page navigations)
	const urlDate = page.url.searchParams.get('date');
	if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
		appState.selectedDate = urlDate;
	}

	// Tab state
	let activeTab = $state<Tab>('search');

	// ---------------------------------------------------------------------------
	// Search tab
	// ---------------------------------------------------------------------------
	let searchQuery = $state('');
	let searchResults = $state<Food[]>([]);
	let selectedFood = $state<Food | null>(null);
	let servingQty = $state(1.0);

	$effect(() => {
		if (searchQuery.length >= 2) {
			searchResults = getFoods(searchQuery);
		} else {
			searchResults = [];
		}
	});

	function selectFood(food: Food) {
		selectedFood = food;
		servingQty = 1.0;
	}

	function clearSelection() {
		selectedFood = null;
		servingQty = 1.0;
	}

	async function logFood(food: Food, qty: number, navigate = true) {
		await createLogEntry({
			user_id: appState.userId,
			food_id: food.id,
			meal_type: mealType,
			serving_quantity: qty,
			serving_size_g: food.serving_size_g,
			serving_unit: food.serving_unit,
			calories: Math.round(food.calories * qty),
			protein_g: Math.round(food.protein_g * qty * 10) / 10,
			carbs_g: Math.round(food.carbs_g * qty * 10) / 10,
			fat_g: Math.round(food.fat_g * qty * 10) / 10,
			logged_at: appState.selectedDate + ' 12:00:00'
		});
		if (navigate) goto(`${base}/`);
	}

	// ---------------------------------------------------------------------------
	// Scan tab
	// ---------------------------------------------------------------------------
	let showCamera = $state(false);
	let scanResult = $state<NutritionData | null>(null);
	let scanNullFields = $state<string[]>([]);
	let scanError = $state<string | null>(null);

	async function handleCapture(base64: string) {
		showCamera = false;
		llmState.scanning = true;
		llmState.error = null;
		scanError = null;

		try {
			const result = await scanLabel(llmState.config, base64);
			// Track which fields came back null from the LLM
			scanNullFields = Object.entries(result)
				.filter(([, v]) => v === null)
				.map(([k]) => k);
			scanResult = result;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			scanError = msg;
			llmState.error = msg;
		} finally {
			llmState.scanning = false;
		}
	}

	async function saveAndLogScan() {
		if (!scanResult) return;

		const food = await createFood({
			name: scanResult.product_name ?? 'Scanned Food',
			brand: scanResult.brand,
			serving_size_g: scanResult.serving_size_g ?? 100,
			serving_unit: scanResult.serving_size_text ?? 'serving',
			calories: scanResult.calories,
			protein_g: scanResult.protein_g ?? 0,
			carbs_g: scanResult.total_carbohydrate_g ?? 0,
			fat_g: scanResult.total_fat_g ?? 0,
			fiber_g: scanResult.dietary_fiber_g ?? null,
			sugar_g: scanResult.total_sugars_g ?? null,
			sodium_mg: scanResult.sodium_mg ?? null,
			barcode: scanResult.barcode,
			source: 'scan'
		});

		await logFood(food, 1.0);
	}

	// ---------------------------------------------------------------------------
	// Quick Add tab — multi-select from food library
	// ---------------------------------------------------------------------------
	let quickSearch = $state('');
	let quickFoods = $state<Food[]>([]);
	let checkedFoods = $state<Record<string, number>>({});
	let loggingAll = $state(false);

	$effect(() => {
		if (activeTab !== 'quick') return;
		if (quickSearch.length >= 1) {
			quickFoods = getFoods(quickSearch);
		} else if (appState.userId) {
			const recent = getRecentFoods(appState.userId, 30);
			const recentIds = new Set(recent.map((f) => f.id));
			const frequent = getFrequentFoods(appState.userId, 20).filter((f) => !recentIds.has(f.id));
			quickFoods = [...recent, ...frequent];
			if (quickFoods.length === 0) quickFoods = getFoods();
		} else {
			quickFoods = getFoods();
		}
	});

	let checkedIds = $derived(Object.keys(checkedFoods));
	let checkedCount = $derived(checkedIds.length);

	function toggleCheck(food: Food) {
		if (food.id in checkedFoods) {
			const { [food.id]: _, ...rest } = checkedFoods;
			checkedFoods = rest;
		} else {
			checkedFoods = { ...checkedFoods, [food.id]: 1 };
		}
	}

	function setCheckServings(foodId: string, qty: number) {
		checkedFoods = { ...checkedFoods, [foodId]: Math.max(0.1, qty) };
	}

	let checkedCalories = $derived(
		checkedIds.reduce((sum, id) => {
			const food = quickFoods.find((f) => f.id === id);
			return sum + (food ? Math.round(food.calories * (checkedFoods[id] ?? 1)) : 0);
		}, 0)
	);

	async function logAllChecked() {
		if (checkedCount === 0) return;
		loggingAll = true;
		for (const id of checkedIds) {
			const food = quickFoods.find((f) => f.id === id);
			if (food) await logFood(food, checkedFoods[id] ?? 1, false);
		}
		goto(`${base}/`);
	}

	// ---------------------------------------------------------------------------
	// Recent tab — tap to check, log button at bottom
	// ---------------------------------------------------------------------------
	let recentFoods = $state<Food[]>([]);
	let lastServings = $state<Record<string, number>>({});
	let recentChecked = $state<Record<string, number>>({});
	let recentLogging = $state(false);

	let recentCheckedIds = $derived(Object.keys(recentChecked));
	let recentCheckedCount = $derived(recentCheckedIds.length);

	$effect(() => {
		if (activeTab === 'recent' && appState.userId) {
			recentFoods = getRecentFoods(appState.userId, 30);
			lastServings = getLastServings(appState.userId);
		}
	});

	let recentCalories = $derived(
		recentCheckedIds.reduce((sum, id) => {
			const food = recentFoods.find((f) => f.id === id);
			return sum + (food ? Math.round(food.calories * (recentChecked[id] ?? 1)) : 0);
		}, 0)
	);

	function toggleRecentCheck(food: Food) {
		if (food.id in recentChecked) {
			const { [food.id]: _, ...rest } = recentChecked;
			recentChecked = rest;
		} else {
			recentChecked = { ...recentChecked, [food.id]: lastServings[food.id] ?? 1 };
		}
	}

	async function logAllRecent() {
		if (recentCheckedCount === 0) return;
		recentLogging = true;
		for (const id of recentCheckedIds) {
			const food = recentFoods.find((f) => f.id === id);
			if (food) await logFood(food, recentChecked[id] ?? 1, false);
		}
		goto(`${base}/`);
	}

	function clearRecentSelection() {
		recentChecked = {};
	}

	// Tab definitions
	const tabs: { id: Tab; label: string }[] = [
		{ id: 'search', label: 'Search' },
		{ id: 'scan', label: 'Scan Label' },
		{ id: 'quick', label: 'Quick Add' },
		{ id: 'recent', label: 'Recent' }
	];
</script>

<div class="mx-auto max-w-lg px-4 py-6">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-xl font-bold text-gray-900 dark:text-white">Log Food</h1>
			<p class="text-sm text-gray-500 dark:text-gray-400 capitalize">{mealType} &middot; {formatDate(appState.selectedDate)}</p>
		</div>
		<a
			href="{base}/"
			class="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
		>
			Cancel
		</a>
	</div>

	<!-- Tabs -->
	<div class="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
		{#each tabs as tab}
			<button
				onclick={() => activeTab = tab.id}
				class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors {activeTab === tab.id
					? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
					: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}"
			>
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Search Tab -->
	{#if activeTab === 'search'}
		<div class="space-y-4">
			{#if !selectedFood}
				<input
					type="text"
					placeholder="Search foods by name or brand..."
					bind:value={searchQuery}
					class="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
				/>
				{#if searchResults.length > 0}
					<ul class="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
						{#each searchResults as food}
							<li>
								<button
									onclick={() => selectFood(food)}
									class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
								>
									<div>
										<p class="text-sm font-medium text-gray-900 dark:text-white">{food.name}</p>
										{#if food.brand}
											<p class="text-xs text-gray-500 dark:text-gray-400">{food.brand}</p>
										{/if}
									</div>
									<span class="text-xs text-gray-400 dark:text-gray-500">{food.calories} cal</span>
								</button>
							</li>
						{/each}
					</ul>
				{:else if searchQuery.length >= 2}
					<p class="py-8 text-center text-sm text-gray-400 dark:text-gray-500">No foods found.</p>
				{/if}
			{:else}
				<!-- Serving selector -->
				<div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
					<div class="mb-4 flex items-center justify-between">
						<div>
							<p class="font-medium text-gray-900 dark:text-white">{selectedFood.name}</p>
							{#if selectedFood.brand}
								<p class="text-sm text-gray-500 dark:text-gray-400">{selectedFood.brand}</p>
							{/if}
						</div>
						<button onclick={clearSelection} class="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
							Change
						</button>
					</div>
					<div class="mb-4">
						<label for="search-serving" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
							Servings ({selectedFood.serving_unit})
						</label>
						<input
							id="search-serving"
							type="number"
							step="0.1"
							min="0.1"
							bind:value={servingQty}
							class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						/>
					</div>
					<div class="mb-4 grid grid-cols-4 gap-2 text-center text-xs text-gray-500 dark:text-gray-400">
						<div>
							<p class="text-lg font-bold text-gray-900 dark:text-white">{Math.round(selectedFood.calories * servingQty)}</p>
							<p>cal</p>
						</div>
						<div>
							<p class="text-lg font-bold text-gray-900 dark:text-white">{(selectedFood.protein_g * servingQty).toFixed(1)}</p>
							<p>protein</p>
						</div>
						<div>
							<p class="text-lg font-bold text-gray-900 dark:text-white">{(selectedFood.carbs_g * servingQty).toFixed(1)}</p>
							<p>carbs</p>
						</div>
						<div>
							<p class="text-lg font-bold text-gray-900 dark:text-white">{(selectedFood.fat_g * servingQty).toFixed(1)}</p>
							<p>fat</p>
						</div>
					</div>
					<button
						onclick={() => logFood(selectedFood!, servingQty)}
						class="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
					>
						Log
					</button>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Scan Label Tab -->
	{#if activeTab === 'scan'}
		<div class="space-y-4">
			{#if llmState.scanning}
				<!-- Loading spinner -->
				<div class="flex flex-col items-center justify-center gap-3 py-16">
					<div class="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-emerald-600 dark:border-gray-700 dark:border-t-emerald-400"></div>
					<p class="text-sm text-gray-500 dark:text-gray-400">Scanning nutrition label...</p>
				</div>
			{:else if scanResult}
				<!-- Editable nutrition form -->
				<NutritionForm bind:data={scanResult} nullFields={scanNullFields} />
				<button
					onclick={saveAndLogScan}
					class="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
				>
					Save & Log
				</button>
			{:else if showCamera}
				<CameraCapture oncapture={handleCapture} onclose={() => (showCamera = false)} />
			{:else}
				<!-- Initial state: prompt to open camera -->
				<div class="flex flex-col items-center gap-4 py-12">
					<div class="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
						<svg class="h-8 w-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
							<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
						</svg>
					</div>
					<p class="text-sm text-gray-600 dark:text-gray-300">Take a photo of a nutrition label</p>
					<button
						onclick={() => (showCamera = true)}
						class="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
					>
						Open Camera
					</button>
				</div>
				{#if scanError}
					<div class="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
						{scanError}
					</div>
				{/if}
			{/if}
		</div>
	{/if}

	<!-- Quick Add Tab -->
	{#if activeTab === 'quick'}
		<div class="space-y-3">
			<input
				type="text"
				bind:value={quickSearch}
				placeholder="Filter foods..."
				class="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
			/>

			{#if checkedCount > 0}
				<div class="flex items-center justify-between">
					<p class="text-sm text-gray-600 dark:text-gray-400">{checkedCount} selected</p>
					<button onclick={() => { checkedFoods = {}; }} class="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Clear</button>
				</div>
			{:else}
				<p class="text-xs text-gray-500 dark:text-gray-400">Tap items to select, then log them all at once.</p>
			{/if}

			{#if quickFoods.length > 0}
				<ul class="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
					{#each quickFoods as food (food.id)}
						{@const isChecked = food.id in checkedFoods}
						{@const qty = checkedFoods[food.id] ?? 1}
						<li>
							<button
								onclick={() => toggleCheck(food)}
								class="flex w-full items-center justify-between px-4 py-3 text-left select-none transition-colors
									{isChecked ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}"
							>
								<div class="flex items-center gap-3 min-w-0 flex-1">
									{#if isChecked}
										<svg class="shrink-0 h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
											<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
										</svg>
									{:else}
										<div class="shrink-0 h-5 w-5"></div>
									{/if}
									<div class="min-w-0">
										<p class="text-sm font-medium text-gray-900 dark:text-white truncate">{food.name}</p>
										{#if food.brand}
											<p class="text-xs text-gray-500 dark:text-gray-400 truncate">{food.brand}</p>
										{/if}
									</div>
								</div>
								<div class="shrink-0 text-right ml-2">
									<span class="text-xs text-gray-400 dark:text-gray-500">{Math.round(food.calories * qty)} cal</span>
									<p class="text-xs text-gray-400 dark:text-gray-500">{qty} serving{qty !== 1 ? 's' : ''}</p>
								</div>
							</button>
						</li>
						{#if isChecked}
							<li class="flex items-center gap-2 px-4 py-2 bg-emerald-50/50 dark:bg-emerald-900/10">
								<span class="text-xs text-gray-600 dark:text-gray-400">Servings</span>
								<input
									type="number"
									step="0.1"
									min="0.1"
									value={qty}
									oninput={(e) => setCheckServings(food.id, Number((e.target as HTMLInputElement).value))}
									class="w-16 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-white"
								/>
								<span class="text-xs text-gray-500 dark:text-gray-400">
									= {Math.round(food.calories * qty)} cal
								</span>
							</li>
						{/if}
					{/each}
				</ul>
			{:else}
				<p class="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
					No foods in your library yet. Add some via the Foods tab.
				</p>
			{/if}

			<!-- Log button -->
			<div class="rounded-xl bg-emerald-600 p-3 shadow-lg">
				{#if checkedCount > 0}
					<div class="flex items-center justify-between text-white text-sm mb-2">
						<span>{checkedCount} item{checkedCount === 1 ? '' : 's'}</span>
						<span class="font-bold">{checkedCalories} cal total</span>
					</div>
				{/if}
				<button
					onclick={logAllChecked}
					disabled={loggingAll || checkedCount === 0}
					class="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{#if loggingAll}
						Logging...
					{:else if checkedCount === 0}
						Select foods to log
					{:else}
						Log {checkedCount} item{checkedCount === 1 ? '' : 's'}
					{/if}
				</button>
			</div>
		</div>
	{/if}

	<!-- Recent Tab -->
	{#if activeTab === 'recent'}
		<div class="space-y-3">
			{#if recentCheckedCount > 0}
				<div class="flex items-center justify-between">
					<p class="text-sm text-gray-600 dark:text-gray-400">{recentCheckedCount} selected</p>
					<button onclick={clearRecentSelection} class="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Clear</button>
				</div>
			{:else}
				<p class="text-xs text-gray-500 dark:text-gray-400">Tap items to select, then log them all at once.</p>
			{/if}

			{#if recentFoods.length > 0}
				<ul class="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
					{#each recentFoods as food (food.id)}
						{@const isChecked = food.id in recentChecked}
						{@const qty = recentChecked[food.id] ?? lastServings[food.id] ?? 1}
						<li>
							<button
								onclick={() => toggleRecentCheck(food)}
								class="flex w-full items-center justify-between px-4 py-3 text-left select-none transition-colors
									{isChecked ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}"
							>
								<div class="flex items-center gap-3 min-w-0 flex-1">
									{#if isChecked}
										<svg class="shrink-0 h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
											<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
										</svg>
									{:else}
										<div class="shrink-0 h-5 w-5"></div>
									{/if}
									<div class="min-w-0">
										<p class="text-sm font-medium text-gray-900 dark:text-white truncate">{food.name}</p>
										{#if food.brand}
											<p class="text-xs text-gray-500 dark:text-gray-400 truncate">{food.brand}</p>
										{/if}
									</div>
								</div>
								<div class="shrink-0 text-right ml-2">
									<span class="text-xs text-gray-400 dark:text-gray-500">{Math.round(food.calories * qty)} cal</span>
									<p class="text-xs text-gray-400 dark:text-gray-500">{qty} serving{qty !== 1 ? 's' : ''}</p>
								</div>
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="py-12 text-center text-sm text-gray-400 dark:text-gray-500">No recent foods yet.</p>
			{/if}

			<!-- Log button — always visible -->
			<div class="rounded-xl bg-emerald-600 p-3 shadow-lg">
				{#if recentCheckedCount > 0}
					<div class="flex items-center justify-between text-white text-sm mb-2">
						<span>{recentCheckedCount} item{recentCheckedCount === 1 ? '' : 's'}</span>
						<span class="font-bold">{recentCalories} cal total</span>
					</div>
				{/if}
				<button
					onclick={logAllRecent}
					disabled={recentLogging || recentCheckedCount === 0}
					class="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{#if recentLogging}
						Logging...
					{:else if recentCheckedCount === 0}
						Select foods to log
					{:else}
						Log {recentCheckedCount} item{recentCheckedCount === 1 ? '' : 's'}
					{/if}
				</button>
			</div>
		</div>
	{/if}
</div>
