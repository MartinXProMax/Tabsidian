import { requestUrl, type RequestUrlParam, type RequestUrlResponse } from "obsidian";

export interface CompletionRequest {
	prefix: string;
	suffix: string;
	language: string;
	maxTokens: number;
	signal: AbortSignal;
}

export interface CompletionResponse {
	text: string;
	tokensUsed: number;
}

export interface CompletionProvider {
	complete(request: CompletionRequest): Promise<CompletionResponse>;
	validateConfig(): Promise<boolean>;
}

/**
 * Wraps Obsidian's requestUrl with AbortSignal support.
 * requestUrl itself doesn't accept a signal, so we race the
 * request promise against the abort event. When the signal fires,
 * the returned promise rejects immediately with AbortError,
 * preventing stale results from being processed.
 */
export function requestWithAbort(
	options: RequestUrlParam,
	signal: AbortSignal,
): Promise<RequestUrlResponse> {
	if (signal.aborted) {
		return Promise.reject(new DOMException("Aborted", "AbortError"));
	}

	return Promise.race([
		requestUrl(options),
		new Promise<never>((_, reject) => {
			signal.addEventListener(
				"abort",
				() => reject(new DOMException("Aborted", "AbortError")),
				{ once: true },
			);
		}),
	]);
}
