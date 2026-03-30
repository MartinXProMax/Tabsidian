import { App, PluginSettingTab, Setting, Plugin } from "obsidian";

export type ProviderType = "openai" | "anthropic" | "ollama" | "custom";

export interface TabsidianSettings {
	provider: ProviderType;
	apiKey: string;
	model: string;
	apiBaseUrl: string;
	debounceMs: number;
	maxLines: number;
	acceptSuggestionKey: string;
	systemPrompt: string;
	excludedFolders: string;
	excludedTags: string;
	usageStats: UsageStats;
}

export interface UsageStats {
	totalRequests: number;
	acceptedRequests: number;
	totalTokens: number;
}

export const DEFAULT_SETTINGS: TabsidianSettings = {
	provider: "openai",
	apiKey: "",
	model: "gpt-4o-mini",
	apiBaseUrl: "",
	debounceMs: 500,
	maxLines: 5,
	acceptSuggestionKey: "Tab",
	systemPrompt: "You are a writing assistant. Continue the text naturally based on the context. Output only the continuation, no explanations.",
	excludedFolders: "",
	excludedTags: "",
	usageStats: {
		totalRequests: 0,
		acceptedRequests: 0,
		totalTokens: 0,
	},
};

export function normalizeAcceptSuggestionKey(value: string): string {
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : DEFAULT_SETTINGS.acceptSuggestionKey;
}

export function keyEventToKeybinding(event: KeyboardEvent): string | null {
	const baseKey = normalizeKeyName(event.key);
	if (!baseKey) return null;

	const modifiers: string[] = [];
	if (event.ctrlKey) modifiers.push("Ctrl");
	if (event.altKey) modifiers.push("Alt");
	if (event.shiftKey && !isImplicitShift(baseKey)) modifiers.push("Shift");
	if (event.metaKey) modifiers.push("Meta");

	return [...modifiers, baseKey].join("-");
}

function normalizeKeyName(key: string): string | null {
	switch (key) {
		case " ":
			return "Space";
		case "Esc":
			return "Escape";
		case "OS":
			return "Meta";
		case "Control":
		case "Shift":
		case "Alt":
		case "Meta":
			return null;
		default:
			break;
	}

	if (key.startsWith("Arrow")) {
		return key;
	}

	if (key.length === 1) {
		if (/[a-z]/i.test(key)) return key.toUpperCase();
		if (/\d/.test(key)) return key;
	}

	return key.length > 0 ? key : null;
}

function isImplicitShift(baseKey: string): boolean {
	return baseKey.length === 1 && /[A-Z]/.test(baseKey);
}

export class TabsidianSettingTab extends PluginSettingTab {
	plugin: Plugin & { settings: TabsidianSettings; saveSettings(): Promise<void> };

	constructor(app: App, plugin: Plugin & { settings: TabsidianSettings; saveSettings(): Promise<void> }) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "AI Provider" });

		new Setting(containerEl)
			.setName("Provider")
			.setDesc("Select the AI completion provider")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("openai", "OpenAI")
					.addOption("anthropic", "Anthropic Claude")
					.addOption("ollama", "Ollama (Local)")
					.addOption("custom", "Custom OpenAI-Compatible")
					.setValue(this.plugin.settings.provider)
					.onChange(async (value: string) => {
						this.plugin.settings.provider = value as ProviderType;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		new Setting(containerEl)
			.setName("API Key")
			.setDesc("Your API key (stored locally, never uploaded)")
			.addText((text) => {
				text.inputEl.type = "password";
				text
					.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Model")
			.setDesc("Model name to use for completions")
			.addText((text) =>
				text
					.setPlaceholder("gpt-4o-mini")
					.setValue(this.plugin.settings.model)
					.onChange(async (value) => {
						this.plugin.settings.model = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("API Base URL")
			.setDesc("Custom API endpoint (leave empty for default)")
			.addText((text) =>
				text
					.setPlaceholder("https://api.openai.com/v1")
					.setValue(this.plugin.settings.apiBaseUrl)
					.onChange(async (value) => {
						this.plugin.settings.apiBaseUrl = value;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h2", { text: "Completion Behavior" });

		new Setting(containerEl)
			.setName("Trigger Delay (ms)")
			.setDesc("How long to wait after typing stops before triggering completion (200-2000)")
			.addSlider((slider) =>
				slider
					.setLimits(200, 2000, 100)
					.setValue(this.plugin.settings.debounceMs)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.debounceMs = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Max Completion Lines")
			.setDesc("Maximum number of lines per suggestion (1-20)")
			.addSlider((slider) =>
				slider
					.setLimits(1, 20, 1)
					.setValue(this.plugin.settings.maxLines)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.maxLines = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Accept Suggestion Key")
			.setDesc("Focus this field and press the key combination you want to use for accepting the full suggestion")
			.addText((text) =>
				{
					text
						.setPlaceholder("Press a shortcut")
						.setValue(this.plugin.settings.acceptSuggestionKey);
					text.inputEl.readOnly = true;
					text.inputEl.addEventListener("keydown", async (event) => {
						const binding = keyEventToKeybinding(event);
						if (!binding) return;

						event.preventDefault();
						event.stopPropagation();
						this.plugin.settings.acceptSuggestionKey = binding;
						text.setValue(binding);
						await this.plugin.saveSettings();
					});
				}
			);

		new Setting(containerEl)
			.setName("System Prompt")
			.setDesc("Custom system prompt for AI completions")
			.addTextArea((text) =>
				text
					.setPlaceholder("You are a writing assistant...")
					.setValue(this.plugin.settings.systemPrompt)
					.onChange(async (value) => {
						this.plugin.settings.systemPrompt = value;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h2", { text: "Exclusion Rules" });

		new Setting(containerEl)
			.setName("Excluded Folders")
			.setDesc("Folders where completion is disabled (one per line)")
			.addTextArea((text) =>
				text
					.setPlaceholder("templates/\ndaily-notes/")
					.setValue(this.plugin.settings.excludedFolders)
					.onChange(async (value) => {
						this.plugin.settings.excludedFolders = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Excluded Tags")
			.setDesc("Notes with these tags won't trigger completion (space-separated)")
			.addTextArea((text) =>
				text
					.setPlaceholder("#private #draft")
					.setValue(this.plugin.settings.excludedTags)
					.onChange(async (value) => {
						this.plugin.settings.excludedTags = value;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h2", { text: "Usage Statistics" });

		const stats = this.plugin.settings.usageStats;
		const acceptRate = stats.totalRequests > 0
			? Math.round((stats.acceptedRequests / stats.totalRequests) * 100)
			: 0;

		const statsContainer = containerEl.createDiv({ cls: "tabsidian-stats" });
		statsContainer.createEl("p", { text: `Total requests: ${stats.totalRequests}` });
		statsContainer.createEl("p", { text: `Accepted: ${stats.acceptedRequests}` });
		statsContainer.createEl("p", { text: `Total tokens: ${stats.totalTokens}` });
		statsContainer.createEl("p", { text: `Acceptance rate: ${acceptRate}%` });

		new Setting(containerEl)
			.setName("Reset Statistics")
			.setDesc("Clear all usage tracking data")
			.addButton((button) =>
				button
					.setButtonText("Reset")
					.setWarning()
					.onClick(async () => {
						this.plugin.settings.usageStats = {
							totalRequests: 0,
							acceptedRequests: 0,
							totalTokens: 0,
						};
						await this.plugin.saveSettings();
						this.display();
					})
			);
	}
}
