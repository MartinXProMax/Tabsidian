import { describe, it, expect } from "vitest";
import { ContextBuilder } from "../../src/services/context-builder";

describe("ContextBuilder", () => {
	const builder = new ContextBuilder();

	it("should extract prefix and suffix from cursor position", () => {
		const doc = "Hello world\nThis is a test\nThird line";
		const cursorPos = 18;
		const result = builder.build(doc, cursorPos);
		expect(result.prefix).toBe("Hello world\nThis i");
		expect(result.suffix).toBe("s a test\nThird line");
	});

	it("should handle cursor at start of document", () => {
		const doc = "Hello world";
		const result = builder.build(doc, 0);
		expect(result.prefix).toBe("");
		expect(result.suffix).toBe("Hello world");
	});

	it("should handle cursor at end of document", () => {
		const doc = "Hello world";
		const result = builder.build(doc, 11);
		expect(result.prefix).toBe("Hello world");
		expect(result.suffix).toBe("");
	});

	it("should truncate prefix to maxContextChars", () => {
		const doc = "a".repeat(5000) + "CURSOR_HERE";
		const result = builder.build(doc, 5000, 2000);
		expect(result.prefix.length).toBe(2000);
		expect(result.prefix.endsWith("a".repeat(2000))).toBe(true);
	});

	it("should truncate suffix to maxContextChars", () => {
		const doc = "start" + "b".repeat(5000);
		const result = builder.build(doc, 5, 2000);
		expect(result.suffix.length).toBe(2000);
	});
});
