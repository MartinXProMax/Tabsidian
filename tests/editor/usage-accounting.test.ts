import { describe, expect, it, vi } from "vitest";
import { recordCompletedProviderRequest } from "../../src/editor/trigger";

describe("recordCompletedProviderRequest", () => {
	it("records provider usage before completion text is post-processed or discarded", () => {
		const tracker = {
			recordRequest: vi.fn(),
		};

		recordCompletedProviderRequest(() => tracker, 42);

		expect(tracker.recordRequest).toHaveBeenCalledWith(42);
	});
});
