export type { LLMProvider, LLMConfig, NutritionData, LLMResponse } from './types';
export { LABEL_SCAN_SYSTEM_PROMPT, buildNaturalLanguagePrompt, buildRevisePrompt } from './prompts';
export { scanLabel, describeFood, reviseFood } from './client';
