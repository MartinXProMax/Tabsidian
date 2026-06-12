import { describe, expect, it, vi } from "vitest";
import { clearCompletion } from "../../src/editor/completion-state";
import { clearStaleCompletion } from "../../src/editor/trigger";

describe("clearStaleCompletion", () => {
	it("clears loading completion state when the cursor moved before a response returned", () => {
		const view = {
			dispatch: vi.fn(),
		};

		const cleared = clearStaleCompletion(view, 10, 11);

		expect(cleared).toBe(true);
		expect(view.dispatch).toHaveBeenCalledOnce();
		const effects = view.dispatch.mock.calls[0]?.[0].effects;
		expect(effects.is(clearCompletion)).toBe(true);
	});

	it("keeps completion state when the cursor has not moved", () => {
		const view = {
			dispatch: vi.fn(),
		};

		const cleared = clearStaleCompletion(view, 10, 10);

		expect(cleared).toBe(false);
		expect(view.dispatch).not.toHaveBeenCalled();
	});
});
