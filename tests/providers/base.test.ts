import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestWithAbort } from "../../src/providers/base";

describe("requestWithAbort", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
	});

	it("should pass the AbortSignal to fetch", async () => {
		fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		}));

		const controller = new AbortController();
		await requestWithAbort({
			url: "https://example.com/test",
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ hello: "world" }),
		}, controller.signal);

		expect(fetchMock).toHaveBeenCalledWith("https://example.com/test", expect.objectContaining({
			method: "POST",
			signal: controller.signal,
		}));
	});

	it("should reject with AbortError when fetch aborts", async () => {
		fetchMock.mockImplementation(async (_input, init?: RequestInit) => {
			return new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () => {
					reject(new DOMException("Aborted", "AbortError"));
				}, { once: true });
			});
		});

		const controller = new AbortController();
		const request = requestWithAbort({
			url: "https://example.com/test",
		}, controller.signal);

		controller.abort();

		await expect(request).rejects.toMatchObject({ name: "AbortError" });
	});
});
