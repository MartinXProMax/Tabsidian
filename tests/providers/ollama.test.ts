import { beforeEach, describe, expect, it, vi } from "vitest";
import { OllamaProvider } from "../../src/providers/ollama";
import { debugLog } from "../../src/providers/base";

describe("OllamaProvider", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		debugLog.clear();
	});

	it("should force thinking mode off even when requested", async () => {
		const provider = new OllamaProvider({
			model: "qwen3.5:latest",
			baseUrl: "http://localhost:11434",
			systemPrompt: "You are a helpful assistant.",
			enableThinking: true,
		});

		fetchMock.mockResolvedValue(new Response(JSON.stringify({
			message: {
				content: "<think>reasoning</think>completion text",
			},
			prompt_eval_count: 10,
			eval_count: 8,
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
			maxTokens: 64,
			signal: controller.signal,
		});

		expect(result).toEqual({
			text: "completion text",
			tokensUsed: 18,
		});

		const requestInit = fetchMock.mock.calls[0]?.[1];
		expect(fetchMock).toHaveBeenCalledWith("http://localhost:11434/api/chat", expect.objectContaining({
			method: "POST",
			signal: controller.signal,
		}));
		const body = JSON.parse(String(requestInit?.body));
		expect(body.think).toBe(false);
		expect(body.options).toMatchObject({
			temperature: 0.3,
			num_predict: 64,
		});
		expect(body.messages[1].content).toContain("/no_think");
		expect(body.messages[1].content).toContain("Shared prompt body");
	});

	it("should disable thinking explicitly for Qwen models", async () => {
		const provider = new OllamaProvider({
			model: "qwen3.5:latest",
			baseUrl: "http://localhost:11434",
			systemPrompt: "You are a helpful assistant.",
			enableThinking: false,
		});

		fetchMock.mockResolvedValue(new Response(JSON.stringify({
			message: {
				content: "plain completion",
			},
			prompt_eval_count: 5,
			eval_count: 7,
		}), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		}));

		const result = await provider.complete({
			prefix: "Hello ",
			suffix: "",
			prompt: "Shared prompt body",
			language: "markdown",
			maxTokens: 32,
			signal: new AbortController().signal,
		});

		expect(result).toEqual({
			text: "plain completion",
			tokensUsed: 12,
		});

		const requestInit = fetchMock.mock.calls[0]?.[1];
		const body = JSON.parse(String(requestInit?.body));
		expect(body.think).toBe(false);
		expect(body.messages[1].content).toContain("/no_think");
		expect(body.messages[1].content).toContain("Shared prompt body");
	});

	it("should capture debug metadata", async () => {
		const provider = new OllamaProvider({
			model: "llama3",
			baseUrl: "http://localhost:11434",
			systemPrompt: "You are a helpful assistant.",
			enableThinking: false,
			debugMode: true,
			debugRedactSensitive: true,
			debugMaxBodyChars: 500,
		});

		fetchMock.mockResolvedValue(new Response(JSON.stringify({
			message: {
				content: "plain completion",
			},
			prompt_eval_count: 5,
			eval_count: 7,
		}), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		}));

		await provider.complete({
			prefix: "",
			suffix: "",
			prompt: "contains sk-ollama-secret-12345678 in prompt",
			language: "markdown",
			maxTokens: 32,
			signal: new AbortController().signal,
		});

		const entry = debugLog.getAll()[0];
		expect(entry).toBeDefined();
		expect(entry!).toMatchObject({
			provider: "ollama",
			model: "llama3",
			requestUrl: "http://localhost:11434/api/chat",
			responseStatus: 200,
			transport: "fetch",
			usedFallback: false,
		});
		expect(entry!.durationMs).toBeTypeOf("number");
		expect(entry!.requestBody).toContain("[REDACTED]");
		expect(entry!.requestBody).not.toContain("sk-ollama-secret-12345678");
	});
});
