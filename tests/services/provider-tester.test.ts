import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { testProviderConnection } from "../../src/services/provider-tester";
import type { CompletionProvider } from "../../src/providers/base";

describe("testProviderConnection", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("should report invalid config before sending a request", async () => {
		const provider: CompletionProvider = {
			validateConfig: vi.fn().mockResolvedValue(false),
			complete: vi.fn(),
		};

		await expect(testProviderConnection(provider)).resolves.toEqual({
			ok: false,
			message: "Provider configuration is invalid.",
		});
		expect(provider.complete).not.toHaveBeenCalled();
	});

	it("should report success when the model responds", async () => {
		const provider: CompletionProvider = {
			validateConfig: vi.fn().mockResolvedValue(true),
			complete: vi.fn().mockResolvedValue({
				text: "OK",
				tokensUsed: 3,
			}),
		};

		await expect(testProviderConnection(provider)).resolves.toEqual({
			ok: true,
			message: "Connection succeeded. Model replied: OK",
		});
		expect(provider.complete).toHaveBeenCalledWith(expect.objectContaining({
			prompt: "Reply with OK only.",
		}));
	});

	it("should report timeout when the request is aborted", async () => {
		const provider: CompletionProvider = {
			validateConfig: vi.fn().mockResolvedValue(true),
			complete: vi.fn().mockImplementation(async ({ signal }) => {
				return new Promise((_resolve, reject) => {
					signal.addEventListener("abort", () => {
						reject(new DOMException("Aborted", "AbortError"));
					}, { once: true });
				});
			}),
		};

		const promise = testProviderConnection(provider);
		await vi.advanceTimersByTimeAsync(15000);

		await expect(promise).resolves.toEqual({
			ok: false,
			message: "Connection test timed out.",
		});
	});
});
