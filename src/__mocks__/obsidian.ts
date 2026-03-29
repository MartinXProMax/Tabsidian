// Stub for the Obsidian API used in tests.
// In tests, vi.mock("obsidian", ...) overrides these with mock implementations.
// This file exists so that Vite/Vitest can resolve the "obsidian" bare specifier.

export const requestUrl = async (_opts: unknown): Promise<unknown> => {
	throw new Error("requestUrl not mocked");
};
