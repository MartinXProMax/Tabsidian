import { CompletionProvider, CompletionRequest, CompletionResponse, requestWithAbort, debugLog } from "./base";
import { redactDebugText } from "../services/debug-redaction";

export interface OllamaProviderConfig {
	model: string;
	baseUrl: string;
	systemPrompt: string;
	enableThinking: boolean;
	debugMode?: boolean;
	debugRedactSensitive?: boolean;
	debugMaxBodyChars?: number;
}

/** Strip `<think>...</think>` blocks from models that inline reasoning into content */
function stripThinkingTags(text: string): string {
	return text.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();
}

function isQwenThinkingModel(model: string): boolean {
	return /qwen/i.test(model);
}

function buildUserMessage(model: string, enableThinking: boolean, userMessage: string): string {
	if (!isQwenThinkingModel(model)) {
		return userMessage;
	}

	const directive = enableThinking ? "/think" : "/no_think";
	return `${directive}\n${userMessage}`;
}

export class OllamaProvider implements CompletionProvider {
	constructor(private readonly config: OllamaProviderConfig) {}

	async complete(request: CompletionRequest): Promise<CompletionResponse> {
		const baseUrl = this.config.baseUrl || "http://localhost:11434";
		const url = `${baseUrl.replace(/\/+$/, "")}/api/chat`;

		const userMessage = buildUserMessage(this.config.model, this.config.enableThinking, request.prompt);

		const bodyStr = JSON.stringify({
				model: this.config.model,
				messages: [
					{ role: "system", content: this.config.systemPrompt },
					{ role: "user", content: userMessage },
				],
				stream: false,
				think: this.config.enableThinking,
				options: {
					temperature: 0.3,
					num_predict: request.maxTokens,
				},
			});

		const response = await requestWithAbort({
			url,
			method: "POST",
			headers: {
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
				provider: "ollama",
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
			throw new Error(`API returned ${response.status}: ${JSON.stringify(response.json)}`);
		}

		const data = response.json;
		let text: string = data.message?.content ?? "";

		// Some Ollama models still inline reasoning into content even when `think` is supported.
		if (this.config.enableThinking || isQwenThinkingModel(this.config.model)) {
			text = stripThinkingTags(text);
		}

		const tokensUsed = (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0);

		return { text, tokensUsed };
	}

	async validateConfig(): Promise<boolean> {
		return this.config.model.length > 0;
	}
}
