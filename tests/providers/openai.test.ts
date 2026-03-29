import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAIProvider } from "../../src/providers/openai";

vi.mock("obsidian", () => ({
	requestUrl: vi.fn(),
}));

import { requestUrl } from "obsidian";

describe("OpenAIProvider", () => {
	let provider: OpenAIProvider;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("complete", () => {
		it("should send correct request and parse response", async () => {
			provider = new OpenAIProvider({
				apiKey: "sk-test",
				model: "gpt-4o-mini",
				baseUrl: "https://api.openai.com/v1",
				systemPrompt: "You are a helpful assistant.",
			});

			vi.mocked(requestUrl).mockResolvedValue({
				json: {
					choices: [{ message: { content: "completion text" } }],
					usage: { total_tokens: 42 },
				},
				status: 200,
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
				text: "",
			});

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

			expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({
				url: "https://api.openai.com/v1/chat/completions",
				method: "POST",
				headers: expect.objectContaining({
					"Authorization": "Bearer sk-test",
					"Content-Type": "application/json",
				}),
			}));
		});

		it("should throw on API error", async () => {
			provider = new OpenAIProvider({
				apiKey: "sk-test",
				model: "gpt-4o-mini",
				baseUrl: "https://api.openai.com/v1",
				systemPrompt: "Test",
			});

			vi.mocked(requestUrl).mockRejectedValue(new Error("Network error"));

			const controller = new AbortController();
			await expect(
				provider.complete({
					prefix: "test",
					suffix: "",
					language: "markdown",
					maxTokens: 100,
					signal: controller.signal,
				})
			).rejects.toThrow("Network error");
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
