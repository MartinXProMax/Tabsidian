import { requestUrl, type RequestUrlParam } from "obsidian";

export interface CompletionRequest {
	prefix: string;
	suffix: string;
	prompt: string;
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

/** Captured debug info for the most recent API round-trip */
export interface DebugLogEntry {
	timestamp: number;
	provider: string;
	model: string;
	requestUrl: string;
	requestBody: string;
	responseStatus: number;
	responseBody: string;
	transport: "fetch" | "requestUrl";
	durationMs: number;
	usedFallback: boolean;
	fallbackReason?: string;
}

/** Global singleton — holds the last N debug entries (ring buffer, max 5) */
class DebugLogStore {
	private entries: DebugLogEntry[] = [];
	private readonly maxEntries = 5;

	push(entry: DebugLogEntry): void {
		this.entries.push(entry);
		if (this.entries.length > this.maxEntries) {
			this.entries.shift();
		}
	}

	getAll(): readonly DebugLogEntry[] {
		return this.entries;
	}

	clear(): void {
		this.entries = [];
	}
}

export const debugLog = new DebugLogStore();

export interface RequestWithAbortResponse {
	status: number;
	headers: Record<string, string>;
	text: string;
	json: any;
	transport: "fetch" | "requestUrl";
	durationMs: number;
	usedFallback: boolean;
	fallbackReason?: string;
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
	if (typeof fetch !== "function") {
		return requestUrlWithRace(options, signal, {
			usedFallback: true,
			fallbackReason: "fetch unavailable",
		});
	}

	return Promise.resolve()
		.then(() => fetchWithSignal(options, signal))
		.catch((err) => {
			// If the caller aborted, don't fall back — propagate immediately
			if (signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
				throw err;
			}
			// Network/CORS/platform failure — fall back to requestUrl + race
			return requestUrlWithRace(options, signal, {
				usedFallback: true,
				fallbackReason: formatFallbackReason(err),
			});
		});
}

/** Primary path: native fetch with real cancellation */
function fetchWithSignal(
	options: RequestUrlParam,
	signal: AbortSignal,
): Promise<RequestWithAbortResponse> {
	const startedAt = Date.now();
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

		return {
			status: response.status,
			headers: responseHeaders,
			text,
			json,
			transport: "fetch",
			durationMs: Date.now() - startedAt,
			usedFallback: false,
		};
	});
}

/** Fallback path: Obsidian requestUrl raced against abort signal */
function requestUrlWithRace(
	options: RequestUrlParam,
	signal: AbortSignal,
	metadata: { usedFallback: boolean; fallbackReason?: string },
): Promise<RequestWithAbortResponse> {
	if (signal.aborted) {
		return Promise.reject(new DOMException("Aborted", "AbortError"));
	}

	const startedAt = Date.now();

	return Promise.race([
		requestUrl(options).then((response) => ({
			status: response.status,
			headers: response.headers as Record<string, string>,
			text: typeof response.text === "string" ? response.text : JSON.stringify(response.json),
			json: response.json,
			transport: "requestUrl" as const,
			durationMs: Date.now() - startedAt,
			usedFallback: metadata.usedFallback,
			fallbackReason: metadata.fallbackReason,
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

function formatFallbackReason(err: unknown): string {
	if (err instanceof Error && err.message) {
		return err.message;
	}
	return String(err);
}
