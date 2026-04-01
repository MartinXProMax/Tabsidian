import { ViewPlugin, ViewUpdate, EditorView } from "@codemirror/view";
import { completionStateField, setLoading, setCompletion, clearCompletion, acceptPartial, acceptedCompletion } from "./completion-state";
import type { CompletionProvider } from "../providers/base";
import type { ContextBuilder } from "../services/context-builder";
import type { ExclusionFilter } from "../services/exclusion-filter";
import type { UsageTracker } from "../services/usage-tracker";
import { postProcessCompletion } from "../services/candidate-post-processor";

export interface TriggerConfig {
	debounceMs: number;
	maxLines: number;
	getProvider: () => CompletionProvider | null;
	contextBuilder: ContextBuilder;
	getExclusionFilter: () => ExclusionFilter;
	getUsageTracker: () => UsageTracker;
	getFilePath: () => string | null;
	getFileTags: () => string[];
	onAccepted: () => void;
}

export function createTriggerPlugin(config: TriggerConfig) {
	return ViewPlugin.fromClass(
		class {
			private timer: ReturnType<typeof setTimeout> | null = null;
			private abortController: AbortController | null = null;
			private consecutiveFailures = 0;
			private backoffUntil = 0;

			update(update: ViewUpdate): void {
				// Check for acceptance events and detect partial accepts
				let isAcceptance = false;
				for (const tr of update.transactions) {
					for (const effect of tr.effects) {
						if (effect.is(acceptedCompletion)) {
							config.onAccepted();
							isAcceptance = true;
						}
						if (effect.is(acceptPartial)) {
							isAcceptance = true;
						}
					}
				}

				if (!update.docChanged) return;

				// Don't clear ghost text or start new debounce when the user
				// is accepting a partial completion (word/line)
				if (isAcceptance) return;

				this.cancelPending();

				const state = update.state.field(completionStateField);
				if (state.status === "showing") {
					update.view.dispatch({ effects: clearCompletion.of(undefined) });
				}

				this.timer = setTimeout(() => {
					this.triggerCompletion(update.view);
				}, config.debounceMs);
			}

			private cancelPending(): void {
				if (this.timer) {
					clearTimeout(this.timer);
					this.timer = null;
				}
				if (this.abortController) {
					this.abortController.abort();
					this.abortController = null;
				}
			}

			private async triggerCompletion(view: EditorView): Promise<void> {
				if (Date.now() < this.backoffUntil) return;

				const filePath = config.getFilePath();
				if (!filePath) return;

				const filter = config.getExclusionFilter();
				if (filter.isExcluded(filePath, config.getFileTags())) return;

				const provider = config.getProvider();
				if (!provider) return;

				const isValid = await provider.validateConfig();
				if (!isValid) return;

				const cursorPos = view.state.selection.main.head;
				const doc = view.state.doc.toString();
				const context = config.contextBuilder.build(doc, cursorPos);

				view.dispatch({ effects: setLoading.of({ from: cursorPos }) });

				this.abortController = new AbortController();

				try {
					const response = await provider.complete({
						prefix: context.prefix,
						suffix: context.suffix,
						prompt: context.prompt,
						language: "markdown",
						maxTokens: config.maxLines * 40,
						signal: this.abortController.signal,
					});

					// Guard against view being destroyed while awaiting
					try {
						void view.state;
					} catch {
						return;
					}

					const currentPos = view.state.selection.main.head;
					if (currentPos !== cursorPos) return;

					const trimmedText = postProcessCompletion({
						prefix: context.prefix,
						suffix: context.suffix,
						rawText: response.text,
						maxLines: config.maxLines,
					});

					if (trimmedText.trim().length === 0) {
						view.dispatch({ effects: clearCompletion.of(undefined) });
						return;
					}

					view.dispatch({
						effects: setCompletion.of({
							text: trimmedText,
							from: cursorPos,
							originalFrom: cursorPos,
						}),
					});

					config.getUsageTracker().recordRequest(response.tokensUsed);
					this.consecutiveFailures = 0;
				} catch (e) {
					if ((e as Error).name === "AbortError") return;

					console.error("Tabsidian: completion request failed", e);
					try {
						view.dispatch({ effects: clearCompletion.of(undefined) });
					} catch {
						// View may have been destroyed
					}

					this.consecutiveFailures++;
					if (this.consecutiveFailures >= 3) {
						this.backoffUntil = Date.now() + 30000;
						this.consecutiveFailures = 0;
						console.warn("Tabsidian: backing off for 30s after 3 consecutive failures");
					}
				}
			}

			destroy(): void {
				this.cancelPending();
			}
		}
	);
}
