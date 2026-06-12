import { App, PluginSettingTab, Setting, Plugin, Notice } from "obsidian";
import type { ProviderTestResult } from "./services/provider-tester";
import { debugLog } from "./providers/base";

export type ProviderType =
	| "openai"
	| "anthropic"
	| "gemini"
	| "openrouter"
	| "qwen"
	| "siliconflow"
	| "ollama"
	| "custom";

/** Default base URLs and model names per provider (OpenAI-compatible ones) */
export const PROVIDER_DEFAULTS: Record<ProviderType, { baseUrl: string; model: string; needsKey: boolean }> = {
	openai:      { baseUrl: "https://api.openai.com/v1",                                    model: "gpt-4o-mini",                  needsKey: true },
	anthropic:   { baseUrl: "https://api.anthropic.com/v1",                                model: "claude-sonnet-4-6-20250514",  needsKey: true },
	gemini:      { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",       model: "gemini-2.0-flash",             needsKey: true },
	openrouter:  { baseUrl: "https://openrouter.ai/api/v1",                                 model: "openai/gpt-4o-mini",           needsKey: true },
	qwen:        { baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",             model: "qwen-plus",                    needsKey: true },
	siliconflow: { baseUrl: "https://api.siliconflow.cn/v1",                                model: "Qwen/Qwen2.5-7B-Instruct",    needsKey: true },
	ollama:      { baseUrl: "http://localhost:11434",                                        model: "llama3",                       needsKey: false },
	custom:      { baseUrl: "",                                                              model: "gpt-4o-mini",                  needsKey: true },
};

// Thinking mode is not yet implemented; kept as an extension point.
export function providerSupportsThinking(_provider: ProviderType): boolean {
	return false;
}

export function normalizeProviderType(value: unknown): ProviderType {
	if (typeof value === "string" && value in PROVIDER_DEFAULTS) {
		return value as ProviderType;
	}
	return "openai";
}
export type SettingsLanguage = "en" | "zh-CN";

export interface ProviderConfig {
	apiKey: string;
	model: string;
	baseUrl: string;
}

export interface TabsidianSettings {
	uiLanguage: SettingsLanguage;
	provider: ProviderType;
	providerConfigs: Record<ProviderType, ProviderConfig>;
	enableThinking: boolean;
	thinkingBudget: number;
	debugMode: boolean;
	debugRedactSensitive: boolean;
	debugMaxBodyChars: number;
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

export const DEFAULT_PROVIDER_CONFIGS: Record<ProviderType, ProviderConfig> = {
	openai:      { apiKey: "", model: "gpt-4o-mini",               baseUrl: "" },
	anthropic:   { apiKey: "", model: "claude-sonnet-4-6-20250514", baseUrl: "" },
	gemini:      { apiKey: "", model: "gemini-2.0-flash",           baseUrl: "" },
	openrouter:  { apiKey: "", model: "openai/gpt-4o-mini",         baseUrl: "" },
	qwen:        { apiKey: "", model: "qwen-plus",                  baseUrl: "" },
	siliconflow: { apiKey: "", model: "Qwen/Qwen2.5-7B-Instruct",  baseUrl: "" },
	ollama:      { apiKey: "", model: "llama3",                     baseUrl: "" },
	custom:      { apiKey: "", model: "gpt-4o-mini",                baseUrl: "" },
};

export const DEFAULT_SETTINGS: TabsidianSettings = {
	uiLanguage: "en",
	provider: "openai",
	providerConfigs: structuredClone(DEFAULT_PROVIDER_CONFIGS),
	enableThinking: false,
	thinkingBudget: 1024,
	debugMode: false,
	debugRedactSensitive: true,
	debugMaxBodyChars: 4000,
	debounceMs: 500,
	maxLines: 5,
	acceptSuggestionKey: "Tab",
	systemPrompt: `You are Tabsidian's inline completion engine for Markdown notes.

Task:
- Output only the text to insert at the cursor.
- Do not explain, introduce, summarize, or mention that you are an AI.
- Do not wrap the answer in Markdown fences unless the cursor is already inside a code fence and the fence content itself should continue.

Context:
- The user prompt may contain [CURSOR]. Text before [CURSOR] is already written. Text after [CURSOR] already exists after the insertion point.
- Do not repeat text already present before the cursor.
- Do not echo text already present after the cursor.
- If there is text after [CURSOR], write only the bridge that fits naturally between the before and after text.

Style:
- Continue in the same language as the surrounding note, including Chinese, English, or mixed text.
- Match the existing tone, vocabulary, tense, person, and level of formality.
- Preserve Markdown style: headings, lists, tables, blockquotes, links, [[wikilinks]], #tags, YAML frontmatter, math, and code indentation.
- Continue the current structure instead of starting a new unrelated section.

Length:
- Prefer the smallest useful completion: a phrase, the rest of the sentence, one list item, one table cell/row, or 1-3 short sentences.
- Stop at a natural boundary. Do not continue into a new topic.

Quality:
- If the next text is obvious, complete it directly.
- If the context is ambiguous or insufficient, Return an empty string.
- Never include placeholders, alternatives, or meta-commentary.`,
	excludedFolders: "",
	excludedTags: "",
	usageStats: {
		totalRequests: 0,
		acceptedRequests: 0,
		totalTokens: 0,
	},
};

const I18N = {
	en: {
		languageSection: "Language",
		languageName: "Settings Language",
		languageDesc: "Choose the language used in this settings page",
		langEnglish: "English",
		langChinese: "简体中文",
		aiProvider: "AI Provider",
		provider: "Provider",
		providerDesc: "Select the AI completion provider",
		apiKey: "API Key",
		apiKeyDesc: "Your API key (stored locally, never uploaded)",
		model: "Model",
		modelDesc: "Model name to use for completions",
		apiBaseUrl: "API Base URL",
		apiBaseUrlDesc: "Custom API endpoint (leave empty for default)",
		testConnection: "Test Connection",
		testConnectionDesc: "Send a lightweight request to verify the current provider, model, and credentials",
		testButton: "Test",
		testingButton: "Testing...",
		completionBehavior: "Completion Behavior",
		triggerDelay: "Trigger Delay (ms)",
		triggerDelayDesc: "How long to wait after typing stops before triggering completion (200-2000)",
		maxCompletionLines: "Max Completion Lines",
		maxCompletionLinesDesc: "Maximum number of lines per suggestion (1-20)",
		acceptSuggestionKey: "Accept Suggestion Key",
		acceptSuggestionKeyDesc: "Focus this field and press the key combination you want to use for accepting the full suggestion",
		shortcutPlaceholder: "Press a shortcut",
		systemPrompt: "System Prompt",
		systemPromptDesc: "Custom system prompt for AI completions",
		exclusionRules: "Exclusion Rules",
		excludedFolders: "Excluded Folders",
		excludedFoldersDesc: "Folders where completion is disabled (one per line)",
		excludedTags: "Excluded Tags",
		excludedTagsDesc: "Notes with these tags won't trigger completion (space-separated)",
		usageStats: "Usage Statistics",
		totalRequests: "Total requests",
		accepted: "Accepted",
		totalTokens: "Total tokens",
		acceptanceRate: "Acceptance rate",
		resetStats: "Reset Statistics",
		resetStatsDesc: "Clear all usage tracking data",
		resetButton: "Reset",
		modelPlaceholder: "gpt-4o-mini",
		apiBaseUrlPlaceholder: "https://api.openai.com/v1",
		systemPromptPlaceholder: "You are an inline text completion engine...",
		noticePrefix: "Tabsidian",
		enableThinking: "Enable Thinking",
		enableThinkingDesc: "Enable thinking/reasoning mode for supported models (e.g. o1/o3/o4-mini for OpenAI, Claude with extended thinking, deepseek-r1/qwen3 for Ollama)",
		enableThinkingUnsupportedDesc: "Thinking mode is currently disabled for all providers",
		thinkingBudget: "Thinking Budget (tokens)",
		thinkingBudgetDesc: "Maximum tokens allocated for the model's internal reasoning (Anthropic only, 1024-16384)",
		debugMode: "Debug Mode",
		debugModeDesc: "Show raw API request and response data in settings for troubleshooting",
		debugRedactSensitive: "Redact Sensitive Data",
		debugRedactSensitiveDesc: "Mask API keys and tokens in debug output",
		debugMaxBodyChars: "Debug Preview Size",
		debugMaxBodyCharsDesc: "Maximum characters shown for request and response bodies",
		debugLog: "Debug Log",
		debugLogEmpty: "No API requests recorded yet. Trigger a completion and reopen settings to see results.",
		debugClear: "Clear Log",
		debugRequest: "Request",
		debugResponse: "Response",
		debugMeta: "Metadata",
		debugTransport: "Transport",
		debugDuration: "Duration",
		debugFallback: "Fallback",
		qwenLabel: "Qwen (通义千问)",
		siliconflowLabel: "SiliconFlow (硅基流动)",
		customLabel: "Custom (OpenAI-compatible)",
	},
	"zh-CN": {
		languageSection: "语言",
		languageName: "设置语言",
		languageDesc: "选择此设置页面使用的语言",
		langEnglish: "English",
		langChinese: "简体中文",
		aiProvider: "AI 提供商",
		provider: "提供商",
		providerDesc: "选择用于补全的 AI 提供商",
		apiKey: "API Key",
		apiKeyDesc: "你的 API Key（仅本地存储，不会上传）",
		model: "模型",
		modelDesc: "用于补全的模型名称",
		apiBaseUrl: "API 基础地址",
		apiBaseUrlDesc: "自定义 API 端点（留空则使用默认值）",
		testConnection: "测试连接",
		testConnectionDesc: "发送一次轻量请求，验证当前提供商、模型和凭证是否可用",
		testButton: "测试",
		testingButton: "测试中...",
		completionBehavior: "补全行为",
		triggerDelay: "触发延迟（毫秒）",
		triggerDelayDesc: "停止输入后等待多久再触发补全（200-2000）",
		maxCompletionLines: "最大补全行数",
		maxCompletionLinesDesc: "每条建议最多包含的行数（1-20）",
		acceptSuggestionKey: "接受补全按键",
		acceptSuggestionKeyDesc: "聚焦此输入框后，直接按下你想用来接受整段补全的快捷键",
		shortcutPlaceholder: "按下快捷键",
		systemPrompt: "系统提示词",
		systemPromptDesc: "用于 AI 补全的自定义系统提示词",
		exclusionRules: "排除规则",
		excludedFolders: "排除文件夹",
		excludedFoldersDesc: "这些文件夹中禁用补全（每行一个）",
		excludedTags: "排除标签",
		excludedTagsDesc: "带有这些标签的笔记不会触发补全（空格分隔）",
		usageStats: "使用统计",
		totalRequests: "总请求数",
		accepted: "已接受",
		totalTokens: "总 Token 数",
		acceptanceRate: "接受率",
		resetStats: "重置统计",
		resetStatsDesc: "清除所有使用统计数据",
		resetButton: "重置",
		modelPlaceholder: "gpt-4o-mini",
		apiBaseUrlPlaceholder: "https://api.openai.com/v1",
		systemPromptPlaceholder: "你是一个 Markdown 笔记应用的行内补全引擎……",
		noticePrefix: "Tabsidian",
		enableThinking: "启用思考模式",
		enableThinkingDesc: "为支持的模型启用思考/推理模式（如 OpenAI 的 o1/o3/o4-mini，Claude 的扩展思考，Ollama 的 deepseek-r1/qwen3）",
		enableThinkingUnsupportedDesc: "当前已对所有提供商关闭思考模式",
		thinkingBudget: "思考预算（Token 数）",
		thinkingBudgetDesc: "模型内部推理的最大 Token 数（仅 Anthropic，1024-16384）",
		debugMode: "调试模式",
		debugModeDesc: "在设置页面显示 API 请求与响应的原始数据，便于排查问题",
		debugRedactSensitive: "敏感信息脱敏",
		debugRedactSensitiveDesc: "对调试输出中的 API Key 和令牌进行遮罩",
		debugMaxBodyChars: "调试预览大小",
		debugMaxBodyCharsDesc: "请求与响应内容显示的最大字符数",
		debugLog: "调试日志",
		debugLogEmpty: "暂无 API 请求记录。触发一次补全后重新打开设置即可看到。",
		debugClear: "清空日志",
		debugRequest: "请求",
		debugResponse: "响应",
		debugMeta: "元数据",
		debugTransport: "传输方式",
		debugDuration: "耗时",
		debugFallback: "回退",
		qwenLabel: "Qwen（通义千问）",
		siliconflowLabel: "SiliconFlow（硅基流动）",
		customLabel: "自定义（OpenAI 兼容）",
	},
} as const;

function getStrings(language: SettingsLanguage) {
	return I18N[language];
}

export function normalizeAcceptSuggestionKey(value: string): string {
	const normalized = value.trim();
	if (normalized.length === 0) return DEFAULT_SETTINGS.acceptSuggestionKey;

	// Migrate legacy single-letter bindings (old isImplicitShift behavior)
	if (normalized.length === 1 && /[A-Z]/.test(normalized)) {
		return `Shift-${normalized}`;
	}

	return normalized;
}

export function keyEventToKeybinding(event: KeyboardEvent): string | null {
	const baseKey = normalizeKeyName(event.key);
	if (!baseKey) return null;

	const modifiers: string[] = [];
	if (event.ctrlKey) modifiers.push("Ctrl");
	if (event.altKey) modifiers.push("Alt");
	if (event.shiftKey) modifiers.push("Shift");
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

export class TabsidianSettingTab extends PluginSettingTab {
	plugin: Plugin & {
		settings: TabsidianSettings;
		saveSettings(): Promise<void>;
		testCurrentProviderConnection(): Promise<ProviderTestResult>;
	};

	constructor(app: App, plugin: Plugin & {
		settings: TabsidianSettings;
		saveSettings(): Promise<void>;
		testCurrentProviderConnection(): Promise<ProviderTestResult>;
	}) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const strings = getStrings(this.plugin.settings.uiLanguage);

		containerEl.createEl("h2", { text: strings.languageSection });

		new Setting(containerEl)
			.setName(strings.languageName)
			.setDesc(strings.languageDesc)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("en", strings.langEnglish)
					.addOption("zh-CN", strings.langChinese)
					.setValue(this.plugin.settings.uiLanguage)
					.onChange(async (value: string) => {
						this.plugin.settings.uiLanguage = value as SettingsLanguage;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		containerEl.createEl("h2", { text: strings.aiProvider });

		const currentProvider = this.plugin.settings.provider;
		const providerDef = PROVIDER_DEFAULTS[currentProvider];
		const cfg = this.plugin.settings.providerConfigs[currentProvider];

		new Setting(containerEl)
			.setName(strings.provider)
			.setDesc(strings.providerDesc)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("openai", "OpenAI")
					.addOption("anthropic", "Anthropic Claude")
					.addOption("gemini", "Google Gemini")
					.addOption("openrouter", "OpenRouter")
					.addOption("qwen", strings.qwenLabel)
					.addOption("siliconflow", strings.siliconflowLabel)
					.addOption("ollama", "Ollama (Local)")
					.addOption("custom", strings.customLabel)
					.setValue(currentProvider)
					.onChange(async (value: string) => {
						this.plugin.settings.provider = value as ProviderType;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		// API Key — only for providers that need it
		if (providerDef?.needsKey !== false) {
			new Setting(containerEl)
				.setName(strings.apiKey)
				.setDesc(strings.apiKeyDesc)
				.addText((text) => {
					text.inputEl.type = "password";
					text
						.setPlaceholder("sk-...")
						.setValue(cfg.apiKey)
						.onChange(async (value) => {
							cfg.apiKey = value;
							await this.plugin.saveSettings();
						});
				});
		}

		new Setting(containerEl)
			.setName(strings.model)
			.setDesc(strings.modelDesc)
			.addText((text) =>
				text
					.setPlaceholder(providerDef?.model ?? strings.modelPlaceholder)
					.setValue(cfg.model)
					.onChange(async (value) => {
						cfg.model = value;
						await this.plugin.saveSettings();
					})
			);

		// Base URL — only for custom and ollama (providers where the user may need to change it)
		if (currentProvider === "custom" || currentProvider === "ollama") {
			new Setting(containerEl)
				.setName(strings.apiBaseUrl)
				.setDesc(strings.apiBaseUrlDesc)
				.addText((text) =>
					text
						.setPlaceholder(providerDef?.baseUrl ?? strings.apiBaseUrlPlaceholder)
						.setValue(cfg.baseUrl)
						.onChange(async (value) => {
							cfg.baseUrl = value;
							await this.plugin.saveSettings();
						})
				);
		}

		new Setting(containerEl)
			.setName(strings.testConnection)
			.setDesc(strings.testConnectionDesc)
			.addButton((button) =>
				button
					.setButtonText(strings.testButton)
					.onClick(async () => {
						button.setDisabled(true);
						button.setButtonText(strings.testingButton);
						try {
							const result = await this.plugin.testCurrentProviderConnection();
							new Notice(`${strings.noticePrefix}: ${result.message}`);
						} finally {
							button.setDisabled(false);
							button.setButtonText(strings.testButton);
						}
					})
			);

		containerEl.createEl("h2", { text: strings.completionBehavior });

		new Setting(containerEl)
			.setName(strings.triggerDelay)
			.setDesc(strings.triggerDelayDesc)
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
			.setName(strings.maxCompletionLines)
			.setDesc(strings.maxCompletionLinesDesc)
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
			.setName(strings.acceptSuggestionKey)
			.setDesc(strings.acceptSuggestionKeyDesc)
			.addText((text) =>
				{
					text
						.setPlaceholder(strings.shortcutPlaceholder)
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
			.setName(strings.enableThinking)
			.setDesc(providerSupportsThinking(currentProvider) ? strings.enableThinkingDesc : strings.enableThinkingUnsupportedDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableThinking)
					.setDisabled(!providerSupportsThinking(currentProvider))
					.onChange(async (value) => {
						this.plugin.settings.enableThinking = value;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		if (providerSupportsThinking(currentProvider) && this.plugin.settings.enableThinking && this.plugin.settings.provider === "anthropic") {
			new Setting(containerEl)
				.setName(strings.thinkingBudget)
				.setDesc(strings.thinkingBudgetDesc)
				.addSlider((slider) =>
					slider
						.setLimits(1024, 16384, 256)
						.setValue(this.plugin.settings.thinkingBudget)
						.setDynamicTooltip()
						.onChange(async (value) => {
							this.plugin.settings.thinkingBudget = value;
							await this.plugin.saveSettings();
						})
				);
		}

		new Setting(containerEl)
			.setName(strings.debugMode)
			.setDesc(strings.debugModeDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.debugMode)
					.onChange(async (value) => {
						this.plugin.settings.debugMode = value;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		if (this.plugin.settings.debugMode) {
			new Setting(containerEl)
				.setName(strings.debugRedactSensitive)
				.setDesc(strings.debugRedactSensitiveDesc)
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.debugRedactSensitive)
						.onChange(async (value) => {
							this.plugin.settings.debugRedactSensitive = value;
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName(strings.debugMaxBodyChars)
				.setDesc(strings.debugMaxBodyCharsDesc)
				.addSlider((slider) =>
					slider
						.setLimits(500, 12000, 500)
						.setValue(this.plugin.settings.debugMaxBodyChars)
						.setDynamicTooltip()
						.onChange(async (value) => {
							this.plugin.settings.debugMaxBodyChars = value;
							await this.plugin.saveSettings();
						})
				);

			containerEl.createEl("h2", { text: strings.debugLog });

			const entries = debugLog.getAll();
			if (entries.length === 0) {
				containerEl.createEl("p", {
					text: strings.debugLogEmpty,
					cls: "setting-item-description",
				});
			} else {
				for (const entry of [...entries].reverse()) {
					const time = new Date(entry.timestamp).toLocaleTimeString();
					const wrapper = containerEl.createDiv({ cls: "tabsidian-debug-entry" });

					wrapper.createEl("h4", {
						text: `${time} — ${entry.provider}/${entry.model} [${entry.responseStatus}]`,
					});

					const meta = wrapper.createDiv({ cls: "tabsidian-debug-meta" });
					meta.createEl("p", { text: `${strings.debugTransport}: ${entry.transport}` });
					meta.createEl("p", { text: `${strings.debugDuration}: ${entry.durationMs} ms` });
					meta.createEl("p", { text: `${strings.debugFallback}: ${entry.usedFallback ? (entry.fallbackReason ?? "yes") : "no"}` });

					wrapper.createEl("h5", {
						text: `${strings.debugRequest}: ${entry.requestUrl}`,
					});
					const reqPre = wrapper.createEl("pre", { cls: "tabsidian-debug-pre" });
					reqPre.createEl("code", {
						text: this.limitDebugText(entry.requestBody),
					});

					wrapper.createEl("h5", { text: strings.debugResponse });
					const resPre = wrapper.createEl("pre", { cls: "tabsidian-debug-pre" });
					resPre.createEl("code", {
						text: this.limitDebugText(entry.responseBody),
					});
				}

				new Setting(containerEl)
					.setName(strings.debugClear)
					.addButton((button) =>
						button
							.setButtonText(strings.debugClear)
							.setWarning()
							.onClick(() => {
								debugLog.clear();
								this.display();
							})
					);
			}
		}

		new Setting(containerEl)
			.setName(strings.systemPrompt)
			.setDesc(strings.systemPromptDesc)
			.addTextArea((text) =>
				text
					.setPlaceholder(strings.systemPromptPlaceholder)
					.setValue(this.plugin.settings.systemPrompt)
					.onChange(async (value) => {
						this.plugin.settings.systemPrompt = value;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h2", { text: strings.exclusionRules });

		new Setting(containerEl)
			.setName(strings.excludedFolders)
			.setDesc(strings.excludedFoldersDesc)
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
			.setName(strings.excludedTags)
			.setDesc(strings.excludedTagsDesc)
			.addTextArea((text) =>
				text
					.setPlaceholder("#private #draft")
					.setValue(this.plugin.settings.excludedTags)
					.onChange(async (value) => {
						this.plugin.settings.excludedTags = value;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h2", { text: strings.usageStats });

		const stats = this.plugin.settings.usageStats;
		const acceptRate = stats.totalRequests > 0
			? Math.round((stats.acceptedRequests / stats.totalRequests) * 100)
			: 0;

		const statsContainer = containerEl.createDiv({ cls: "tabsidian-stats" });
		statsContainer.createEl("p", { text: `${strings.totalRequests}: ${stats.totalRequests}` });
		statsContainer.createEl("p", { text: `${strings.accepted}: ${stats.acceptedRequests}` });
		statsContainer.createEl("p", { text: `${strings.totalTokens}: ${stats.totalTokens}` });
		statsContainer.createEl("p", { text: `${strings.acceptanceRate}: ${acceptRate}%` });

		new Setting(containerEl)
			.setName(strings.resetStats)
			.setDesc(strings.resetStatsDesc)
			.addButton((button) =>
				button
					.setButtonText(strings.resetButton)
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

	private limitDebugText(raw: string): string {
		const limited = raw.length > this.plugin.settings.debugMaxBodyChars
			? `${raw.slice(0, this.plugin.settings.debugMaxBodyChars)}\n\n… [truncated]`
			: raw;

		try {
			return JSON.stringify(JSON.parse(limited), null, 2);
		} catch {
			return limited;
		}
	}
}
