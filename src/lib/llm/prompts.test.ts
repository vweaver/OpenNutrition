import { describe, it, expect } from 'vitest';
import {
	LABEL_SCAN_SYSTEM_PROMPT,
	buildNaturalLanguagePrompt,
	buildRevisePrompt
} from './prompts';

describe('LLM prompts', () => {
	it('label scan prompt includes the JSON schema fields', () => {
		expect(LABEL_SCAN_SYSTEM_PROMPT).toContain('calories');
		expect(LABEL_SCAN_SYSTEM_PROMPT).toContain('protein_g');
		expect(LABEL_SCAN_SYSTEM_PROMPT).toContain('serving_size_text');
	});

	it('buildNaturalLanguagePrompt embeds the description', () => {
		const prompt = buildNaturalLanguagePrompt('four scrambled eggs');
		expect(prompt).toContain('four scrambled eggs');
	});

	it('buildRevisePrompt embeds current data JSON and instruction', () => {
		const current = { product_name: 'Eggs', calories: 200 };
		const prompt = buildRevisePrompt(current, 'double the serving');
		expect(prompt).toContain('"product_name": "Eggs"');
		expect(prompt).toContain('"calories": 200');
		expect(prompt).toContain('double the serving');
	});
});
