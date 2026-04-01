import { Plugin, Notice, MarkdownView } from "obsidian";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
	TabsidianSettings,
	DEFAULT_SETTINGS,
	DEFAULT_PROVIDER_CONFIGS,
	TabsidianSettingTab,
	normalizeAcceptSuggestionKey,
	normalizeProviderType,
	providerSupportsThinking,
	PROVIDER_DEFAULTS,
} from "./settings";
import { completionStateField } from "./editor/completion-state";
import { ghostTextDecorationField } from "./editor/ghost-text";
import { createCompletionKeymap, acceptVisibleCompletion, matchesKeybindingEvent } from "./editor/keymap";
import { createTriggerPlugin, TriggerConfig } from "./editor/trigger";
import { OpenAIProvider, OpenAIProviderConfig } from "./providers/openai";
import { AnthropicProvider, AnthropicProviderConfig } from "./providers/anthropic";
import { OllamaProvider, OllamaProviderConfig } from "./providers/ollama";
import { ContextBuilder } from "./services/context-builder";
import { ExclusionFilter } from "./services/exclusion-filter";
import { testProviderConnection, type ProviderTestResult } from "./services/provider-tester";
import { UsageTracker } from "./services/usage-tracker";
import type { CompletionProvider } from "./providers/base";

export default class TabsidianPlugin extends Plugin {
	settings: TabsidianSettings = DEFAULT_SETTINGS;
	private contextBuilder = new ContextBuilder();
	private editorExtensions: Extension[] = [];

	async onload(): Promise<void> {
		await this.loadSettings();

		const currentProvider = normalizeProviderType(this.settings.provider);
		const currentCfg = this.settings.providerConfigs[currentProvider];
		if (!currentCfg.apiKey && (PROVIDER_DEFAULTS[currentProvider]?.needsKey ?? true)) {
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
			createCompletionKeymap(),
			createTriggerPlugin(triggerConfig),
		];
		this.registerEditorExtension(this.editorExtensions);
		this.registerAcceptSuggestionCapture();
	}

	private createProvider(): CompletionProvider | null {
		const {
			provider: rawProvider,
			systemPrompt,
			thinkingBudget,
			debugMode,
			debugRedactSensitive,
			debugMaxBodyChars,
		} = this.settings;
		const provider = normalizeProviderType(rawProvider);
		const enableThinking = providerSupportsThinking(provider) ? this.settings.enableThinking : false;
		const cfg = this.settings.providerConfigs[provider];
		const defaults = PROVIDER_DEFAULTS[provider];
		const apiKey = cfg.apiKey;
		const model = cfg.model;
		const baseUrl = cfg.baseUrl;

		switch (provider) {
			case "anthropic": {
				if (!apiKey) return null;
				const config: AnthropicProviderConfig = {
					apiKey,
					model: model || "claude-sonnet-4-6-20250514",
					systemPrompt,
					enableThinking,
					thinkingBudget: thinkingBudget || 1024,
					debugMode,
					debugRedactSensitive,
					debugMaxBodyChars,
				};
				return new AnthropicProvider(config);
			}
			case "ollama": {
				const config: OllamaProviderConfig = {
					model: model || defaults.model,
					baseUrl: baseUrl || defaults.baseUrl,
					systemPrompt,
					enableThinking,
					debugMode,
					debugRedactSensitive,
					debugMaxBodyChars,
				};
				return new OllamaProvider(config);
			}
			case "openai":
			case "gemini":
			case "openrouter":
			case "qwen":
			case "siliconflow":
			case "custom": {
				if (defaults.needsKey && !apiKey) return null;
				if (provider === "custom" && !baseUrl) return null;
				const config: OpenAIProviderConfig = {
					apiKey,
					model: model || defaults.model,
					baseUrl: baseUrl || defaults.baseUrl,
					systemPrompt,
					enableThinking,
					debugMode,
					debugRedactSensitive,
					debugMaxBodyChars,
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

		// Deep merge providerConfigs so new providers get defaults
		const mergedConfigs = structuredClone(DEFAULT_PROVIDER_CONFIGS);
		if (loaded?.providerConfigs) {
			for (const key of Object.keys(loaded.providerConfigs)) {
				mergedConfigs[key as keyof typeof mergedConfigs] = Object.assign(
					{},
					mergedConfigs[key as keyof typeof mergedConfigs],
					loaded.providerConfigs[key],
				);
			}
		}
		this.settings.provider = normalizeProviderType(loaded?.provider);
		this.settings.providerConfigs = mergedConfigs;

		// Migrate legacy flat apiKey/model/apiBaseUrl to the current provider's config
		if (!loaded?.providerConfigs && loaded) {
			const p = (loaded.provider as keyof typeof mergedConfigs) || "openai";
			if (loaded.apiKey) this.settings.providerConfigs[p].apiKey = loaded.apiKey;
			if (loaded.model) this.settings.providerConfigs[p].model = loaded.model;
			if (loaded.apiBaseUrl) this.settings.providerConfigs[p].baseUrl = loaded.apiBaseUrl;
		}

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
		this.settings.acceptSuggestionKey = normalizeAcceptSuggestionKey(
			this.settings.acceptSuggestionKey,
		);
		await this.saveData(this.settings);
	}

	async testCurrentProviderConnection(): Promise<ProviderTestResult> {
		return testProviderConnection(this.createProvider());
	}

	private registerAcceptSuggestionCapture(): void {
		this.registerDomEvent(document, "keydown", (event) => {
			if (!(event.target instanceof HTMLElement)) return;
			if (!matchesKeybindingEvent(this.settings.acceptSuggestionKey, event)) return;

			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view || !view.contentEl.contains(event.target)) return;

			const editorView = EditorView.findFromDOM(event.target.closest(".cm-editor") ?? event.target);
			if (!editorView) return;

			if (!acceptVisibleCompletion(editorView)) return;

			event.preventDefault();
			event.stopPropagation();
			event.stopImmediatePropagation();
		}, { capture: true });
	}
}
