<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { initDatabase, getDb, saveDatabase } from '$lib/db';
	import { appState } from '$lib/stores/app.svelte';

	let { children } = $props();

	onMount(async () => {
		try {
			await initDatabase();
			appState.dbReady = true;

			// Create a default user profile if none exists
			const db = getDb();
			const result = db.exec('SELECT id FROM user_profile LIMIT 1');
			if (result.length === 0 || result[0].values.length === 0) {
				db.run(
					`INSERT INTO user_profile (id, name, calorie_target, protein_target_g, carb_target_g, fat_target_g)
					 VALUES (lower(hex(randomblob(16))), 'User', 2000, 150, 250, 65)`
				);
				await saveDatabase();
			}

			// Store the user ID and load unit preference
			const userResult = db.exec('SELECT id, unit_system FROM user_profile LIMIT 1');
			if (userResult.length > 0 && userResult[0].values.length > 0) {
				appState.userId = userResult[0].values[0][0] as string;
				const unit = userResult[0].values[0][1] as string | null;
				if (unit === 'metric' || unit === 'imperial') {
					appState.unitSystem = unit;
				}
			}
		} catch (err) {
			console.error('Failed to initialize database:', err);
		}
	});

	const navItems = [
		{
			label: 'Dashboard',
			href: `${base}/`,
			match: '/',
			icon: 'dashboard'
		},
		{
			label: 'Weight',
			href: `${base}/weight`,
			match: '/weight',
			icon: 'weight'
		},
		{
			label: 'Foods',
			href: `${base}/foods`,
			match: '/foods',
			icon: 'foods'
		},
		{
			label: 'Settings',
			href: `${base}/settings`,
			match: '/settings',
			icon: 'settings'
		}
	];

	function isActive(match: string): boolean {
		const pathname = page.url.pathname;
		const rel = pathname.replace(base, '') || '/';
		if (match === '/') return rel === '/';
		return rel.startsWith(match);
	}
</script>

{#if !appState.dbReady}
	<!-- Loading spinner -->
	<div class="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-gray-900">
		<div class="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary-200 border-t-primary-500"></div>
		<p class="text-lg font-medium text-gray-600 dark:text-gray-300">Loading OpenNutrition...</p>
	</div>
{:else}
	<div class="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
		<!-- Main content area -->
		<main class="flex-1 overflow-y-auto pb-20">
			{@render children()}
		</main>

		<!-- Bottom navigation bar -->
		<nav class="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
			<div class="mx-auto flex h-16 max-w-lg items-center justify-around">
				{#each navItems as item}
					<a
						href={item.href}
						class="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors {isActive(item.match)
							? 'text-primary-600 dark:text-primary-400'
							: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}"
					>
						{#if item.icon === 'dashboard'}
							<!-- Home / Dashboard icon -->
							<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
							</svg>
						{:else if item.icon === 'weight'}
							<!-- Scale / Weight icon -->
							<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m-8-9H3m18 0h-1M5.636 5.636l.707.707m11.314 11.314l.707.707M5.636 18.364l.707-.707m11.314-11.314l.707-.707" />
								<circle cx="12" cy="12" r="7" />
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3l2 2" />
							</svg>
						{:else if item.icon === 'foods'}
							<!-- Utensils / Foods icon -->
							<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								<path stroke-linecap="round" stroke-linejoin="round" d="M15 4h3a2 2 0 012 2v0M7 4v8m0 4v4M17 4v16M9 4a2 2 0 00-2 2v0m6-2h.01" />
							</svg>
						{:else if item.icon === 'settings'}
							<!-- Gear / Settings icon -->
							<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
								<circle cx="12" cy="12" r="3" />
							</svg>
						{/if}
						<span class="text-xs font-medium">{item.label}</span>
					</a>
				{/each}
			</div>

			<!-- Safe area padding for devices with home indicators -->
			<div class="h-[env(safe-area-inset-bottom)]"></div>
		</nav>
	</div>
{/if}
