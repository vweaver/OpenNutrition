import { describe, it, expect } from 'vitest';
import {
	SYSTEM_PROMPT,
	buildNaturalLanguagePrompt,
	buildImagePrompt,
	buildRevisePrompt
} from './prompts';

describe('LLM prompts', () => {
	it('system prompt includes the JSON schema fields', () => {
		expect(SYSTEM_PROMPT).toContain('calories');
		expect(SYSTEM_PROMPT).toContain('protein_g');
		expect(SYSTEM_PROMPT).toContain('serving_size_text');
	});

	it('system prompt is flexible about input types', () => {
		expect(SYSTEM_PROMPT).toContain('text description');
		expect(SYSTEM_PROMPT).toContain('photo');
		expect(SYSTEM_PROMPT).toContain('menu');
	});

	it('buildNaturalLanguagePrompt embeds the description', () => {
		const prompt = buildNaturalLanguagePrompt('four scrambled eggs');
		expect(prompt).toContain('four scrambled eggs');
	});

	it('buildImagePrompt without description gives generic prompt', () => {
		const prompt = buildImagePrompt();
		expect(prompt).toContain('Extract or estimate');
	});

	it('buildImagePrompt with description includes it', () => {
		const prompt = buildImagePrompt('chicken parmesan from the menu');
		expect(prompt).toContain('chicken parmesan from the menu');
	});

	it('buildRevisePrompt embeds current data JSON and instruction', () => {
		const current = { product_name: 'Eggs', calories: 200 };
		const prompt = buildRevisePrompt(current, 'double the serving');
		expect(prompt).toContain('"product_name": "Eggs"');
		expect(prompt).toContain('"calories": 200');
		expect(prompt).toContain('double the serving');
	});
});
