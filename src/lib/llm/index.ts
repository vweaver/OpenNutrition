export type { LLMProvider, LLMConfig, NutritionData, LLMResponse } from './types';
export { LABEL_SCAN_SYSTEM_PROMPT, buildNaturalLanguagePrompt } from './prompts';
export { scanLabel, describeFood } from './client';
