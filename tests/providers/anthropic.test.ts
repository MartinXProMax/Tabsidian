import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnthropicProvider } from "../../src/providers/anthropic";

vi.mock("obsidian", () => ({
	requestUrl: vi.fn(),
}));

describe("AnthropicProvider", () => {
	let provider: AnthropicProvider;
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		provider = new AnthropicProvider({
			apiKey: "sk-ant-test",
			model: "claude-sonnet-4-6-20250514",
			systemPrompt: "You are a helpful assistant.",
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
		});
	});

	describe("validateConfig", () => {
		it("should return false for empty API key", async () => {
			const emptyProvider = new AnthropicProvider({
				apiKey: "",
				model: "claude-sonnet-4-6-20250514",
				systemPrompt: "Test",
			});
			expect(await emptyProvider.validateConfig()).toBe(false);
		});
	});
});
