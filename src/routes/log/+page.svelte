<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { appState } from '$lib/stores/app.svelte';
	import { llmState } from '$lib/stores/llm.svelte';
	import {
		getFoods,
		createFood,
		createLogEntry,
		getRecentFoods,
		getLastServings
	} from '$lib/db/queries';
	import { scanLabel, describeFood } from '$lib/llm/client';
	import { formatDate } from '$lib/utils/dates';
	import type { Food } from '$lib/db/types';
	import type { NutritionData } from '$lib/llm/types';
	import NutritionForm from '$lib/components/NutritionForm.svelte';
	import CameraCapture from '$lib/components/CameraCapture.svelte';

	// ── URL params ──────────────────────────────────────────────────────
	const meal = page.url.searchParams.get('meal') ?? 'snack';
	const urlDate = page.url.searchParams.get('date');
	if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
		appState.selectedDate = urlDate;
	}

	// ── Shared state ────────────────────────────────────────────────────
	type Tab = 'search' | 'recent' | 'scan';
	let tab = $state<Tab>('search');

	async function log(food: Food, qty: number, nav = true) {
		await createLogEntry({
			user_id: appState.userId,
			food_id: food.id,
			meal_type: meal,
			serving_quantity: qty,
			serving_size_g: food.serving_size_g,
			serving_unit: food.serving_unit,
			calories: Math.round(food.calories * qty),
			protein_g: Math.round(food.protein_g * qty * 10) / 10,
			carbs_g: Math.round(food.carbs_g * qty * 10) / 10,
			fat_g: Math.round(food.fat_g * qty * 10) / 10,
			logged_at: appState.selectedDate + ' 12:00:00'
		});
		if (nav) goto(`${base}/`);
	}

	// ── Recent ──────────────────────────────────────────────────────────
	let rcList = $state<Food[]>([]);
	let rcLast = $state<Record<string, number>>({});
	let rcSelected = $state<Record<string, number>>({});
	let rcLogging = $state(false);

	$effect(() => {
		if (tab !== 'recent' || !appState.userId) return;
		rcList = getRecentFoods(appState.userId, 30);
		rcLast = getLastServings(appState.userId);
	});

	function rcToggle(food: Food) {
		if (food.id in rcSelected) {
			const { [food.id]: _, ...rest } = rcSelected;
			rcSelected = rest;
		} else {
			rcSelected = { ...rcSelected, [food.id]: rcLast[food.id] ?? 1 };
		}
	}

	let rcIds = $derived(Object.keys(rcSelected));
	let rcCount = $derived(rcIds.length);
	let rcCal = $derived(
		rcIds.reduce((s, id) => {
			const f = rcList.find((x) => x.id === id);
			return s + (f ? Math.round(f.calories * (rcSelected[id] ?? 1)) : 0);
		}, 0)
	);

	async function rcLogAll() {
		rcLogging = true;
		for (const id of rcIds) {
			const f = rcList.find((x) => x.id === id);
			if (f) await log(f, rcSelected[id] ?? 1, false);
		}
		goto(`${base}/`);
	}

	// ── Search ──────────────────────────────────────────────────────────
	let srQuery = $state('');
	let srResults = $state<Food[]>([]);
	let srFood = $state<Food | null>(null);
	let srQty = $state(1.0);

	$effect(() => {
		if (srQuery.length >= 2) {
			srResults = getFoods(srQuery);
		} else {
			srResults = [];
		}
	});

	// ── AI tab (text + optional photo) ──────────────────────────────────
	let aiText = $state('');
	let aiPhoto = $state<string | null>(null);
	let camOpen = $state(false);
	let scanData = $state<NutritionData | null>(null);
	let scanNulls = $state<string[]>([]);
	let scanErr = $state<string | null>(null);

	function onCapture(b64: string) {
		aiPhoto = b64;
		camOpen = false;
	}

	function removePhoto() {
		aiPhoto = null;
	}

	function onFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			aiPhoto = reader.result as string;
		};
		reader.readAsDataURL(file);
		input.value = '';
	}

	async function aiSubmit() {
		if (!aiText.trim() && !aiPhoto) return;
		if (!llmState.config.apiKey && llmState.config.provider !== 'ollama') {
			scanErr = 'Configure an LLM API key in Settings first.';
			return;
		}
		llmState.scanning = true;
		scanErr = null;
		try {
			let r: NutritionData;
			if (aiPhoto) {
				r = await scanLabel(llmState.config, aiPhoto, aiText.trim() || undefined);
			} else {
				r = await describeFood(llmState.config, aiText.trim());
			}
			scanNulls = Object.entries(r).filter(([, v]) => v === null).map(([k]) => k);
			scanData = r;
		} catch (e) {
			scanErr = e instanceof Error ? e.message : String(e);
		} finally {
			llmState.scanning = false;
		}
	}

	async function saveScan() {
		if (!scanData) return;
		const f = await createFood({
			name: scanData.product_name ?? 'Scanned Food',
			brand: scanData.brand,
			serving_size_g: scanData.serving_size_g ?? 100,
			serving_unit: scanData.serving_size_text ?? 'serving',
			calories: scanData.calories,
			protein_g: scanData.protein_g ?? 0,
			carbs_g: scanData.total_carbohydrate_g ?? 0,
			fat_g: scanData.total_fat_g ?? 0,
			fiber_g: scanData.dietary_fiber_g ?? null,
			sugar_g: scanData.total_sugars_g ?? null,
			sodium_mg: scanData.sodium_mg ?? null,
			barcode: scanData.barcode,
			source: 'scan'
		});
		await log(f, 1.0);
	}

	// ── Tab config ──────────────────────────────────────────────────────
	const tabs: { id: Tab; label: string }[] = [
		{ id: 'search', label: 'Search' },
		{ id: 'scan', label: 'AI' },
		{ id: 'recent', label: 'Recent' }
	];

	// ── Styles ──────────────────────────────────────────────────────────
	const row = 'flex w-full items-center justify-between px-4 py-3 text-left select-none transition-colors';
	const rowOn = row + ' bg-emerald-50 dark:bg-emerald-900/20';
	const rowOff = row + ' hover:bg-gray-50 dark:hover:bg-gray-700';
	const check = 'shrink-0 h-5 w-5 text-emerald-500';
	const spacer = 'shrink-0 h-5 w-5';
	const pill = 'rounded-xl bg-emerald-600 p-3 shadow-lg';
	const logBtn = 'w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
</script>

<div class="mx-auto max-w-lg px-4 py-6">

	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-xl font-bold text-gray-900 dark:text-white">Log Food</h1>
			<p class="text-sm text-gray-500 dark:text-gray-400 capitalize">
				{meal} &middot; {formatDate(appState.selectedDate)}
			</p>
		</div>
		<a href="{base}/" class="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
			Back
		</a>
	</div>

	<!-- Tab bar -->
	<div class="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
		{#each tabs as t}
			<button
				type="button"
				onclick={() => { tab = t.id; }}
				class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors
					{tab === t.id
						? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
						: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}"
			>{t.label}</button>
		{/each}
	</div>



	<!-- ════════════════════════════════════════════════════════════════ -->
	<!-- RECENT                                                         -->
	<!-- ════════════════════════════════════════════════════════════════ -->
	{#if tab === 'recent'}
		<div class="space-y-3">
			{#if rcCount > 0}
				<div class="flex items-center justify-between">
					<p class="text-sm text-gray-600 dark:text-gray-400">{rcCount} selected</p>
					<button type="button" onclick={() => { rcSelected = {}; }} class="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Clear</button>
				</div>
			{:else}
				<p class="text-xs text-gray-500 dark:text-gray-400">Tap items to select, then log them all at once.</p>
			{/if}

			{#if rcList.length > 0}
				<ul class="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
					{#each rcList as food (food.id)}
						{@const on = food.id in rcSelected}
						{@const qty = rcSelected[food.id] ?? rcLast[food.id] ?? 1}
						<li>
							<button type="button" onclick={() => rcToggle(food)} class={on ? rowOn : rowOff}>
								<div class="flex items-center gap-3 min-w-0 flex-1">
									{#if on}
										<svg class={check} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
									{:else}
										<div class={spacer}></div>
									{/if}
									<div class="min-w-0">
										<p class="text-sm font-medium text-gray-900 dark:text-white truncate">{food.name}</p>
										{#if food.brand}<p class="text-xs text-gray-500 dark:text-gray-400 truncate">{food.brand}</p>{/if}
									</div>
								</div>
								<div class="shrink-0 text-right ml-2">
									<span class="text-xs text-gray-400">{Math.round(food.calories * qty)} cal</span>
									<p class="text-xs text-gray-400">{qty} serving{qty !== 1 ? 's' : ''}</p>
								</div>
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="py-8 text-center text-sm text-gray-400 dark:text-gray-500">No recent foods yet.</p>
			{/if}

			<div class={pill}>
				{#if rcCount > 0}
					<div class="flex items-center justify-between text-white text-sm mb-2">
						<span>{rcCount} item{rcCount === 1 ? '' : 's'}</span>
						<span class="font-bold">{rcCal} cal</span>
					</div>
				{/if}
				<button type="button" onclick={rcLogAll} disabled={rcLogging || rcCount === 0} class={logBtn}>
					{rcLogging ? 'Logging...' : rcCount === 0 ? 'Select foods to log' : `Log ${rcCount} item${rcCount === 1 ? '' : 's'}`}
				</button>
			</div>
		</div>
	{/if}

	<!-- ════════════════════════════════════════════════════════════════ -->
	<!-- SEARCH                                                         -->
	<!-- ════════════════════════════════════════════════════════════════ -->
	{#if tab === 'search'}
		<div class="space-y-4">
			{#if !srFood}
				<input type="text" placeholder="Search foods by name or brand..." bind:value={srQuery}
					class="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
				{#if srResults.length > 0}
					<ul class="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
						{#each srResults as food}
							<li>
								<button type="button" onclick={() => { srFood = food; srQty = 1; }}
									class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
									<div>
										<p class="text-sm font-medium text-gray-900 dark:text-white">{food.name}</p>
										{#if food.brand}<p class="text-xs text-gray-500 dark:text-gray-400">{food.brand}</p>{/if}
									</div>
									<span class="text-xs text-gray-400">{food.calories} cal</span>
								</button>
							</li>
						{/each}
					</ul>
				{:else if srQuery.length >= 2}
					<p class="py-8 text-center text-sm text-gray-400 dark:text-gray-500">No foods found.</p>
				{/if}
			{:else}
				<div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
					<div class="mb-4 flex items-center justify-between">
						<div>
							<p class="font-medium text-gray-900 dark:text-white">{srFood.name}</p>
							{#if srFood.brand}<p class="text-sm text-gray-500 dark:text-gray-400">{srFood.brand}</p>{/if}
						</div>
						<button type="button" onclick={() => { srFood = null; }} class="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Change</button>
					</div>
					<div class="mb-4">
						<label for="sr-qty" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Servings ({srFood.serving_unit})</label>
						<input id="sr-qty" type="number" step="0.1" min="0.1" bind:value={srQty}
							class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
					</div>
					<div class="mb-4 grid grid-cols-4 gap-2 text-center text-xs text-gray-500 dark:text-gray-400">
						<div><p class="text-lg font-bold text-gray-900 dark:text-white">{Math.round(srFood.calories * srQty)}</p><p>cal</p></div>
						<div><p class="text-lg font-bold text-gray-900 dark:text-white">{(srFood.protein_g * srQty).toFixed(1)}</p><p>protein</p></div>
						<div><p class="text-lg font-bold text-gray-900 dark:text-white">{(srFood.carbs_g * srQty).toFixed(1)}</p><p>carbs</p></div>
						<div><p class="text-lg font-bold text-gray-900 dark:text-white">{(srFood.fat_g * srQty).toFixed(1)}</p><p>fat</p></div>
					</div>
					<button type="button" onclick={() => log(srFood!, srQty)} class="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors">Log</button>
				</div>
			{/if}
		</div>
	{/if}

	<!-- ════════════════════════════════════════════════════════════════ -->
	<!-- AI                                                             -->
	<!-- ════════════════════════════════════════════════════════════════ -->
	{#if tab === 'scan'}
		<div class="space-y-4">
			{#if llmState.scanning}
				<div class="flex flex-col items-center gap-3 py-16">
					<div class="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-emerald-600 dark:border-gray-700 dark:border-t-emerald-400"></div>
					<p class="text-sm text-gray-500 dark:text-gray-400">Analyzing...</p>
				</div>
			{:else if scanData}
				<NutritionForm bind:data={scanData} nullFields={scanNulls} />
				<button type="button" onclick={saveScan} class="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors">Save & Log</button>
			{:else if camOpen}
				<CameraCapture oncapture={onCapture} onclose={() => { camOpen = false; }} />
			{:else}
				<p class="text-xs text-gray-500 dark:text-gray-400">Describe what you ate, or attach a photo of a nutrition label.</p>

				<!-- Text input -->
				<input
					type="text"
					bind:value={aiText}
					placeholder="e.g. four scrambled eggs with butter"
					onkeydown={(e) => { if (e.key === 'Enter') aiSubmit(); }}
					class="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
				/>

				<!-- Photo attachment -->
				{#if aiPhoto}
					<div class="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
						<img src={aiPhoto} alt="Attached photo" class="w-full max-h-48 object-cover" />
						<button type="button" onclick={removePhoto} aria-label="Remove photo"
							class="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors">
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				{/if}

				<!-- Action buttons -->
				<div class="flex gap-2">
					<button type="button" onclick={() => { camOpen = true; }}
						class="flex items-center gap-1.5 rounded-xl border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
							<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
						</svg>
						Camera
					</button>
					<label
						class="flex items-center gap-1.5 rounded-xl border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer">
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
						</svg>
						Gallery
						<input type="file" accept="image/*" onchange={onFileSelect} class="hidden" />
					</label>
					<button type="button" onclick={aiSubmit}
						disabled={!aiText.trim() && !aiPhoto}
						class="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
						{aiPhoto ? 'Analyze' : 'Estimate'}
					</button>
				</div>

				{#if scanErr}
					<div class="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{scanErr}</div>
				{/if}
			{/if}
		</div>
	{/if}

</div>
