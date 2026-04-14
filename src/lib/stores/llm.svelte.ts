import type { LLMConfig } from '$lib/llm/types';

const LLM_STORAGE_KEY = 'opennutrition_llm_config';

function loadStoredConfig(): LLMConfig {
	const fallback: LLMConfig = {
		provider: 'openrouter',
		apiKey: '',
		model: 'anthropic/claude-sonnet-4-20250514',
		baseUrl: ''
	};
	if (typeof localStorage === 'undefined') return fallback;
	try {
		const stored = localStorage.getItem(LLM_STORAGE_KEY);
		if (!stored) return fallback;
		const parsed = JSON.parse(stored) as Partial<LLMConfig>;
		return {
			provider: parsed.provider ?? fallback.provider,
			apiKey: parsed.apiKey ?? '',
			model: parsed.model ?? fallback.model,
			baseUrl: parsed.baseUrl ?? ''
		};
	} catch {
		return fallback;
	}
}

class LLMState {
	config = $state<LLMConfig>(loadStoredConfig());
	scanning = $state(false);
	error = $state<string | null>(null);
}

export const llmState = new LLMState();
