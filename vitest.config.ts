import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: false,
		include: ["tests/**/*.test.ts"],
	},
	resolve: {
		alias: {
			obsidian: new URL("./src/__mocks__/obsidian.ts", import.meta.url).pathname,
		},
	},
});
