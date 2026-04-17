const DATE_KEY = 'opennutrition_selected_date';

function loadDate(): string {
	if (typeof sessionStorage !== 'undefined') {
		const stored = sessionStorage.getItem(DATE_KEY);
		if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored;
	}
	return new Date().toISOString().split('T')[0];
}

class AppState {
	dbReady = $state(false);
	userId = $state<string>('');
	unitSystem = $state<'metric' | 'imperial'>('metric');
	darkMode = $state<'system' | 'light' | 'dark'>('system');

	#selectedDate = $state<string>(loadDate());

	get selectedDate(): string {
		return this.#selectedDate;
	}

	set selectedDate(value: string) {
		this.#selectedDate = value;
		if (typeof sessionStorage !== 'undefined') {
			sessionStorage.setItem(DATE_KEY, value);
		}
	}
}

export const appState = new AppState();
