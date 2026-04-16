<script lang="ts">
	import {
		Chart,
		LineElement,
		PointElement,
		LineController,
		CategoryScale,
		LinearScale,
		Tooltip,
		Legend,
		Filler
	} from 'chart.js';
	import { getWeightLogs, createWeightLog, deleteWeightLog } from '$lib/db/queries';
	import { appState } from '$lib/stores/app.svelte';
	import { formatWeight, kgToLbs, lbsToKg } from '$lib/utils/units';
	import { today, formatDate } from '$lib/utils/dates';
	import type { WeightLog } from '$lib/db/types';

	// Register Chart.js components
	Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Tooltip, Legend, Filler);

	// ---------------------------------------------------------------------------
	// State
	// ---------------------------------------------------------------------------

	let weightInput = $state('');
	let bodyFatInput = $state('');
	let waistInput = $state('');
	let notesInput = $state('');
	let logDate = $state(today());
	let weightLogs = $state<WeightLog[]>([]);
	let chartCanvas = $state<HTMLCanvasElement | null>(null);
	let chartInstance = $state<Chart | null>(null);

	// ---------------------------------------------------------------------------
	// Derived
	// ---------------------------------------------------------------------------

	let isImperial = $derived(appState.unitSystem === 'imperial');
	let unitLabel = $derived(isImperial ? 'lbs' : 'kg');
	let waistUnitLabel = $derived(isImperial ? 'in' : 'cm');

	// Sort logs oldest-first for chart, newest-first for list
	let logsChronological = $derived([...weightLogs].reverse());

	// 7-day moving average
	let movingAverage = $derived(() => {
		const values: (number | null)[] = [];
		for (let i = 0; i < logsChronological.length; i++) {
			const windowStart = Math.max(0, i - 6);
			const window = logsChronological.slice(windowStart, i + 1);
			const avg = window.reduce((sum, log) => sum + log.weight_kg, 0) / window.length;
			values.push(avg);
		}
		return values;
	});

	// Weekly change rate from 7-day moving average
	let weeklyChangeRate = $derived(() => {
		const avg = movingAverage();
		if (avg.length < 2) return null;

		// Compare latest moving average to one ~7 entries ago (or earliest available)
		const latestAvg = avg[avg.length - 1];
		const compareIdx = Math.max(0, avg.length - 8);
		const compareAvg = avg[compareIdx];

		if (latestAvg === null || compareAvg === null) return null;

		const entriesSpan = avg.length - 1 - compareIdx;
		if (entriesSpan === 0) return null;

		// Calculate actual days between the entries
		const latestDate = new Date(logsChronological[logsChronological.length - 1].logged_at);
		const compareDate = new Date(logsChronological[compareIdx].logged_at);
		const daysDiff = (latestDate.getTime() - compareDate.getTime()) / (1000 * 60 * 60 * 24);

		if (daysDiff < 1) return null;

		const changeKgPerDay = (latestAvg - compareAvg) / daysDiff;
		const changeKgPerWeek = changeKgPerDay * 7;
		return changeKgPerWeek;
	});

	let changeRateText = $derived(() => {
		const rate = weeklyChangeRate();
		if (rate === null) return null;

		const absRate = Math.abs(rate);
		const displayRate = isImperial ? kgToLbs(absRate) : absRate;
		const direction = rate > 0.01 ? 'Gaining' : rate < -0.01 ? 'Losing' : 'Maintaining';
		const unit = isImperial ? 'lbs' : 'kg';

		if (direction === 'Maintaining') return 'Maintaining weight';
		return `${direction} ${displayRate.toFixed(1)} ${unit}/week`;
	});

	// ---------------------------------------------------------------------------
	// Load data
	// ---------------------------------------------------------------------------

	$effect(() => {
		if (!appState.dbReady || !appState.userId) return;
		weightLogs = getWeightLogs(appState.userId);
	});

	// ---------------------------------------------------------------------------
	// Chart
	// ---------------------------------------------------------------------------

	$effect(() => {
		if (!chartCanvas || logsChronological.length === 0) return;

		const labels = logsChronological.map((log) => {
			const dateStr = log.logged_at.split(' ')[0] ?? log.logged_at.split('T')[0];
			return formatDate(dateStr);
		});

		const rawWeights = logsChronological.map((log) =>
			isImperial ? kgToLbs(log.weight_kg) : log.weight_kg
		);

		const avgWeights = movingAverage().map((val) =>
			val !== null ? (isImperial ? kgToLbs(val) : val) : null
		);

		// Determine dark mode
		const isDark = document.documentElement.classList.contains('dark');
		const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
		const textColor = isDark ? '#9ca3af' : '#6b7280';

		if (chartInstance) {
			chartInstance.destroy();
		}

		chartInstance = new Chart(chartCanvas, {
			type: 'line',
			data: {
				labels,
				datasets: [
					{
						label: `Weight (${unitLabel})`,
						data: rawWeights,
						borderColor: '#3b82f6',
						backgroundColor: 'rgba(59, 130, 246, 0.1)',
						borderWidth: 2,
						pointRadius: 3,
						pointHoverRadius: 5,
						pointBackgroundColor: '#3b82f6',
						tension: 0.1,
						fill: false
					},
					{
						label: `7-Day Average (${unitLabel})`,
						data: avgWeights,
						borderColor: '#f59e0b',
						backgroundColor: 'transparent',
						borderWidth: 2,
						borderDash: [5, 5],
						pointRadius: 0,
						pointHoverRadius: 3,
						tension: 0.3,
						fill: false
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					mode: 'index',
					intersect: false
				},
				plugins: {
					legend: {
						labels: {
							color: textColor,
							usePointStyle: true,
							pointStyle: 'circle',
							padding: 16
						}
					},
					tooltip: {
						backgroundColor: isDark ? '#374151' : '#ffffff',
						titleColor: isDark ? '#f3f4f6' : '#111827',
						bodyColor: isDark ? '#d1d5db' : '#4b5563',
						borderColor: isDark ? '#4b5563' : '#e5e7eb',
						borderWidth: 1,
						padding: 10,
						callbacks: {
							label(ctx) {
								const val = ctx.parsed.y;
								return val == null
									? ` ${ctx.dataset.label}: —`
									: ` ${ctx.dataset.label}: ${val.toFixed(1)}`;
							}
						}
					}
				},
				scales: {
					x: {
						grid: { color: gridColor },
						ticks: {
							color: textColor,
							maxTicksLimit: 8,
							maxRotation: 45
						}
					},
					y: {
						grid: { color: gridColor },
						ticks: {
							color: textColor
						}
					}
				}
			}
		});

		return () => {
			if (chartInstance) {
				chartInstance.destroy();
				chartInstance = null;
			}
		};
	});

	// ---------------------------------------------------------------------------
	// Actions
	// ---------------------------------------------------------------------------

	function displayWeight(kg: number): string {
		return isImperial ? kgToLbs(kg).toFixed(1) : kg.toFixed(1);
	}

	async function handleLogWeight() {
		const weightVal = parseFloat(weightInput);
		if (isNaN(weightVal) || weightVal <= 0) return;

		const weightKg = isImperial ? lbsToKg(weightVal) : weightVal;

		// Build note with optional body composition data
		const noteParts: string[] = [];
		if (bodyFatInput.trim()) {
			noteParts.push(`BF: ${bodyFatInput.trim()}%`);
		}
		if (waistInput.trim()) {
			noteParts.push(`Waist: ${waistInput.trim()} ${waistUnitLabel}`);
		}
		if (notesInput.trim()) {
			noteParts.push(notesInput.trim());
		}
		const note = noteParts.length > 0 ? noteParts.join(' | ') : null;

		await createWeightLog({
			user_id: appState.userId,
			weight_kg: weightKg,
			note,
			logged_at: logDate + ' 00:00:00'
		});

		// Reset form
		weightInput = '';
		bodyFatInput = '';
		waistInput = '';
		notesInput = '';
		logDate = today();

		// Reload
		weightLogs = getWeightLogs(appState.userId);
	}

	async function handleDelete(id: string) {
		await deleteWeightLog(id);
		weightLogs = getWeightLogs(appState.userId);
	}

	function parseNoteField(note: string | null, prefix: string): string | null {
		if (!note) return null;
		const parts = note.split(' | ');
		const match = parts.find((p) => p.startsWith(prefix));
		if (!match) return null;
		return match.substring(prefix.length).trim();
	}

	function getNoteText(note: string | null): string | null {
		if (!note) return null;
		const parts = note.split(' | ');
		const filtered = parts.filter((p) => !p.startsWith('BF:') && !p.startsWith('Waist:'));
		return filtered.length > 0 ? filtered.join(' | ') : null;
	}
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
	<!-- Header -->
	<div class="sticky top-0 z-10 bg-white dark:bg-gray-800 shadow-sm">
		<div class="mx-auto flex max-w-lg items-center justify-center px-4 py-3">
			<h1 class="text-lg font-semibold text-gray-900 dark:text-white">Weight & Body Tracking</h1>
		</div>
	</div>

	<div class="mx-auto max-w-lg px-4 pt-4 space-y-4">
		<!-- ================================================================ -->
		<!-- Log Weight Form                                                  -->
		<!-- ================================================================ -->
		<div class="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm">
			<h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
				Log Weight
			</h2>

			<form
				onsubmit={(e) => { e.preventDefault(); handleLogWeight(); }}
				class="space-y-3"
			>
				<!-- Date -->
				<div>
					<label for="log-date" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Date
					</label>
					<input
						id="log-date"
						type="date"
						bind:value={logDate}
						class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					/>
				</div>

				<!-- Weight -->
				<div>
					<label for="weight-input" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Weight ({unitLabel})
					</label>
					<input
						id="weight-input"
						type="number"
						step="0.1"
						min="0"
						bind:value={weightInput}
						placeholder={isImperial ? '165.0' : '75.0'}
						required
						class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					/>
				</div>

				<!-- Body Fat % -->
				<div>
					<label for="bodyfat-input" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Body Fat % <span class="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
					</label>
					<input
						id="bodyfat-input"
						type="number"
						step="0.1"
						min="0"
						max="100"
						bind:value={bodyFatInput}
						placeholder="15.0"
						class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					/>
				</div>

				<!-- Waist -->
				<div>
					<label for="waist-input" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Waist ({waistUnitLabel}) <span class="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
					</label>
					<input
						id="waist-input"
						type="number"
						step="0.1"
						min="0"
						bind:value={waistInput}
						placeholder={isImperial ? '32.0' : '81.0'}
						class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					/>
				</div>

				<!-- Notes -->
				<div>
					<label for="notes-input" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Notes <span class="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
					</label>
					<input
						id="notes-input"
						type="text"
						bind:value={notesInput}
						placeholder="After morning workout..."
						class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					/>
				</div>

				<!-- Submit -->
				<button
					type="submit"
					class="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
				>
					Log Weight
				</button>
			</form>
		</div>

		<!-- ================================================================ -->
		<!-- Weight Change Rate                                               -->
		<!-- ================================================================ -->
		{#if changeRateText() !== null}
			<div class="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm text-center">
				<p class="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold mb-1">
					Weekly Trend
				</p>
				<p class="text-lg font-bold text-gray-900 dark:text-white">
					{changeRateText()}
				</p>
			</div>
		{/if}

		<!-- ================================================================ -->
		<!-- Trend Chart                                                      -->
		<!-- ================================================================ -->
		{#if logsChronological.length > 0}
			<div class="rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm">
				<h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
					Weight Trend
				</h2>
				<div class="relative h-64">
					<canvas bind:this={chartCanvas}></canvas>
				</div>
			</div>
		{/if}

		<!-- ================================================================ -->
		<!-- History List                                                      -->
		<!-- ================================================================ -->
		<div class="rounded-xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
			<div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
				<h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
					History
				</h2>
			</div>

			{#if weightLogs.length === 0}
				<p class="px-4 py-6 text-sm text-gray-400 dark:text-gray-500 italic text-center">
					No weight entries yet. Log your first weight above.
				</p>
			{:else}
				<div class="max-h-96 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/50">
					{#each weightLogs as log (log.id)}
						{@const dateStr = log.logged_at.split(' ')[0] ?? log.logged_at.split('T')[0]}
						{@const bodyFat = parseNoteField(log.note, 'BF: ')}
						{@const waist = parseNoteField(log.note, 'Waist: ')}
						{@const noteText = getNoteText(log.note)}
						<div class="flex items-center justify-between px-4 py-3">
							<div class="min-w-0 flex-1">
								<div class="flex items-baseline gap-2">
									<span class="text-sm font-semibold text-gray-900 dark:text-white">
										{displayWeight(log.weight_kg)} {unitLabel}
									</span>
									<span class="text-xs text-gray-500 dark:text-gray-400">
										{formatDate(dateStr)}
									</span>
								</div>
								{#if bodyFat || waist}
									<div class="flex gap-3 mt-0.5">
										{#if bodyFat}
											<span class="text-xs text-gray-500 dark:text-gray-400">
												BF: {bodyFat}
											</span>
										{/if}
										{#if waist}
											<span class="text-xs text-gray-500 dark:text-gray-400">
												Waist: {waist}
											</span>
										{/if}
									</div>
								{/if}
								{#if noteText}
									<p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
										{noteText}
									</p>
								{/if}
							</div>
							<button
								onclick={() => handleDelete(log.id)}
								class="ml-2 shrink-0 rounded-full p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 transition-colors"
								aria-label="Delete weight entry"
							>
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
								</svg>
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
