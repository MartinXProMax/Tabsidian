import { Plugin, Notice, MarkdownView } from "obsidian";
import type { Extension } from "@codemirror/state";
import {
	TabsidianSettings,
	DEFAULT_SETTINGS,
	TabsidianSettingTab,
	normalizeAcceptSuggestionKey,
} from "./settings";
import { completionStateField } from "./editor/completion-state";
import { ghostTextDecorationField } from "./editor/ghost-text";
import { createCompletionKeymap } from "./editor/keymap";
import { createTriggerPlugin, TriggerConfig } from "./editor/trigger";
import { OpenAIProvider, OpenAIProviderConfig } from "./providers/openai";
import { AnthropicProvider, AnthropicProviderConfig } from "./providers/anthropic";
import { OllamaProvider, OllamaProviderConfig } from "./providers/ollama";
import { ContextBuilder } from "./services/context-builder";
import { ExclusionFilter } from "./services/exclusion-filter";
import { UsageTracker } from "./services/usage-tracker";
import type { CompletionProvider } from "./providers/base";

export default class TabsidianPlugin extends Plugin {
	settings: TabsidianSettings = DEFAULT_SETTINGS;
	private contextBuilder = new ContextBuilder();
	private editorExtensions: Extension[] = [];
	private registeredAcceptSuggestionKey = DEFAULT_SETTINGS.acceptSuggestionKey;

	async onload(): Promise<void> {
		await this.loadSettings();

		if (!this.settings.apiKey && this.settings.provider !== "ollama") {
			new Notice("Tabsidian: Please configure your API key in settings.");
		}

		this.addSettingTab(new TabsidianSettingTab(this.app, this));

		const self = this;
		const triggerConfig: TriggerConfig = {
			get debounceMs() { return self.settings.debounceMs; },
			get maxLines() { return self.settings.maxLines; },
			getProvider: () => this.createProvider(),
			contextBuilder: this.contextBuilder,
			getExclusionFilter: () =>
				new ExclusionFilter(this.settings.excludedFolders, this.settings.excludedTags),
			getUsageTracker: () =>
				new UsageTracker(this.settings.usageStats, () => this.saveSettings()),
			getFilePath: () => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				return view?.file?.path ?? null;
			},
			getFileTags: () => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view?.file) return [];
				const cache = this.app.metadataCache.getFileCache(view.file);
				return cache?.tags?.map((t) => t.tag) ?? [];
			},
			onAccepted: () => {
				const tracker = new UsageTracker(this.settings.usageStats, () => this.saveSettings());
				tracker.recordAcceptance();
			},
		};

		this.editorExtensions = [
			completionStateField,
			ghostTextDecorationField,
			createCompletionKeymap(this.settings.acceptSuggestionKey),
			createTriggerPlugin(triggerConfig),
		];
		this.registeredAcceptSuggestionKey = this.settings.acceptSuggestionKey;
		this.registerEditorExtension(this.editorExtensions);
	}

	private createProvider(): CompletionProvider | null {
		const { provider, apiKey, model, apiBaseUrl, systemPrompt } = this.settings;

		switch (provider) {
			case "openai": {
				if (!apiKey) return null;
				const config: OpenAIProviderConfig = {
					apiKey,
					model: model || "gpt-4o-mini",
					baseUrl: apiBaseUrl || "https://api.openai.com/v1",
					systemPrompt,
				};
				return new OpenAIProvider(config);
			}
			case "anthropic": {
				if (!apiKey) return null;
				const config: AnthropicProviderConfig = {
					apiKey,
					model: model || "claude-sonnet-4-6-20250514",
					systemPrompt,
				};
				return new AnthropicProvider(config);
			}
			case "ollama": {
				const config: OllamaProviderConfig = {
					model: model || "llama3",
					baseUrl: apiBaseUrl || "http://localhost:11434",
					systemPrompt,
				};
				return new OllamaProvider(config);
			}
			case "custom": {
				if (!apiKey || !apiBaseUrl) return null;
				const config: OpenAIProviderConfig = {
					apiKey,
					model: model || "gpt-4o-mini",
					baseUrl: apiBaseUrl,
					systemPrompt,
				};
				return new OpenAIProvider(config);
			}
			default:
				return null;
		}
	}

	async loadSettings(): Promise<void> {
		const loaded = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
		// Deep merge nested objects so new fields get defaults
		this.settings.usageStats = Object.assign(
			{},
			DEFAULT_SETTINGS.usageStats,
			loaded?.usageStats,
		);
		this.settings.acceptSuggestionKey = normalizeAcceptSuggestionKey(
			loaded?.acceptSuggestionKey ?? DEFAULT_SETTINGS.acceptSuggestionKey,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.refreshEditorExtensions();
	}

	private refreshEditorExtensions(): void {
		const acceptSuggestionKey = normalizeAcceptSuggestionKey(this.settings.acceptSuggestionKey);
		this.settings.acceptSuggestionKey = acceptSuggestionKey;

		if (this.editorExtensions.length === 0 || this.registeredAcceptSuggestionKey === acceptSuggestionKey) {
			return;
		}

		this.editorExtensions[2] = createCompletionKeymap(acceptSuggestionKey);
		this.registeredAcceptSuggestionKey = acceptSuggestionKey;
		this.app.workspace.updateOptions();
	}
}
