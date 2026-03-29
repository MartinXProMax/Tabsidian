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
