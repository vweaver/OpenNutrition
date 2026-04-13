<script lang="ts">
	import { onMount } from 'svelte';
	import { appState } from '$lib/stores/app.svelte';
	import { llmState } from '$lib/stores/llm.svelte';
	import { getDb } from '$lib/db';
	import { getProfile, upsertProfile, getLogByDateRange, getFoods } from '$lib/db/queries';
	import type { LLMProvider } from '$lib/llm/types';
	import type { UserProfile, Food, FoodLog } from '$lib/db/types';

	const LLM_STORAGE_KEY = 'opennutrition_llm_config';
	const UNIT_STORAGE_KEY = 'opennutrition_unit_system';

	// Section open/close state
	let profileOpen = $state(true);
	let llmOpen = $state(false);
	let unitsOpen = $state(false);
	let dataOpen = $state(false);

	// Profile form
	let profileName = $state('');
	let heightCm = $state<number | null>(null);
	let age = $state<number | null>(null);
	let sex = $state<string>('');
	let activityLevel = $state<string>('');
	let goal = $state<string>('');
	let calorieTarget = $state<number | null>(null);
	let proteinTarget = $state<number | null>(null);
	let carbTarget = $state<number | null>(null);
	let fatTarget = $state<number | null>(null);
	let profileSaving = $state(false);
	let profileMsg = $state('');

	// LLM form
	let llmProvider = $state<LLMProvider>('openrouter');
	let llmApiKey = $state('');
	let llmModel = $state('');
	let llmBaseUrl = $state('');
	let showApiKey = $state(false);
	let llmMsg = $state('');

	// Data management
	let resetConfirm = $state(false);
	let exportingDb = $state(false);
	let exportingCsv = $state(false);

	const modelPlaceholders: Record<LLMProvider, string> = {
		openrouter: 'anthropic/claude-sonnet-4-20250514',
		ollama: 'llama3.2',
		openai: 'gpt-4o',
		anthropic: 'claude-sonnet-4-20250514'
	};

	const showBaseUrl = $derived(llmProvider === 'ollama' || llmProvider === 'openai');

	// Height display helpers
	const isImperial = $derived(appState.unitSystem === 'imperial');

	function cmToInches(cm: number): number {
		return Math.round(cm / 2.54);
	}

	function inchesToCm(inches: number): number {
		return Math.round(inches * 2.54);
	}

	let displayHeight = $derived.by(() => {
		if (heightCm === null) return null;
		return isImperial ? cmToInches(heightCm) : heightCm;
	});

	function onHeightInput(e: Event) {
		const val = (e.target as HTMLInputElement).valueAsNumber;
		if (Number.isNaN(val)) {
			heightCm = null;
		} else {
			heightCm = isImperial ? inchesToCm(val) : val;
		}
	}

	function loadProfile() {
		const profile = getProfile();
		if (profile) {
			profileName = profile.name ?? '';
			heightCm = profile.height_cm;
			age = profile.age;
			sex = profile.sex ?? '';
			activityLevel = profile.activity_level ?? '';
			goal = profile.goal ?? '';
			calorieTarget = profile.calorie_target;
			proteinTarget = profile.protein_target_g;
			carbTarget = profile.carb_target_g;
			fatTarget = profile.fat_target_g;
		}
	}

	async function saveProfile() {
		profileSaving = true;
		profileMsg = '';
		try {
			await upsertProfile({
				name: profileName || null,
				height_cm: heightCm,
				age: age,
				sex: sex || null,
				activity_level: activityLevel || null,
				goal: goal || null,
				calorie_target: calorieTarget,
				protein_target_g: proteinTarget,
				carb_target_g: carbTarget,
				fat_target_g: fatTarget
			});
			profileMsg = 'Profile saved!';
			setTimeout(() => (profileMsg = ''), 3000);
		} catch (err) {
			profileMsg = 'Error saving profile.';
			console.error(err);
		} finally {
			profileSaving = false;
		}
	}

	function loadLLMConfig() {
		try {
			const stored = localStorage.getItem(LLM_STORAGE_KEY);
			if (stored) {
				const cfg = JSON.parse(stored);
				llmProvider = cfg.provider ?? 'openrouter';
				llmApiKey = cfg.apiKey ?? '';
				llmModel = cfg.model ?? '';
				llmBaseUrl = cfg.baseUrl ?? '';
				// Also sync to llmState
				llmState.config = { ...cfg };
			}
		} catch {
			// ignore parse errors
		}
	}

	function saveLLMConfig() {
		const cfg = {
			provider: llmProvider,
			apiKey: llmApiKey,
			model: llmModel || modelPlaceholders[llmProvider],
			baseUrl: llmBaseUrl
		};
		llmState.config = { ...cfg };
		localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify(cfg));
		llmMsg = 'LLM config saved!';
		setTimeout(() => (llmMsg = ''), 3000);
	}

	function loadUnitSystem() {
		const profile = getProfile();
		if (profile?.unit_system === 'metric' || profile?.unit_system === 'imperial') {
			appState.unitSystem = profile.unit_system;
			return;
		}
		// One-time migration from old localStorage value, then remove it
		try {
			const stored = localStorage.getItem(UNIT_STORAGE_KEY);
			if (stored === 'metric' || stored === 'imperial') {
				appState.unitSystem = stored;
				void upsertProfile({ unit_system: stored });
				localStorage.removeItem(UNIT_STORAGE_KEY);
			}
		} catch {
			// ignore
		}
	}

	async function setUnitSystem(system: 'metric' | 'imperial') {
		appState.unitSystem = system;
		await upsertProfile({ unit_system: system });
	}

	async function exportSQLite() {
		exportingDb = true;
		try {
			const db = getDb();
			const data = db.export();
			const blob = new Blob([data], { type: 'application/x-sqlite3' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `opennutrition-${new Date().toISOString().split('T')[0]}.sqlite`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error('Export failed:', err);
			alert('Failed to export database.');
		} finally {
			exportingDb = false;
		}
	}

	async function exportCSV() {
		exportingCsv = true;
		try {
			const foods = getFoods();
			const foodMap = new Map<string, Food>();
			for (const f of foods) {
				foodMap.set(f.id, f);
			}

			// Get all logs (wide date range)
			const userId = appState.userId || getProfile()?.id || '';
			const logs = getLogByDateRange(userId, '2000-01-01', '2099-12-31');

			const headers = [
				'logged_at',
				'meal_type',
				'food_name',
				'brand',
				'serving_quantity',
				'serving_size_g',
				'serving_unit',
				'calories',
				'protein_g',
				'carbs_g',
				'fat_g'
			];

			const rows = logs.map((log: FoodLog) => {
				const food = foodMap.get(log.food_id);
				return [
					log.logged_at,
					log.meal_type,
					`"${(food?.name ?? 'Unknown').replace(/"/g, '""')}"`,
					`"${(food?.brand ?? '').replace(/"/g, '""')}"`,
					log.serving_quantity,
					log.serving_size_g,
					log.serving_unit,
					log.calories,
					log.protein_g,
					log.carbs_g,
					log.fat_g
				].join(',');
			});

			const csv = [headers.join(','), ...rows].join('\n');
			const blob = new Blob([csv], { type: 'text/csv' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `opennutrition-log-${new Date().toISOString().split('T')[0]}.csv`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error('CSV export failed:', err);
			alert('Failed to export CSV.');
		} finally {
			exportingCsv = false;
		}
	}

	async function resetAllData() {
		try {
			const db = getDb();
			const tables = [
				'food_log',
				'weight_log',
				'water_log',
				'recipe_ingredients',
				'recipes',
				'foods',
				'user_profile',
				'sync_meta'
			];
			for (const t of tables) {
				db.run(`DELETE FROM ${t}`);
			}
			const { saveDatabase } = await import('$lib/db');
			await saveDatabase();
			// Reset form state
			profileName = '';
			heightCm = null;
			age = null;
			sex = '';
			activityLevel = '';
			goal = '';
			calorieTarget = null;
			proteinTarget = null;
			carbTarget = null;
			fatTarget = null;
			resetConfirm = false;
			alert('All data has been reset.');
		} catch (err) {
			console.error('Reset failed:', err);
			alert('Failed to reset data.');
		}
	}

	onMount(() => {
		loadProfile();
		loadLLMConfig();
		loadUnitSystem();
	});

	const inputClass =
		'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';
	const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
	const btnPrimary =
		'inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
	const btnDanger =
		'inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
	const btnSecondary =
		'inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
</script>

<svelte:head>
	<title>Settings - OpenNutrition</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-6 space-y-4">
	<h1 class="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>

	<!-- Profile & Goals -->
	<section class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
		<button
			type="button"
			class="flex w-full items-center justify-between px-5 py-4 text-left"
			onclick={() => (profileOpen = !profileOpen)}
		>
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Profile & Goals</h2>
			<svg
				class="h-5 w-5 text-gray-500 transition-transform {profileOpen ? 'rotate-180' : ''}"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
			</svg>
		</button>

		{#if profileOpen}
			<div class="border-t border-gray-200 dark:border-gray-700 px-5 py-4 space-y-4">
				<div>
					<label for="s-name" class={labelClass}>Display Name</label>
					<input id="s-name" type="text" bind:value={profileName} placeholder="Your name" class={inputClass} />
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="s-height" class={labelClass}>
							Height ({isImperial ? 'inches' : 'cm'})
						</label>
						<input
							id="s-height"
							type="number"
							value={displayHeight ?? ''}
							oninput={onHeightInput}
							placeholder={isImperial ? '68' : '172'}
							class={inputClass}
						/>
					</div>
					<div>
						<label for="s-age" class={labelClass}>Age</label>
						<input
							id="s-age"
							type="number"
							bind:value={age}
							placeholder="30"
							class={inputClass}
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="s-sex" class={labelClass}>Sex</label>
						<select id="s-sex" bind:value={sex} class={inputClass}>
							<option value="">-- Select --</option>
							<option value="male">Male</option>
							<option value="female">Female</option>
						</select>
					</div>
					<div>
						<label for="s-activity" class={labelClass}>Activity Level</label>
						<select id="s-activity" bind:value={activityLevel} class={inputClass}>
							<option value="">-- Select --</option>
							<option value="sedentary">Sedentary</option>
							<option value="light">Light</option>
							<option value="moderate">Moderate</option>
							<option value="active">Active</option>
							<option value="very_active">Very Active</option>
						</select>
					</div>
				</div>

				<div>
					<label for="s-goal" class={labelClass}>Goal</label>
					<select id="s-goal" bind:value={goal} class={inputClass}>
						<option value="">-- Select --</option>
						<option value="lose">Lose Weight</option>
						<option value="maintain">Maintain Weight</option>
						<option value="gain">Gain Weight</option>
					</select>
				</div>

				<hr class="border-gray-200 dark:border-gray-700" />

				<h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
					Daily Targets
				</h3>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="s-cal" class={labelClass}>Calories (kcal)</label>
						<input id="s-cal" type="number" bind:value={calorieTarget} placeholder="2000" class={inputClass} />
					</div>
					<div>
						<label for="s-protein" class={labelClass}>Protein (g)</label>
						<input id="s-protein" type="number" bind:value={proteinTarget} placeholder="150" class={inputClass} />
					</div>
					<div>
						<label for="s-carbs" class={labelClass}>Carbs (g)</label>
						<input id="s-carbs" type="number" bind:value={carbTarget} placeholder="250" class={inputClass} />
					</div>
					<div>
						<label for="s-fat" class={labelClass}>Fat (g)</label>
						<input id="s-fat" type="number" bind:value={fatTarget} placeholder="65" class={inputClass} />
					</div>
				</div>

				<div class="flex items-center gap-3">
					<button type="button" class={btnPrimary} disabled={profileSaving} onclick={saveProfile}>
						{profileSaving ? 'Saving...' : 'Save Profile'}
					</button>
					{#if profileMsg}
						<span class="text-sm text-emerald-600 dark:text-emerald-400">{profileMsg}</span>
					{/if}
				</div>
			</div>
		{/if}
	</section>

	<!-- LLM Provider Configuration -->
	<section class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
		<button
			type="button"
			class="flex w-full items-center justify-between px-5 py-4 text-left"
			onclick={() => (llmOpen = !llmOpen)}
		>
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">LLM Provider</h2>
			<svg
				class="h-5 w-5 text-gray-500 transition-transform {llmOpen ? 'rotate-180' : ''}"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
			</svg>
		</button>

		{#if llmOpen}
			<div class="border-t border-gray-200 dark:border-gray-700 px-5 py-4 space-y-4">
				<div>
					<label for="s-llm-provider" class={labelClass}>Provider</label>
					<select id="s-llm-provider" bind:value={llmProvider} class={inputClass}>
						<option value="openrouter">OpenRouter</option>
						<option value="ollama">Ollama</option>
						<option value="openai">OpenAI</option>
						<option value="anthropic">Anthropic</option>
					</select>
				</div>

				<div>
					<label for="s-llm-key" class={labelClass}>API Key</label>
					<div class="relative">
						<input
							id="s-llm-key"
							type={showApiKey ? 'text' : 'password'}
							bind:value={llmApiKey}
							placeholder="sk-..."
							class="{inputClass} pr-12"
						/>
						<button
							type="button"
							class="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-1"
							onclick={() => (showApiKey = !showApiKey)}
						>
							{showApiKey ? 'Hide' : 'Show'}
						</button>
					</div>
				</div>

				<div>
					<label for="s-llm-model" class={labelClass}>Model</label>
					<input
						id="s-llm-model"
						type="text"
						bind:value={llmModel}
						placeholder={modelPlaceholders[llmProvider]}
						class={inputClass}
					/>
				</div>

				{#if showBaseUrl}
					<div>
						<label for="s-llm-url" class={labelClass}>Base URL</label>
						<input
							id="s-llm-url"
							type="text"
							bind:value={llmBaseUrl}
							placeholder={llmProvider === 'ollama' ? 'http://localhost:11434' : 'https://api.openai.com/v1'}
							class={inputClass}
						/>
					</div>
				{/if}

				<div class="flex items-center gap-3">
					<button type="button" class={btnPrimary} onclick={saveLLMConfig}>
						Save
					</button>
					{#if llmMsg}
						<span class="text-sm text-emerald-600 dark:text-emerald-400">{llmMsg}</span>
					{/if}
				</div>
			</div>
		{/if}
	</section>

	<!-- Units -->
	<section class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
		<button
			type="button"
			class="flex w-full items-center justify-between px-5 py-4 text-left"
			onclick={() => (unitsOpen = !unitsOpen)}
		>
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Units</h2>
			<svg
				class="h-5 w-5 text-gray-500 transition-transform {unitsOpen ? 'rotate-180' : ''}"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
			</svg>
		</button>

		{#if unitsOpen}
			<div class="border-t border-gray-200 dark:border-gray-700 px-5 py-4">
				<div class="flex items-center gap-3">
					<button
						type="button"
						class="flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors {appState.unitSystem === 'metric'
							? 'bg-emerald-600 text-white'
							: 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}"
						onclick={() => setUnitSystem('metric')}
					>
						Metric (kg, cm)
					</button>
					<button
						type="button"
						class="flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors {appState.unitSystem === 'imperial'
							? 'bg-emerald-600 text-white'
							: 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}"
						onclick={() => setUnitSystem('imperial')}
					>
						Imperial (lb, in)
					</button>
				</div>
			</div>
		{/if}
	</section>

	<!-- Data Management -->
	<section class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
		<button
			type="button"
			class="flex w-full items-center justify-between px-5 py-4 text-left"
			onclick={() => (dataOpen = !dataOpen)}
		>
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Data Management</h2>
			<svg
				class="h-5 w-5 text-gray-500 transition-transform {dataOpen ? 'rotate-180' : ''}"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
			</svg>
		</button>

		{#if dataOpen}
			<div class="border-t border-gray-200 dark:border-gray-700 px-5 py-4 space-y-3">
				<button type="button" class="{btnSecondary} w-full" disabled={exportingDb} onclick={exportSQLite}>
					{exportingDb ? 'Exporting...' : 'Export SQLite Database'}
				</button>

				<button type="button" class="{btnSecondary} w-full" disabled={exportingCsv} onclick={exportCSV}>
					{exportingCsv ? 'Exporting...' : 'Export Food Log as CSV'}
				</button>

				<hr class="border-gray-200 dark:border-gray-700" />

				{#if !resetConfirm}
					<button type="button" class="{btnDanger} w-full" onclick={() => (resetConfirm = true)}>
						Reset All Data
					</button>
				{:else}
					<div class="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4 space-y-3">
						<p class="text-sm text-red-700 dark:text-red-300 font-medium">
							This will permanently delete all your data including foods, logs, and profile. This cannot be undone.
						</p>
						<div class="flex gap-3">
							<button type="button" class={btnDanger} onclick={resetAllData}>
								Yes, Delete Everything
							</button>
							<button type="button" class={btnSecondary} onclick={() => (resetConfirm = false)}>
								Cancel
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</section>
</div>
