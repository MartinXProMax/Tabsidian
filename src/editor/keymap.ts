import { keymap } from "@codemirror/view";
import { EditorView } from "@codemirror/view";
import { completionStateField, clearCompletion, acceptPartial, acceptedCompletion } from "./completion-state";

function acceptFull(view: EditorView): boolean {
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
	const wordMatch = text.match(/^(\S+\s?)/);
	if (!wordMatch) return false;

	const wordText = wordMatch[1] ?? "";
	const remaining = text.slice(wordText.length);

	if (remaining.length === 0) {
		return acceptFull(view);
	}

	view.dispatch({
		changes: { from, insert: wordText },
		selection: { anchor: from + wordText.length },
		effects: acceptPartial.of({
			remainingText: remaining,
			newFrom: from + wordText.length,
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
		return acceptFull(view);
	}

	const lineText = text.slice(0, newlineIdx + 1);
	const remaining = text.slice(newlineIdx + 1);

	if (remaining.length === 0) {
		return acceptFull(view);
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

export const completionKeymap = keymap.of([
	{ key: "Tab", run: acceptFull },
	{ key: "Ctrl-ArrowRight", run: acceptWord },
	{ key: "Ctrl-ArrowDown", run: acceptLine },
	{ key: "Escape", run: dismiss },
]);
