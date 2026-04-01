import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestWithAbort } from "../../src/providers/base";
import { requestUrl } from "obsidian";

vi.mock("obsidian", () => ({
	requestUrl: vi.fn(),
}));

describe("requestWithAbort", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		vi.mocked(requestUrl).mockReset();
	});

	it("should pass the AbortSignal to fetch and return transport metadata", async () => {
		fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		}));

		const controller = new AbortController();
		const result = await requestWithAbort({
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
		expect(result.status).toBe(200);
		expect(result.json).toEqual({ ok: true });
		expect(result.transport).toBe("fetch");
		expect(result.usedFallback).toBe(false);
		expect(result.durationMs).toBeTypeOf("number");
	});

	it("should reject with AbortError when fetch aborts", async () => {
		const controller = new AbortController();
		controller.abort();

		fetchMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));

		await expect(requestWithAbort({
			url: "https://example.com/test",
		}, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
	});

	it("should not fall back to requestUrl when fetch aborts", async () => {
		fetchMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));

		await expect(requestWithAbort({
			url: "https://example.com/test",
		}, new AbortController().signal)).rejects.toMatchObject({ name: "AbortError" });
		expect(requestUrl).not.toHaveBeenCalled();
	});

	it("should fall back to requestUrl when fetch is unavailable", async () => {
		vi.stubGlobal("fetch", undefined);
		vi.mocked(requestUrl).mockResolvedValue({
			status: 200,
			headers: {},
			text: "",
			json: { ok: true },
			arrayBuffer: new ArrayBuffer(0),
		});

		const result = await requestWithAbort({
			url: "https://example.com/test",
			method: "GET",
		}, new AbortController().signal);

		expect(requestUrl).toHaveBeenCalledWith({
			url: "https://example.com/test",
			method: "GET",
		});
		expect(result.status).toBe(200);
		expect(result.json).toEqual({ ok: true });
		expect(result.transport).toBe("requestUrl");
		expect(result.usedFallback).toBe(true);
		expect(result.fallbackReason).toBe("fetch unavailable");
	});

	it("should fall back to requestUrl when fetch fails", async () => {
		fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
		vi.mocked(requestUrl).mockResolvedValue({
			status: 200,
			headers: {},
			text: "",
			json: { ok: true },
			arrayBuffer: new ArrayBuffer(0),
		});

		const result = await requestWithAbort({
			url: "https://example.com/test",
			method: "GET",
		}, new AbortController().signal);

		expect(result.transport).toBe("requestUrl");
		expect(result.usedFallback).toBe(true);
		expect(result.fallbackReason).toContain("Failed to fetch");
	});

	it("should abort while requestUrl fallback is pending", async () => {
		let rejectFetch: ((reason?: unknown) => void) | undefined;
		fetchMock.mockImplementation(
			() => new Promise((_, reject) => {
				rejectFetch = reject;
			})
		);
		vi.mocked(requestUrl).mockImplementation(
			() => new Promise(() => {}) as ReturnType<typeof requestUrl>
		);

		const controller = new AbortController();
		const request = requestWithAbort({
			url: "https://example.com/test",
			method: "GET",
		}, controller.signal);

		for (let i = 0; i < 5 && !rejectFetch; i++) {
			await Promise.resolve();
		}
		expect(rejectFetch).toBeTypeOf("function");
		rejectFetch?.(new TypeError("Failed to fetch"));

		for (let i = 0; i < 5 && vi.mocked(requestUrl).mock.calls.length === 0; i++) {
			await Promise.resolve();
		}
		expect(requestUrl).toHaveBeenCalledWith({
			url: "https://example.com/test",
			method: "GET",
		});

		controller.abort();
		await expect(request).rejects.toMatchObject({ name: "AbortError" });
	});
});
