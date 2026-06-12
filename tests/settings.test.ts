import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
	PluginSettingTab: class {},
	Plugin: class {},
	Setting: class {},
	Notice: class {},
}));

import {
	DEFAULT_SETTINGS,
	PROVIDER_DEFAULTS,
	providerSupportsThinking,
	type ProviderType,
} from "../src/settings";

describe("DEFAULT_SETTINGS.systemPrompt", () => {
	it("defines the core inline completion constraints", () => {
		expect(DEFAULT_SETTINGS.systemPrompt).toContain("Output only the text to insert");
		expect(DEFAULT_SETTINGS.systemPrompt).toContain("Do not repeat text already present before the cursor");
		expect(DEFAULT_SETTINGS.systemPrompt).toContain("Do not echo text already present after the cursor");
		expect(DEFAULT_SETTINGS.systemPrompt).toContain("Do not wrap the answer in Markdown fences");
		expect(DEFAULT_SETTINGS.systemPrompt).toContain("Return an empty string");
	});
});

describe("thinking mode support", () => {
	it("is disabled for every provider", () => {
		const providers = Object.keys(PROVIDER_DEFAULTS) as ProviderType[];
		for (const provider of providers) {
			expect(providerSupportsThinking(provider)).toBe(false);
		}
	});
});
