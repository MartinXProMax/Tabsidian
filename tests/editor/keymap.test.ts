import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
	PluginSettingTab: class {},
	Plugin: class {},
	Setting: class {},
	Notice: class {},
}));

import { getAcceptWordChunk, matchesKeybindingEvent } from "../../src/editor/keymap";
import { keyEventToKeybinding } from "../../src/settings";

function keyboardEvent(input: Partial<KeyboardEvent> & { key: string }): KeyboardEvent {
	return {
		ctrlKey: false,
		altKey: false,
		shiftKey: false,
		metaKey: false,
		...input,
	} as KeyboardEvent;
}

describe("accept suggestion keybinding", () => {
	it("preserves explicit Shift for single-letter shortcuts", () => {
		const binding = keyEventToKeybinding(keyboardEvent({ key: "A", shiftKey: true }));

		expect(binding).toBe("Shift-A");
		expect(binding).not.toBeNull();
		if (!binding) throw new Error("Expected key binding");
		expect(matchesKeybindingEvent(binding, keyboardEvent({ key: "a" }))).toBe(false);
		expect(matchesKeybindingEvent(binding, keyboardEvent({ key: "A", shiftKey: true }))).toBe(true);
	});
});

describe("getAcceptWordChunk", () => {
	it("treats ASCII punctuation and symbols as one-character chunks", () => {
		expect(getAcceptWordChunk("(todo)")).toBe("(");
		expect(getAcceptWordChunk(")")).toBe(")");
		expect(getAcceptWordChunk("\\path")).toBe("\\");
	});

	it("treats full-width punctuation as one-character chunks", () => {
		expect(getAcceptWordChunk("（待办）")).toBe("（");
		expect(getAcceptWordChunk("）")).toBe("）");
	});

	it("stops Latin word chunks before punctuation", () => {
		expect(getAcceptWordChunk("todo)")).toBe("todo");
		expect(getAcceptWordChunk("path\\name")).toBe("path");
	});

	it("advances across leading whitespace one character at a time", () => {
		expect(getAcceptWordChunk(" next")).toBe(" ");
		expect(getAcceptWordChunk("\tnext")).toBe("\t");
		expect(getAcceptWordChunk("\nnext")).toBe("\n");
	});
});
