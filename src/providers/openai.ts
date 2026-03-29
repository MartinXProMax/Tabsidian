import { requestUrl } from "obsidian";
import { CompletionProvider, CompletionRequest, CompletionResponse } from "./base";

export interface OpenAIProviderConfig {
	apiKey: string;
	model: string;
	baseUrl: string;
	systemPrompt: string;
}

export class OpenAIProvider implements CompletionProvider {
	constructor(private readonly config: OpenAIProviderConfig) {}

	async complete(request: CompletionRequest): Promise<CompletionResponse> {
		const url = `${this.config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

		const userMessage = request.suffix
			? `Continue writing from where the cursor is marked with [CURSOR].\n\n${request.prefix}[CURSOR]${request.suffix}`
			: `Continue writing from the end of this text:\n\n${request.prefix}`;

		const response = await requestUrl({
			url,
			method: "POST",
			headers: {
				"Authorization": `Bearer ${this.config.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: this.config.model,
				messages: [
					{ role: "system", content: this.config.systemPrompt },
					{ role: "user", content: userMessage },
				],
				max_tokens: request.maxTokens,
				temperature: 0.3,
				stream: false,
			}),
		});

		const data = response.json;
		const text = data.choices?.[0]?.message?.content ?? "";
		const tokensUsed = data.usage?.total_tokens ?? 0;

		return { text, tokensUsed };
	}

	async validateConfig(): Promise<boolean> {
		return this.config.apiKey.length > 0 && this.config.model.length > 0;
	}
}
