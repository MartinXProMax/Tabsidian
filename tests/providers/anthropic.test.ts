import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnthropicProvider } from "../../src/providers/anthropic";
import { debugLog } from "../../src/providers/base";

vi.mock("obsidian", () => ({
	requestUrl: vi.fn(),
}));

describe("AnthropicProvider", () => {
	let provider: AnthropicProvider;
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		debugLog.clear();
		provider = new AnthropicProvider({
			apiKey: "sk-ant-test",
			model: "claude-sonnet-4-6-20250514",
			systemPrompt: "You are a helpful assistant.",
			enableThinking: false,
			thinkingBudget: 1024,
		});
	});

	describe("complete", () => {
		it("should send correct Anthropic Messages API request", async () => {
			fetchMock.mockResolvedValue(new Response(JSON.stringify({
				content: [{ type: "text", text: "anthropic completion" }],
				usage: { input_tokens: 10, output_tokens: 15 },
			}), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}));

			const controller = new AbortController();
			const result = await provider.complete({
				prefix: "Hello ",
				suffix: "",
				prompt: "Shared prompt body",
				language: "markdown",
				maxTokens: 100,
				signal: controller.signal,
			});

			expect(result.text).toBe("anthropic completion");
			expect(result.tokensUsed).toBe(25);

			expect(fetchMock).toHaveBeenCalledWith("https://api.anthropic.com/v1/messages", expect.objectContaining({
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
				"x-api-key": "sk-ant-test",
				"anthropic-version": "2023-06-01",
				"content-type": "application/json",
			});

			const body = JSON.parse(String(requestInit?.body));
			expect(body.messages[0].content).toBe("Shared prompt body");
		});

		it("should capture redacted debug metadata", async () => {
			provider = new AnthropicProvider({
				apiKey: "sk-ant-test",
				model: "claude-sonnet-4-6-20250514",
				systemPrompt: "You are a helpful assistant.",
				enableThinking: false,
				thinkingBudget: 1024,
				debugMode: true,
				debugRedactSensitive: true,
				debugMaxBodyChars: 500,
			});

			fetchMock.mockResolvedValue(new Response(JSON.stringify({
				content: [{ type: "text", text: "anthropic completion" }],
				usage: { input_tokens: 10, output_tokens: 15 },
			}), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}));

			await provider.complete({
				prefix: "",
				suffix: "",
				prompt: "contains sk-anthropic-secret-12345678 in prompt",
				language: "markdown",
				maxTokens: 100,
				signal: new AbortController().signal,
			});

			const entry = debugLog.getAll()[0];
			expect(entry).toBeDefined();
			expect(entry!).toMatchObject({
				provider: "anthropic",
				model: "claude-sonnet-4-6-20250514",
				requestUrl: "https://api.anthropic.com/v1/messages",
				responseStatus: 200,
				transport: "fetch",
				usedFallback: false,
			});
			expect(entry!.durationMs).toBeTypeOf("number");
			expect(entry!.requestBody).toContain("[REDACTED]");
			expect(entry!.requestBody).not.toContain("sk-anthropic-secret-12345678");
		});

		it("should throw on HTTP 4xx/5xx", async () => {
			fetchMock.mockResolvedValue(new Response(JSON.stringify({
				error: { message: "Unauthorized" },
			}), { status: 401 }));

			await expect(
				provider.complete({
					prefix: "test",
					suffix: "",
					prompt: "test",
					language: "markdown",
					maxTokens: 100,
					signal: new AbortController().signal,
				})
			).rejects.toThrow("API returned 401");
		});
	});

	describe("validateConfig", () => {
		it("should return false for empty API key", async () => {
			const emptyProvider = new AnthropicProvider({
				apiKey: "",
				model: "claude-sonnet-4-6-20250514",
				systemPrompt: "Test",
				enableThinking: false,
				thinkingBudget: 1024,
			});
			expect(await emptyProvider.validateConfig()).toBe(false);
		});
	});
});
