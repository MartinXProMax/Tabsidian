import { StateField, StateEffect, Transaction } from "@codemirror/state";

export interface CompletionData {
	text: string;
	from: number;
	originalFrom: number;
}

export type CompletionStatus = "idle" | "loading" | "showing";

export interface CompletionState {
	status: CompletionStatus;
	completion: CompletionData | null;
}

export const setLoading = StateEffect.define<{ from: number }>();
export const setCompletion = StateEffect.define<CompletionData>();
export const clearCompletion = StateEffect.define<void>();
export const acceptPartial = StateEffect.define<{ remainingText: string; newFrom: number }>();
export const acceptedCompletion = StateEffect.define<void>();

export const completionStateField = StateField.define<CompletionState>({
	create(): CompletionState {
		return { status: "idle", completion: null };
	},

	update(state: CompletionState, tr: Transaction): CompletionState {
		for (const effect of tr.effects) {
			if (effect.is(setLoading)) {
				return { status: "loading", completion: null };
			}
			if (effect.is(setCompletion)) {
				return { status: "showing", completion: effect.value };
			}
			if (effect.is(clearCompletion)) {
				return { status: "idle", completion: null };
			}
			if (effect.is(acceptPartial)) {
				return {
					status: "showing",
					completion: {
						text: effect.value.remainingText,
						from: effect.value.newFrom,
						originalFrom: state.completion?.originalFrom ?? effect.value.newFrom,
					},
				};
			}
		}

		if (tr.docChanged && state.status === "showing") {
			return { status: "idle", completion: null };
		}

		return state;
	},
});
