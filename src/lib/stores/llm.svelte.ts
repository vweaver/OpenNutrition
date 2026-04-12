import type { LLMConfig } from '$lib/llm/types';

class LLMState {
	config = $state<LLMConfig>({
		provider: 'openrouter',
		apiKey: '',
		model: 'anthropic/claude-sonnet-4-20250514',
		baseUrl: ''
	});
	scanning = $state(false);
	error = $state<string | null>(null);
}

export const llmState = new LLMState();
