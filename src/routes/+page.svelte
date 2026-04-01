<script lang="ts">
	import { getLogByDate, getProfile, getWaterByDate, addWater, deleteLogEntry, deleteWater } from '$lib/db/queries';
	import { appState } from '$lib/stores/app.svelte';
	import { formatDate, isToday, today } from '$lib/utils/dates';
	import { sumNutrition, scaleNutrition } from '$lib/utils/nutrition';
	import type { UserProfile, FoodLog, WaterLog } from '$lib/db/types';

	// ---------------------------------------------------------------------------
	// State
	// ---------------------------------------------------------------------------

	let profile = $state<UserProfile | null>(null);
	let logEntries = $state<FoodLog[]>([]);
	let waterEntries = $state<WaterLog[]>([]);
	let expandedMeals = $state<Record<string, boolean>>({ breakfast: true, lunch: true, dinner: true, snack: true });
	let customWaterAmount = $state('');
	let showCustomWater = $state(false);

	// ---------------------------------------------------------------------------
	// Load data reactively
	// ---------------------------------------------------------------------------

	$effect(() => {
		if (!appState.dbReady) return;
		profile = getProfile();
	});

	$effect(() => {
		if (!appState.dbReady || !appState.userId) return;
		const date = appState.selectedDate;
		logEntries = getLogByDate(appState.userId, date);
		waterEntries = getWaterByDate(appState.userId, date);
	});

	// ---------------------------------------------------------------------------
	// Derived values
	// ---------------------------------------------------------------------------

	const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

	let entriesByMeal = $derived(
		mealTypes.reduce<Record<string, FoodLog[]>>((acc, meal) => {
			acc[meal] = logEntries.filter((e) => e.meal_type === meal);
			return acc;
		}, {})
	);

	let mealTotals = $derived(
		mealTypes.reduce<Record<string, ReturnType<typeof sumNutrition>>>((acc, meal) => {
			acc[meal] = sumNutrition(entriesByMeal[meal] ?? []);
			return acc;
		}, {})
	);

	let dayTotals = $derived(sumNutrition(logEntries));

	let calorieTarget = $derived(profile?.calorie_target ?? 2000);
	let proteinTarget = $derived(profile?.protein_target_g ?? 150);
	let carbTarget = $derived(profile?.carb_target_g ?? 250);
	let fatTarget = $derived(profile?.fat_target_g ?? 65);
	let waterTarget = $derived(profile?.water_target_ml ?? 2500);

	let caloriePercent = $derived(calorieTarget > 0 ? (dayTotals.calories / calorieTarget) * 100 : 0);
	let totalWaterMl = $derived(waterEntries.reduce((sum, w) => sum + w.amount_ml, 0));

	let remainingCalories = $derived(Math.max(0, calorieTarget - dayTotals.calories));
	let remainingProtein = $derived(Math.max(0, proteinTarget - dayTotals.protein_g));

	// SVG ring calculations
	const ringRadius = 70;
	const ringCircumference = 2 * Math.PI * ringRadius;
	let ringOffset = $derived(ringCircumference - (Math.min(caloriePercent, 100) / 100) * ringCircumference);

	let ringColor = $derived(
		caloriePercent > 100 ? 'text-red-500' : caloriePercent >= 80 ? 'text-yellow-500' : 'text-green-500'
	);
	let ringStrokeColor = $derived(
		caloriePercent > 100 ? '#ef4444' : caloriePercent >= 80 ? '#eab308' : '#22c55e'
	);

	// ---------------------------------------------------------------------------
	// Date navigation
	// ---------------------------------------------------------------------------

	function shiftDate(days: number) {
		const d = new Date(appState.selectedDate + 'T00:00:00');
		d.setDate(d.getDate() + days);
		appState.selectedDate = d.toISOString().split('T')[0];
	}

	let dateLabel = $derived(
		isToday(appState.selectedDate)
			? 'Today'
			: (() => {
					const yesterday = new Date();
					yesterday.setDate(yesterday.getDate() - 1);
					const tomorrow = new Date();
					tomorrow.setDate(tomorrow.getDate() + 1);
					const sel = appState.selectedDate;
					if (sel === yesterday.toISOString().split('T')[0]) return 'Yesterday';
					if (sel === tomorrow.toISOString().split('T')[0]) return 'Tomorrow';
					return formatDate(sel);
				})()
	);

	// ---------------------------------------------------------------------------
	// Actions
	// ---------------------------------------------------------------------------

	function toggleMeal(meal: string) {
		expandedMeals[meal] = !expandedMeals[meal];
	}

	async function handleDeleteEntry(id: string) {
		await deleteLogEntry(id);
		logEntries = getLogByDate(appState.userId, appState.selectedDate);
	}

	async function handleAddWater(ml: number) {
		if (ml <= 0) return;
		await addWater({
			user_id: appState.userId,
			amount_ml: ml,
			logged_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
		});
		waterEntries = getWaterByDate(appState.userId, appState.selectedDate);
		customWaterAmount = '';
		showCustomWater = false;
	}

	async function handleDeleteWater(id: string) {
		await deleteWater(id);
		waterEntries = getWaterByDate(appState.userId, appState.selectedDate);
	}

	function mealLabel(meal: string): string {
		return meal.charAt(0).toUpperCase() + meal.slice(1);
	}

	function macroBarPercent(consumed: number, target: number): number {
		if (target <= 0) return 0;
		return Math.min((consumed / target) * 100, 100);
	}
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
	<!-- ================================================================== -->
	<!-- Date Selector                                                      -->
	<!-- ================================================================== -->
	<div class="sticky top-0 z-10 bg-white dark:bg-gray-800 shadow-sm">
		<div class="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
			<button
				onclick={() => shiftDate(-1)}
				class="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
				aria-label="Previous day"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
			</button>

			<button
				onclick={() => (appState.selectedDate = today())}
				class="text-center"
			>
				<span class="text-lg font-semibold text-gray-900 dark:text-white">{dateLabel}</span>
				{#if !isToday(appState.selectedDate)}
					<span class="block text-xs text-gray-500 dark:text-gray-400">{formatDate(appState.selectedDate)}</span>
				{/if}
			</button>

			<button
				onclick={() => shiftDate(1)}
				class="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
				aria-label="Next day"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
				</svg>
			</button>
		</div>
	</div>

	<div class="mx-auto max-w-lg px-4 pt-4 space-y-4">
		<!-- ================================================================ -->
		<!-- No Profile Prompt                                                -->
		<!-- ================================================================ -->
		{#if appState.dbReady && !profile}
			<div class="rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 p-4 text-center">
				<p class="text-amber-800 dark:text-amber-200 font-medium">No profile found</p>
				<p class="mt-1 text-sm text-amber-600 dark:text-amber-300">
					Set up your profile in
					<a href="/settings" class="underline font-semibold">Settings</a>
					to get personalized targets.
				</p>
			</div>
		{/if}

		<!-- ================================================================ -->
		<!-- Calorie Ring                                                     -->
		<!-- ================================================================ -->
		<div class="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm">
			<div class="flex flex-col items-center">
				<div class="relative h-44 w-44">
					<svg class="h-full w-full -rotate-90" viewBox="0 0 160 160">
						<!-- Background ring -->
						<circle
							cx="80"
							cy="80"
							r={ringRadius}
							fill="none"
							stroke="currentColor"
							stroke-width="10"
							class="text-gray-200 dark:text-gray-700"
						/>
						<!-- Progress ring -->
						<circle
							cx="80"
							cy="80"
							r={ringRadius}
							fill="none"
							stroke={ringStrokeColor}
							stroke-width="10"
							stroke-linecap="round"
							stroke-dasharray={ringCircumference}
							stroke-dashoffset={ringOffset}
							class="transition-all duration-500 ease-in-out"
						/>
					</svg>
					<div class="absolute inset-0 flex flex-col items-center justify-center">
						<span class="text-3xl font-bold text-gray-900 dark:text-white">
							{Math.round(dayTotals.calories)}
						</span>
						<span class="text-xs text-gray-500 dark:text-gray-400">
							of {calorieTarget} kcal
						</span>
					</div>
				</div>
			</div>
		</div>

		<!-- ================================================================ -->
		<!-- Macro Bars                                                       -->
		<!-- ================================================================ -->
		<div class="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm space-y-3">
			<h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Macros</h2>

			<!-- Protein -->
			<div>
				<div class="flex justify-between text-sm mb-1">
					<span class="font-medium text-blue-600 dark:text-blue-400">Protein</span>
					<span class="text-gray-600 dark:text-gray-300">{Math.round(dayTotals.protein_g)}g / {proteinTarget}g</span>
				</div>
				<div class="h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
					<div
						class="h-full rounded-full bg-blue-500 transition-all duration-500"
						style="width: {macroBarPercent(dayTotals.protein_g, proteinTarget)}%"
					></div>
				</div>
			</div>

			<!-- Carbs -->
			<div>
				<div class="flex justify-between text-sm mb-1">
					<span class="font-medium text-amber-600 dark:text-amber-400">Carbs</span>
					<span class="text-gray-600 dark:text-gray-300">{Math.round(dayTotals.carbs_g)}g / {carbTarget}g</span>
				</div>
				<div class="h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
					<div
						class="h-full rounded-full bg-amber-500 transition-all duration-500"
						style="width: {macroBarPercent(dayTotals.carbs_g, carbTarget)}%"
					></div>
				</div>
			</div>

			<!-- Fat -->
			<div>
				<div class="flex justify-between text-sm mb-1">
					<span class="font-medium text-pink-600 dark:text-pink-400">Fat</span>
					<span class="text-gray-600 dark:text-gray-300">{Math.round(dayTotals.fat_g)}g / {fatTarget}g</span>
				</div>
				<div class="h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
					<div
						class="h-full rounded-full bg-pink-500 transition-all duration-500"
						style="width: {macroBarPercent(dayTotals.fat_g, fatTarget)}%"
					></div>
				</div>
			</div>
		</div>

		<!-- ================================================================ -->
		<!-- Meal Sections                                                    -->
		<!-- ================================================================ -->
		{#each mealTypes as meal}
			{@const entries = entriesByMeal[meal] ?? []}
			{@const totals = mealTotals[meal]}
			<div class="rounded-xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
				<!-- Meal header -->
				<button
					onclick={() => toggleMeal(meal)}
					class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-750"
				>
					<div class="flex items-center gap-2">
						<svg
							class="h-4 w-4 text-gray-400 transition-transform duration-200 {expandedMeals[meal] ? 'rotate-90' : ''}"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
						</svg>
						<span class="font-semibold text-gray-900 dark:text-white">{mealLabel(meal)}</span>
					</div>
					<span class="text-sm text-gray-500 dark:text-gray-400">
						{Math.round(totals.calories)} kcal
					</span>
				</button>

				<!-- Expanded content -->
				{#if expandedMeals[meal]}
					<div class="border-t border-gray-100 dark:border-gray-700">
						{#if entries.length === 0}
							<p class="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 italic">No items logged</p>
						{:else}
							{#each entries as entry (entry.id)}
								<div class="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 dark:border-gray-700/50 last:border-b-0">
									<div class="min-w-0 flex-1">
										<p class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
											{entry.food_id}
										</p>
										<p class="text-xs text-gray-500 dark:text-gray-400">
											{entry.serving_quantity} {entry.serving_unit} &middot; {Math.round(entry.calories)} kcal
										</p>
									</div>
									<button
										onclick={() => handleDeleteEntry(entry.id)}
										class="ml-2 shrink-0 rounded-full p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30"
										aria-label="Delete entry"
									>
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
										</svg>
									</button>
								</div>
							{/each}
						{/if}

						<!-- Add Food button -->
						<a
							href="/log?meal={meal}"
							class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
							</svg>
							Add Food
						</a>
					</div>
				{/if}
			</div>
		{/each}

		<!-- ================================================================ -->
		<!-- Water Tracker                                                    -->
		<!-- ================================================================ -->
		<div class="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm">
			<div class="flex items-center justify-between mb-3">
				<h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Water</h2>
				<span class="text-sm text-gray-600 dark:text-gray-300">
					{totalWaterMl} / {waterTarget} ml
				</span>
			</div>

			<!-- Water progress bar -->
			<div class="h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mb-4">
				<div
					class="h-full rounded-full bg-cyan-500 transition-all duration-500"
					style="width: {Math.min((totalWaterMl / waterTarget) * 100, 100)}%"
				></div>
			</div>

			<!-- Quick-add buttons -->
			<div class="flex flex-wrap gap-2">
				<button
					onclick={() => handleAddWater(250)}
					class="rounded-lg bg-cyan-50 dark:bg-cyan-900/30 px-3 py-1.5 text-sm font-medium text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors"
				>
					+250 ml
				</button>
				<button
					onclick={() => handleAddWater(500)}
					class="rounded-lg bg-cyan-50 dark:bg-cyan-900/30 px-3 py-1.5 text-sm font-medium text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors"
				>
					+500 ml
				</button>
				<button
					onclick={() => (showCustomWater = !showCustomWater)}
					class="rounded-lg bg-gray-100 dark:bg-gray-700 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
				>
					Custom
				</button>
			</div>

			<!-- Custom water input -->
			{#if showCustomWater}
				<div class="mt-3 flex gap-2">
					<input
						type="number"
						bind:value={customWaterAmount}
						placeholder="ml"
						class="w-24 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
					/>
					<button
						onclick={() => handleAddWater(Number(customWaterAmount))}
						class="rounded-lg bg-cyan-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-600 transition-colors"
					>
						Add
					</button>
				</div>
			{/if}

			<!-- Water log entries -->
			{#if waterEntries.length > 0}
				<div class="mt-3 space-y-1">
					{#each waterEntries as entry (entry.id)}
						<div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
							<span>{entry.amount_ml} ml</span>
							<button
								onclick={() => handleDeleteWater(entry.id)}
								class="text-gray-400 hover:text-red-500 transition-colors"
								aria-label="Delete water entry"
							>
								<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- ================================================================ -->
		<!-- Remaining Summary                                                -->
		<!-- ================================================================ -->
		<div class="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm text-center">
			<p class="text-sm text-gray-600 dark:text-gray-300">
				<span class="font-semibold text-gray-900 dark:text-white">{Math.round(remainingCalories)} calories</span>
				and
				<span class="font-semibold text-gray-900 dark:text-white">{Math.round(remainingProtein)}g protein</span>
				remaining
			</p>
		</div>
	</div>
</div>
