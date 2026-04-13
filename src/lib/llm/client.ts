import type { LLMConfig, NutritionData } from './types';
import { LABEL_SCAN_SYSTEM_PROMPT, buildNaturalLanguagePrompt } from './prompts';

/**
 * Resolve the chat completions endpoint URL for a given provider.
 */
function getEndpoint(config: LLMConfig): string {
	if (config.baseUrl) {
		return config.baseUrl;
	}

	switch (config.provider) {
		case 'openrouter':
			return 'https://openrouter.ai/api/v1/chat/completions';
		case 'ollama':
			return 'http://localhost:11434/v1/chat/completions';
		case 'openai':
			return 'https://api.openai.com/v1/chat/completions';
		case 'anthropic':
			return 'https://api.anthropic.com/v1/messages';
		default:
			throw new Error(`Unsupported LLM provider: ${config.provider}`);
	}
}

/**
 * Build the request for Anthropic's Messages API format.
 */
function buildAnthropicRequest(config: LLMConfig, imageBase64: string) {
	const mediaType = detectMediaType(imageBase64);
	// Strip the data URL prefix if present
	const base64Data = imageBase64.replace(/^data:image\/[^;]+;base64,/, '');

	return {
		url: getEndpoint(config),
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': config.apiKey,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model: config.model,
			max_tokens: 4096,
			system: LABEL_SCAN_SYSTEM_PROMPT,
			messages: [
				{
					role: 'user',
					content: [
						{
							type: 'image',
							source: {
								type: 'base64',
								media_type: mediaType,
								data: base64Data
							}
						},
						{
							type: 'text',
							text: 'Extract the nutrition data from this label.'
						}
					]
				}
			]
		})
	};
}

/**
 * Build the request for OpenAI-compatible chat completions format.
 * Works for openrouter, ollama, and openai providers.
 */
function buildOpenAICompatibleRequest(config: LLMConfig, imageBase64: string) {
	// Ensure the image has a data URL prefix
	const imageUrl = imageBase64.startsWith('data:')
		? imageBase64
		: `data:image/jpeg;base64,${imageBase64}`;

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${config.apiKey}`
	};

	// OpenRouter recommends additional headers
	if (config.provider === 'openrouter') {
		headers['HTTP-Referer'] = 'https://opennutrition.app';
		headers['X-Title'] = 'OpenNutrition';
	}

	return {
		url: getEndpoint(config),
		headers,
		body: JSON.stringify({
			model: config.model,
			messages: [
				{
					role: 'system',
					content: LABEL_SCAN_SYSTEM_PROMPT
				},
				{
					role: 'user',
					content: [
						{
							type: 'image_url',
							image_url: {
								url: imageUrl
							}
						},
						{
							type: 'text',
							text: 'Extract the nutrition data from this label.'
						}
					]
				}
			],
			max_tokens: 4096,
			temperature: 0
		})
	};
}

/**
 * Detect the media type from a base64 data URL or default to jpeg.
 */
function detectMediaType(imageBase64: string): string {
	const match = imageBase64.match(/^data:(image\/[^;]+);base64,/);
	if (match) {
		return match[1];
	}
	return 'image/jpeg';
}

/**
 * Extract the text content from a provider-specific response body.
 */
function extractResponseText(provider: LLMConfig['provider'], responseBody: unknown): string {
	const body = responseBody as Record<string, unknown>;

	if (provider === 'anthropic') {
		// Anthropic Messages API: { content: [{ type: "text", text: "..." }] }
		const content = body.content as Array<{ type: string; text: string }>;
		if (!content || content.length === 0) {
			throw new Error('Anthropic response contained no content blocks');
		}
		const textBlock = content.find((block) => block.type === 'text');
		if (!textBlock) {
			throw new Error('Anthropic response contained no text block');
		}
		return textBlock.text;
	}

	// OpenAI-compatible format: { choices: [{ message: { content: "..." } }] }
	const choices = body.choices as Array<{ message: { content: string } }>;
	if (!choices || choices.length === 0) {
		throw new Error('LLM response contained no choices');
	}
	return choices[0].message.content;
}

/**
 * Parse a JSON string from the LLM response, handling markdown code fences.
 */
function parseNutritionJSON(text: string): NutritionData {
	// Strip markdown code fences if present
	let cleaned = text.trim();
	const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fenceMatch) {
		cleaned = fenceMatch[1].trim();
	}

	let parsed: NutritionData;
	try {
		parsed = JSON.parse(cleaned);
	} catch {
		throw new Error(`Failed to parse nutrition JSON from LLM response: ${cleaned.slice(0, 200)}`);
	}

	// Validate minimum required field
	if (parsed.calories === undefined || parsed.calories === null) {
		throw new Error(
			'LLM response is missing the required "calories" field. The model may not have been able to read the label.'
		);
	}

	return parsed;
}

/**
 * Scan a nutrition label image using the configured LLM provider.
 *
 * @param config - LLM provider configuration (provider, apiKey, model, optional baseUrl)
 * @param imageBase64 - Base64-encoded image, optionally with a data URL prefix
 * @returns Parsed NutritionData extracted from the label
 */
export async function scanLabel(config: LLMConfig, imageBase64: string): Promise<NutritionData> {
	const request =
		config.provider === 'anthropic'
			? buildAnthropicRequest(config, imageBase64)
			: buildOpenAICompatibleRequest(config, imageBase64);

	let response: Response;
	try {
		response = await fetch(request.url, {
			method: 'POST',
			headers: request.headers,
			body: request.body
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`Network error connecting to ${config.provider}: ${message}`);
	}

	if (!response.ok) {
		let errorDetail: string;
		try {
			const errorBody = await response.text();
			errorDetail = errorBody.slice(0, 500);
		} catch {
			errorDetail = response.statusText;
		}
		throw new Error(
			`${config.provider} API returned ${response.status}: ${errorDetail}`
		);
	}

	const responseBody = await response.json();
	const text = extractResponseText(config.provider, responseBody);
	return parseNutritionJSON(text);
}

/**
 * Build a text-only request using the natural language description.
 */
function buildTextRequest(config: LLMConfig, description: string) {
	const userPrompt = buildNaturalLanguagePrompt(description);

	if (config.provider === 'anthropic') {
		return {
			url: getEndpoint(config),
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': config.apiKey,
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify({
				model: config.model,
				max_tokens: 4096,
				system: LABEL_SCAN_SYSTEM_PROMPT,
				messages: [{ role: 'user', content: userPrompt }]
			})
		};
	}

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${config.apiKey}`
	};
	if (config.provider === 'openrouter') {
		headers['HTTP-Referer'] = 'https://opennutrition.app';
		headers['X-Title'] = 'OpenNutrition';
	}

	return {
		url: getEndpoint(config),
		headers,
		body: JSON.stringify({
			model: config.model,
			messages: [
				{ role: 'system', content: LABEL_SCAN_SYSTEM_PROMPT },
				{ role: 'user', content: userPrompt }
			],
			max_tokens: 4096,
			temperature: 0
		})
	};
}

/**
 * Estimate nutrition for a plain-text food description.
 *
 * @param config - LLM provider configuration
 * @param description - e.g. "four scrambled eggs with butter"
 */
export async function describeFood(config: LLMConfig, description: string): Promise<NutritionData> {
	const request = buildTextRequest(config, description);

	let response: Response;
	try {
		response = await fetch(request.url, {
			method: 'POST',
			headers: request.headers,
			body: request.body
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`Network error connecting to ${config.provider}: ${message}`);
	}

	if (!response.ok) {
		let errorDetail: string;
		try {
			errorDetail = (await response.text()).slice(0, 500);
		} catch {
			errorDetail = response.statusText;
		}
		throw new Error(`${config.provider} API returned ${response.status}: ${errorDetail}`);
	}

	const responseBody = await response.json();
	const text = extractResponseText(config.provider, responseBody);
	return parseNutritionJSON(text);
}
