import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => {
	class Plugin {
		app = {
			workspace: {
				getActiveViewOfType: vi.fn(),
			},
			metadataCache: {
				getFileCache: vi.fn(),
			},
		};
		loadData = vi.fn();
		saveData = vi.fn();
		addSettingTab = vi.fn();
		registerEditorExtension = vi.fn();
		registerDomEvent = vi.fn();
	}

	class PluginSettingTab {
		constructor(
			readonly app: unknown,
			readonly plugin: unknown,
		) {}
	}

	class Setting {}
	class Notice {}
	class MarkdownView {}

	return {
		Plugin,
		PluginSettingTab,
		Setting,
		Notice,
		MarkdownView,
		requestUrl: vi.fn(),
	};
});

describe("TabsidianPlugin settings migration", () => {
	it("migrates legacy flat settings to the normalized provider config", async () => {
		const { default: TabsidianPlugin } = await import("../src/main");
		const plugin = new TabsidianPlugin({} as never, {} as never);
		vi.mocked(plugin.loadData).mockResolvedValue({
			provider: "unknown-provider",
			apiKey: "legacy-key",
			model: "legacy-model",
			apiBaseUrl: "https://example.test/v1",
		});

		await plugin.loadSettings();

		expect(plugin.settings.provider).toBe("openai");
		expect(plugin.settings.providerConfigs.openai).toMatchObject({
			apiKey: "legacy-key",
			model: "legacy-model",
			baseUrl: "https://example.test/v1",
		});
	});

	it("disables legacy saved thinking mode on load", async () => {
		const { default: TabsidianPlugin } = await import("../src/main");
		const plugin = new TabsidianPlugin({} as never, {} as never);
		vi.mocked(plugin.loadData).mockResolvedValue({
			provider: "openai",
			enableThinking: true,
		});

		await plugin.loadSettings();

		expect(plugin.settings.enableThinking).toBe(false);
	});

	it("normalizes thinking mode off before saving", async () => {
		const { default: TabsidianPlugin } = await import("../src/main");
		const plugin = new TabsidianPlugin({} as never, {} as never);
		await plugin.loadSettings();
		plugin.settings.enableThinking = true;

		await plugin.saveSettings();

		expect(plugin.settings.enableThinking).toBe(false);
		expect(plugin.saveData).toHaveBeenCalledWith(expect.objectContaining({
			enableThinking: false,
		}));
	});
});
