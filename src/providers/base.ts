import { requestUrl, type RequestUrlParam } from "obsidian";

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

export interface RequestWithAbortResponse {
	status: number;
	headers: Record<string, string>;
	text: string;
	json: any;
}

/**
 * Sends an HTTP request with AbortSignal support.
 *
 * Strategy: try native fetch first (supports real TCP-level cancellation),
 * fall back to Obsidian's requestUrl (bypasses CORS but no true cancellation)
 * when fetch fails due to CORS, network policy, or platform restrictions
 * (e.g. Obsidian Mobile's WKWebView).
 */
export function requestWithAbort(
	options: RequestUrlParam,
	signal: AbortSignal,
): Promise<RequestWithAbortResponse> {
	return fetchWithSignal(options, signal).catch((err) => {
		// If the caller aborted, don't fall back — propagate immediately
		if (signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
			throw err;
		}
		// Network/CORS/platform failure — fall back to requestUrl + race
		return requestUrlWithRace(options, signal);
	});
}

/** Primary path: native fetch with real cancellation */
function fetchWithSignal(
	options: RequestUrlParam,
	signal: AbortSignal,
): Promise<RequestWithAbortResponse> {
	const headers = new Headers(options.headers);
	if (options.contentType && !headers.has("Content-Type")) {
		headers.set("Content-Type", options.contentType);
	}

	return fetch(options.url, {
		method: options.method,
		headers,
		body: options.body,
		signal,
	}).then(async (response) => {
		const text = await response.text();
		let json: any = null;
		if (text.length > 0) {
			try {
				json = JSON.parse(text);
			} catch {
				json = null;
			}
		}

		const responseHeaders: Record<string, string> = {};
		response.headers.forEach((value, key) => {
			responseHeaders[key] = value;
		});

		return { status: response.status, headers: responseHeaders, text, json };
	});
}

/** Fallback path: Obsidian requestUrl raced against abort signal */
function requestUrlWithRace(
	options: RequestUrlParam,
	signal: AbortSignal,
): Promise<RequestWithAbortResponse> {
	if (signal.aborted) {
		return Promise.reject(new DOMException("Aborted", "AbortError"));
	}

	return Promise.race([
		requestUrl(options).then((response) => ({
			status: response.status,
			headers: response.headers as Record<string, string>,
			text: typeof response.text === "string" ? response.text : JSON.stringify(response.json),
			json: response.json,
		})),
		new Promise<never>((_, reject) => {
			signal.addEventListener(
				"abort",
				() => reject(new DOMException("Aborted", "AbortError")),
				{ once: true },
			);
		}),
	]);
}
