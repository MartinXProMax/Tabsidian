import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAIProvider } from "../../src/providers/openai";

vi.mock("obsidian", () => ({
	requestUrl: vi.fn(),
}));

describe("OpenAIProvider", () => {
	let provider: OpenAIProvider;
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
	});

	describe("complete", () => {
		it("should send correct request and parse response", async () => {
			provider = new OpenAIProvider({
				apiKey: "sk-test",
				model: "gpt-4o-mini",
				baseUrl: "https://api.openai.com/v1",
				systemPrompt: "You are a helpful assistant.",
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
		});

		it("should throw on API error", async () => {
			provider = new OpenAIProvider({
				apiKey: "sk-test",
				model: "gpt-4o-mini",
				baseUrl: "https://api.openai.com/v1",
				systemPrompt: "Test",
			});

			fetchMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));

			const controller = new AbortController();
			controller.abort();
			await expect(
				provider.complete({
					prefix: "test",
					suffix: "",
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
			});

			fetchMock.mockResolvedValue(new Response(JSON.stringify({
				error: { message: "Unauthorized" },
			}), { status: 401 }));

			const controller = new AbortController();
			await expect(
				provider.complete({
					prefix: "test",
					suffix: "",
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
			});
			const result = await provider.validateConfig();
			expect(result).toBe(false);
		});
	});
});
