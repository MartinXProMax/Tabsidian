import { requestUrl } from "obsidian";
import { CompletionProvider, CompletionRequest, CompletionResponse } from "./base";

export interface AnthropicProviderConfig {
	apiKey: string;
	model: string;
	systemPrompt: string;
}

export class AnthropicProvider implements CompletionProvider {
	private readonly baseUrl = "https://api.anthropic.com/v1";

	constructor(private readonly config: AnthropicProviderConfig) {}

	async complete(request: CompletionRequest): Promise<CompletionResponse> {
		const userMessage = request.suffix
			? `Continue writing from where the cursor is marked with [CURSOR].\n\n${request.prefix}[CURSOR]${request.suffix}`
			: `Continue writing from the end of this text:\n\n${request.prefix}`;

		const response = await requestUrl({
			url: `${this.baseUrl}/messages`,
			method: "POST",
			headers: {
				"x-api-key": this.config.apiKey,
				"anthropic-version": "2023-06-01",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: this.config.model,
				max_tokens: request.maxTokens,
				system: this.config.systemPrompt,
				messages: [
					{ role: "user", content: userMessage },
				],
			}),
		});

		const data = response.json;
		const text = data.content?.[0]?.text ?? "";
		const tokensUsed = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);

		return { text, tokensUsed };
	}

	async validateConfig(): Promise<boolean> {
		return this.config.apiKey.length > 0 && this.config.model.length > 0;
	}
}
