class AppState {
	dbReady = $state(false);
	userId = $state<string>('');
	unitSystem = $state<'metric' | 'imperial'>('metric');
	darkMode = $state<'system' | 'light' | 'dark'>('system');
	selectedDate = $state<string>(new Date().toISOString().split('T')[0]);
}

export const appState = new AppState();
