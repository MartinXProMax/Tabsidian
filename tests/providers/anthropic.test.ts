import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnthropicProvider } from "../../src/providers/anthropic";

vi.mock("obsidian", () => ({
	requestUrl: vi.fn(),
}));

import { requestUrl } from "obsidian";

describe("AnthropicProvider", () => {
	let provider: AnthropicProvider;

	beforeEach(() => {
		vi.clearAllMocks();
		provider = new AnthropicProvider({
			apiKey: "sk-ant-test",
			model: "claude-sonnet-4-6-20250514",
			systemPrompt: "You are a helpful assistant.",
		});
	});

	describe("complete", () => {
		it("should send correct Anthropic Messages API request", async () => {
			vi.mocked(requestUrl).mockResolvedValue({
				json: {
					content: [{ type: "text", text: "anthropic completion" }],
					usage: { input_tokens: 10, output_tokens: 15 },
				},
				status: 200,
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
				text: "",
			});

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

			expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({
				url: "https://api.anthropic.com/v1/messages",
				method: "POST",
				headers: expect.objectContaining({
					"x-api-key": "sk-ant-test",
					"anthropic-version": "2023-06-01",
				}),
			}));
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
