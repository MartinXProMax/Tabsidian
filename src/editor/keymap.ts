import { keymap, EditorView } from "@codemirror/view";
import { Prec, type Extension } from "@codemirror/state";
import { completionStateField, clearCompletion, acceptPartial, acceptedCompletion } from "./completion-state";

// CJK Unicode ranges: CJK Unified Ideographs, extensions, punctuation, kana, hangul
const CJK_CHAR = /[\u2E80-\u2FFF\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF\u{20000}-\u{2A6DF}\u{2A700}-\u{2B73F}\u{2B740}-\u{2B81F}]/u;

/**
 * Accept the full visible ghost-text completion.
 * Exported so the capture-phase listener in main.ts can call it.
 */
export function acceptVisibleCompletion(view: EditorView): boolean {
	const state = view.state.field(completionStateField);
	if (state.status !== "showing" || !state.completion) return false;

	const { text, from } = state.completion;
	view.dispatch({
		changes: { from, insert: text },
		selection: { anchor: from + text.length },
		effects: [clearCompletion.of(undefined), acceptedCompletion.of(undefined)],
	});
	return true;
}

function acceptWord(view: EditorView): boolean {
	const state = view.state.field(completionStateField);
	if (state.status !== "showing" || !state.completion) return false;

	const { text, from } = state.completion;

	let chunkText: string;
	if (CJK_CHAR.test(text.charAt(0))) {
		// CJK: accept one character at a time
		chunkText = text.charAt(0);
	} else {
		// Latin/etc: accept one word + trailing whitespace
		const wordMatch = text.match(/^(\S+\s?)/);
		if (!wordMatch) return false;
		chunkText = wordMatch[1] ?? "";
	}

	const remaining = text.slice(chunkText.length);

	if (remaining.length === 0) {
		return acceptVisibleCompletion(view);
	}

	view.dispatch({
		changes: { from, insert: chunkText },
		selection: { anchor: from + chunkText.length },
		effects: acceptPartial.of({
			remainingText: remaining,
			newFrom: from + chunkText.length,
		}),
	});
	return true;
}

function acceptLine(view: EditorView): boolean {
	const state = view.state.field(completionStateField);
	if (state.status !== "showing" || !state.completion) return false;

	const { text, from } = state.completion;
	const newlineIdx = text.indexOf("\n");

	if (newlineIdx === -1) {
		return acceptVisibleCompletion(view);
	}

	const lineText = text.slice(0, newlineIdx + 1);
	const remaining = text.slice(newlineIdx + 1);

	if (remaining.length === 0) {
		return acceptVisibleCompletion(view);
	}

	view.dispatch({
		changes: { from, insert: lineText },
		selection: { anchor: from + lineText.length },
		effects: acceptPartial.of({
			remainingText: remaining,
			newFrom: from + lineText.length,
		}),
	});
	return true;
}

function dismiss(view: EditorView): boolean {
	const state = view.state.field(completionStateField);
	if (state.status !== "showing") return false;

	view.dispatch({
		effects: clearCompletion.of(undefined),
	});
	return true;
}

/**
 * Check whether a CM6-style key string (e.g. "Tab", "Ctrl-Shift-Enter")
 * matches a DOM KeyboardEvent. Exported for use in main.ts capture listener.
 */
export function matchesKeybindingEvent(keyString: string, event: KeyboardEvent): boolean {
	const parts = keyString.split("-");
	const baseKey = normalizeEventKey(parts[parts.length - 1] ?? "");
	const wantCtrl = parts.includes("Ctrl");
	const wantAlt = parts.includes("Alt");
	const wantShift = parts.includes("Shift");
	const wantMeta = parts.includes("Meta");

	if (event.ctrlKey !== wantCtrl) return false;
	if (event.altKey !== wantAlt) return false;
	if (event.shiftKey !== wantShift) return false;
	if (event.metaKey !== wantMeta) return false;

	return normalizeEventKey(event.key) === baseKey;
}

function normalizeEventKey(key: string): string {
	switch (key) {
		case " ":
			return "Space";
		case "Esc":
			return "Escape";
		default:
			return key.length === 1 && /[a-z]/i.test(key) ? key.toUpperCase() : key;
	}
}

/**
 * Create the completion keymap.
 *
 * The accept-suggestion key (often Tab) is handled by a capture-phase
 * document listener registered in main.ts — that fires before CM6 or
 * Obsidian can consume the event.
 *
 * This extension only registers the remaining CM6-level bindings:
 * Ctrl-ArrowRight (accept word), Ctrl-ArrowDown (accept line), Escape (dismiss).
 */
export function createCompletionKeymap(): Extension {
	return Prec.highest(keymap.of([
		{ key: "Ctrl-ArrowRight", run: acceptWord },
		{ key: "Ctrl-ArrowDown", run: acceptLine },
		{ key: "Escape", run: dismiss },
	]));
}
