import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAIProvider } from "../../src/providers/openai";
import { debugLog } from "../../src/providers/base";

vi.mock("obsidian", () => ({
	requestUrl: vi.fn(),
}));

describe("OpenAIProvider", () => {
	let provider: OpenAIProvider;
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		debugLog.clear();
	});

	describe("complete", () => {
		it("should send correct request and parse response", async () => {
			provider = new OpenAIProvider({
				apiKey: "sk-test",
				model: "gpt-4o-mini",
				baseUrl: "https://api.openai.com/v1",
				systemPrompt: "You are a helpful assistant.",
				enableThinking: false,
			});

			fetchMock.mockResolvedValue(new Response(JSON.stringify({
				choices: [{ message: { content: "completion text" } }],
				usage: { total_tokens: 42 },
			}), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}));

			const controller = new AbortController();
			const result = await provider.complete({
				prefix: "Hello ",
				suffix: " world",
				prompt: "Shared prompt body",
				language: "markdown",
				maxTokens: 100,
				signal: controller.signal,
			});

			expect(result.text).toBe("completion text");
			expect(result.tokensUsed).toBe(42);

			expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/chat/completions", expect.objectContaining({
				method: "POST",
				signal: controller.signal,
			}));
			const requestInit = fetchMock.mock.calls[0]?.[1];
			expect(requestInit).toBeDefined();
			const headers = requestInit?.headers instanceof Headers
				? Object.fromEntries(requestInit.headers.entries())
				: requestInit?.headers;
			// Headers normalizes keys to lowercase
			expect(headers).toMatchObject({
				"authorization": "Bearer sk-test",
				"content-type": "application/json",
			});

			const body = JSON.parse(String(requestInit?.body));
			expect(body.messages[1].content).toBe("Shared prompt body");
		});

		it("should capture redacted debug metadata", async () => {
			provider = new OpenAIProvider({
				apiKey: "sk-test",
				model: "gpt-4o-mini",
				baseUrl: "https://api.openai.com/v1",
				systemPrompt: "You are a helpful assistant.",
				enableThinking: false,
				debugMode: true,
				debugRedactSensitive: true,
				debugMaxBodyChars: 500,
			});

			fetchMock.mockResolvedValue(new Response(JSON.stringify({
				choices: [{ message: { content: "completion text" } }],
				usage: { total_tokens: 42 },
			}), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}));

			await provider.complete({
				prefix: "",
				suffix: "",
				prompt: "contains sk-secret-token-12345678 in prompt",
				language: "markdown",
				maxTokens: 100,
				signal: new AbortController().signal,
			});

			const entry = debugLog.getAll()[0];
			expect(entry).toBeDefined();
			expect(entry!).toMatchObject({
				provider: "openai-compatible",
				model: "gpt-4o-mini",
				requestUrl: "https://api.openai.com/v1/chat/completions",
				responseStatus: 200,
				transport: "fetch",
				usedFallback: false,
			});
			expect(entry!.durationMs).toBeTypeOf("number");
			expect(entry!.requestBody).toContain("[REDACTED]");
			expect(entry!.requestBody).not.toContain("sk-secret-token-12345678");
		});

		it("should throw on API error", async () => {
			provider = new OpenAIProvider({
				apiKey: "sk-test",
				model: "gpt-4o-mini",
				baseUrl: "https://api.openai.com/v1",
				systemPrompt: "Test",
				enableThinking: false,
			});

			fetchMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));

			const controller = new AbortController();
			controller.abort();
			await expect(
				provider.complete({
					prefix: "test",
					suffix: "",
					prompt: "test",
					language: "markdown",
					maxTokens: 100,
					signal: controller.signal,
				})
			).rejects.toMatchObject({ name: "AbortError" });
		});

		it("should throw on HTTP 4xx/5xx", async () => {
			provider = new OpenAIProvider({
				apiKey: "sk-test",
				model: "gpt-4o-mini",
				baseUrl: "https://api.openai.com/v1",
				systemPrompt: "Test",
				enableThinking: false,
			});

			fetchMock.mockResolvedValue(new Response(JSON.stringify({
				error: { message: "Unauthorized" },
			}), { status: 401 }));

			const controller = new AbortController();
			await expect(
				provider.complete({
					prefix: "test",
					suffix: "",
					prompt: "test",
					language: "markdown",
					maxTokens: 100,
					signal: controller.signal,
				})
			).rejects.toThrow("API returned 401");
		});
	});

	describe("validateConfig", () => {
		it("should return true for valid config", async () => {
			provider = new OpenAIProvider({
				apiKey: "sk-test",
				model: "gpt-4o-mini",
				baseUrl: "https://api.openai.com/v1",
				systemPrompt: "Test",
				enableThinking: false,
			});
			const result = await provider.validateConfig();
			expect(result).toBe(true);
		});

		it("should return false for empty API key", async () => {
			provider = new OpenAIProvider({
				apiKey: "",
				model: "gpt-4o-mini",
				baseUrl: "https://api.openai.com/v1",
				systemPrompt: "Test",
				enableThinking: false,
			});
			const result = await provider.validateConfig();
			expect(result).toBe(false);
		});
	});
});
