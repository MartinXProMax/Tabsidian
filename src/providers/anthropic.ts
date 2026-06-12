import { CompletionProvider, CompletionRequest, CompletionResponse, requestWithAbort, debugLog } from "./base";
import { redactDebugText } from "../services/debug-redaction";

export interface AnthropicProviderConfig {
	apiKey: string;
	model: string;
	systemPrompt: string;
	enableThinking: boolean;
	thinkingBudget: number;
	debugMode?: boolean;
	debugRedactSensitive?: boolean;
	debugMaxBodyChars?: number;
}

export class AnthropicProvider implements CompletionProvider {
	private readonly baseUrl = "https://api.anthropic.com/v1";

	constructor(private readonly config: AnthropicProviderConfig) {}

	async complete(request: CompletionRequest): Promise<CompletionResponse> {
		const thinking = false;

		const body: Record<string, unknown> = {
			model: this.config.model,
			system: this.config.systemPrompt,
			messages: [
				{ role: "user", content: request.prompt },
			],
		};

		if (thinking) {
			// Extended thinking: budget_tokens for reasoning, max_tokens covers total
			body.max_tokens = this.config.thinkingBudget + request.maxTokens;
			body.thinking = {
				type: "enabled",
				budget_tokens: this.config.thinkingBudget,
			};
			body.temperature = 1; // Required when thinking is enabled
		} else {
			body.max_tokens = request.maxTokens;
		}

		const bodyStr = JSON.stringify(body);
		const response = await requestWithAbort({
			url: `${this.baseUrl}/messages`,
			method: "POST",
			headers: {
				"x-api-key": this.config.apiKey,
				"anthropic-version": "2023-06-01",
				"Content-Type": "application/json",
			},
			body: bodyStr,
		}, request.signal);

		if (this.config.debugMode) {
			const sanitize = (text: string) => this.config.debugRedactSensitive === false
				? text
				: redactDebugText(text, { maxChars: this.config.debugMaxBodyChars });
			debugLog.push({
				timestamp: Date.now(),
				provider: "anthropic",
				model: this.config.model,
				requestUrl: `${this.baseUrl}/messages`,
				requestBody: sanitize(bodyStr),
				responseStatus: response.status,
				responseBody: sanitize(response.text),
				transport: response.transport,
				durationMs: response.durationMs,
				usedFallback: response.usedFallback,
				fallbackReason: response.fallbackReason,
			});
		}

		if (response.status >= 400) {
			throw new Error(`API returned ${response.status}: ${response.text || JSON.stringify(response.json)}`);
		}

		const data = response.json as { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } } | null;

		// Extract text blocks from response (robust to unexpected content order)
		let text: string;
		if (Array.isArray(data?.content)) {
			text = data.content
				.filter((block) => block.type === "text" && typeof block.text === "string")
				.map((block) => block.text as string)
				.join("");
		} else {
			text = "";
		}

		const tokensUsed = (data?.usage?.input_tokens ?? 0) + (data?.usage?.output_tokens ?? 0);

		return { text, tokensUsed };
	}

	async validateConfig(): Promise<boolean> {
		return this.config.apiKey.length > 0 && this.config.model.length > 0;
	}
}
