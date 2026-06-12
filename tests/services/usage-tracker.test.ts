import { describe, it, expect, vi } from "vitest";
import { UsageTracker } from "../../src/services/usage-tracker";
import type { UsageStats } from "../../src/settings";

describe("UsageTracker", () => {
	it("should record a request", () => {
		const stats: UsageStats = { totalRequests: 0, acceptedRequests: 0, totalTokens: 0 };
		const saveFn = vi.fn();
		const tracker = new UsageTracker(stats, saveFn);

		tracker.recordRequest(42);

		expect(stats.totalRequests).toBe(1);
		expect(stats.totalTokens).toBe(42);
		expect(stats.acceptedRequests).toBe(0);
		expect(saveFn).toHaveBeenCalledOnce();
	});

	it("should record an acceptance", () => {
		const stats: UsageStats = { totalRequests: 5, acceptedRequests: 2, totalTokens: 100 };
		const saveFn = vi.fn();
		const tracker = new UsageTracker(stats, saveFn);

		tracker.recordAcceptance();

		expect(stats.acceptedRequests).toBe(3);
		expect(saveFn).toHaveBeenCalledOnce();
	});

	it("should not record more acceptances than requests", () => {
		const stats: UsageStats = { totalRequests: 1, acceptedRequests: 1, totalTokens: 100 };
		const saveFn = vi.fn();
		const tracker = new UsageTracker(stats, saveFn);

		tracker.recordAcceptance();

		expect(stats.acceptedRequests).toBe(1);
		expect(saveFn).not.toHaveBeenCalled();
	});

	it("should serialize async saves", async () => {
		const stats: UsageStats = { totalRequests: 0, acceptedRequests: 0, totalTokens: 0 };
		const events: string[] = [];
		let saveIndex = 0;
		const saveFn = vi.fn(async () => {
			const current = ++saveIndex;
			events.push(`start-${current}`);
			await Promise.resolve();
			events.push(`end-${current}`);
		});
		const tracker = new UsageTracker(stats, saveFn);

		tracker.recordRequest(10);
		tracker.recordAcceptance();
		await tracker.flush();

		expect(events).toEqual(["start-1", "end-1", "start-2", "end-2"]);
	});

	it("should calculate acceptance rate", () => {
		const stats: UsageStats = { totalRequests: 10, acceptedRequests: 7, totalTokens: 200 };
		const tracker = new UsageTracker(stats, vi.fn());

		expect(tracker.getAcceptanceRate()).toBe(70);
	});

	it("should return 0 acceptance rate when no requests", () => {
		const stats: UsageStats = { totalRequests: 0, acceptedRequests: 0, totalTokens: 0 };
		const tracker = new UsageTracker(stats, vi.fn());

		expect(tracker.getAcceptanceRate()).toBe(0);
	});
});
