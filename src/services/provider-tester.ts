import type { CompletionProvider, CompletionResponse } from "../providers/base";

export interface ProviderTestResult {
	ok: boolean;
	message: string;
}

const TEST_TIMEOUT_MS = 15000;

export async function testProviderConnection(provider: CompletionProvider | null): Promise<ProviderTestResult> {
	if (!provider) {
		return {
			ok: false,
			message: "Provider configuration is incomplete.",
		};
	}

	const isValid = await provider.validateConfig();
	if (!isValid) {
		return {
			ok: false,
			message: "Provider configuration is invalid.",
		};
	}

	const controller = new AbortController();
	let timeout: ReturnType<typeof setTimeout> | null = null;

	try {
		const response = await Promise.race<CompletionResponse>([
			provider.complete({
				prefix: "Reply with OK only.",
				suffix: "",
				prompt: "Reply with OK only.",
				language: "markdown",
				maxTokens: 8,
				signal: controller.signal,
			}),
			new Promise<CompletionResponse>((_, reject) => {
				timeout = setTimeout(() => {
					controller.abort();
					reject(new DOMException("Aborted", "AbortError"));
				}, TEST_TIMEOUT_MS);
			}),
		]);

		const preview = response.text.trim();
		return {
			ok: true,
			message: preview.length > 0
				? `Connection succeeded. Model replied: ${preview}`
				: "Connection succeeded.",
		};
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			return {
				ok: false,
				message: "Connection test timed out.",
			};
		}

		return {
			ok: false,
			message: error instanceof Error ? error.message : "Connection test failed.",
		};
	} finally {
		if (timeout) {
			clearTimeout(timeout);
		}
	}
}
