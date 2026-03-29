import { EditorView, WidgetType, Decoration, DecorationSet } from "@codemirror/view";
import { StateField, Extension, Range } from "@codemirror/state";
import { completionStateField } from "./completion-state";

class InlineGhostTextWidget extends WidgetType {
	constructor(private readonly text: string) {
		super();
	}

	toDOM(): HTMLElement {
		const span = document.createElement("span");
		span.className = "tabsidian-ghost-text";
		span.textContent = this.text;
		return span;
	}

	eq(other: InlineGhostTextWidget): boolean {
		return this.text === other.text;
	}
}

class BlockGhostTextWidget extends WidgetType {
	constructor(private readonly text: string) {
		super();
	}

	toDOM(): HTMLElement {
		const div = document.createElement("div");
		div.className = "tabsidian-ghost-text tabsidian-ghost-block";
		div.textContent = this.text;
		return div;
	}

	eq(other: BlockGhostTextWidget): boolean {
		return this.text === other.text;
	}
}

class LoadingWidget extends WidgetType {
	toDOM(): HTMLElement {
		const span = document.createElement("span");
		span.className = "tabsidian-loading";
		span.innerHTML = '<span class="tabsidian-spinner"></span>';
		return span;
	}

	eq(): boolean {
		return true;
	}
}

export const ghostTextDecorationField = StateField.define<DecorationSet>({
	create(): DecorationSet {
		return Decoration.none;
	},

	update(decorations: DecorationSet, tr): DecorationSet {
		const state = tr.state.field(completionStateField);

		if (state.status === "loading") {
			const cursorPos = tr.state.selection.main.head;
			return Decoration.set([
				Decoration.widget({
					widget: new LoadingWidget(),
					side: 1,
				}).range(cursorPos),
			]);
		}

		if (state.status === "showing" && state.completion) {
			const { text, from } = state.completion;
			const lines = text.split("\n");
			const decos: Range<Decoration>[] = [];

			if (lines[0] !== undefined) {
				decos.push(
					Decoration.widget({
						widget: new InlineGhostTextWidget(lines[0]),
						side: 1,
					}).range(from)
				);
			}

			for (let i = 1; i < lines.length; i++) {
				const line = lines[i];
				if (line !== undefined) {
					decos.push(
						Decoration.widget({
							widget: new BlockGhostTextWidget(line),
							block: true,
							side: 1,
						}).range(from)
					);
				}
			}

			return Decoration.set(decos, true);
		}

		return Decoration.none;
	},

	provide(field: StateField<DecorationSet>): Extension {
		return EditorView.decorations.from(field);
	},
});
