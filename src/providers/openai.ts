import { CompletionProvider, CompletionRequest, CompletionResponse, requestWithAbort, debugLog } from "./base";
import { redactDebugText } from "../services/debug-redaction";

export interface OpenAIProviderConfig {
	apiKey: string;
	model: string;
	baseUrl: string;
	systemPrompt: string;
	enableThinking: boolean;
	debugMode?: boolean;
	debugRedactSensitive?: boolean;
	debugMaxBodyChars?: number;
}

export class OpenAIProvider implements CompletionProvider {
	constructor(private readonly config: OpenAIProviderConfig) {}

	async complete(request: CompletionRequest): Promise<CompletionResponse> {
		const url = `${this.config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

		const thinking = false;

		// Thinking models (o1/o3/o4-mini) use "developer" role instead of "system"
		const systemRole = thinking ? "developer" : "system";
		const messages = [
			{ role: systemRole, content: this.config.systemPrompt },
			{ role: "user", content: request.prompt },
		];

		const body: Record<string, unknown> = {
			model: this.config.model,
			messages,
			stream: false,
		};

		if (thinking) {
			// Thinking models: use max_completion_tokens, no temperature
			body.max_completion_tokens = request.maxTokens;
		} else {
			body.max_tokens = request.maxTokens;
			body.temperature = 0.3;
		}

		const bodyStr = JSON.stringify(body);
		const response = await requestWithAbort({
			url,
			method: "POST",
			headers: {
				"Authorization": `Bearer ${this.config.apiKey}`,
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
				provider: "openai-compatible",
				model: this.config.model,
				requestUrl: url,
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

		const data = response.json as { choices?: Array<{ message?: { content?: unknown } }>; usage?: { total_tokens?: number } } | null;
		const content = data?.choices?.[0]?.message?.content;
		const text = typeof content === "string" ? content : "";
		const tokensUsed = data?.usage?.total_tokens ?? 0;

		return { text, tokensUsed };
	}

	async validateConfig(): Promise<boolean> {
		return this.config.apiKey.length > 0 && this.config.model.length > 0;
	}
}
