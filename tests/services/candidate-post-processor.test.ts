import { describe, expect, it } from "vitest";
import { postProcessCompletion } from "../../src/services/candidate-post-processor";

describe("postProcessCompletion", () => {
	it("strips leaked cursor marker and prompt scaffold", () => {
		const result = postProcessCompletion({
			prefix: "Intro text",
			suffix: "",
			rawText: "[CURSOR] Continue writing from the end of this text:\n\nhello",
			maxLines: 5,
		});

		expect(result).toBe("hello");
	});

	it("strips the shared infill scaffold before returning content", () => {
		const result = postProcessCompletion({
			prefix: "Before",
			suffix: "After",
			rawText: "Continue writing from where the cursor is marked with [CURSOR].\n\ncontinued text",
			maxLines: 5,
		});

		expect(result).toBe("continued text");
	});

	it("removes conservative overlap with prefix", () => {
		const result = postProcessCompletion({
			prefix: "This is the repeated start",
			suffix: "",
			rawText: "repeated start and the new ending",
			maxLines: 5,
		});

		expect(result).toBe(" and the new ending");
	});

	it("removes echoed suffix tail and respects max lines", () => {
		const result = postProcessCompletion({
			prefix: "",
			suffix: "next line that already exists",
			rawText: "inserted line\nsecond line\nnext line",
			maxLines: 2,
		});

		expect(result).toBe("inserted line\nsecond line");
	});
});
