import { describe, it, expect } from "vitest";
import { ExclusionFilter } from "../../src/services/exclusion-filter";

describe("ExclusionFilter", () => {
	describe("isExcluded", () => {
		it("should exclude files in excluded folders", () => {
			const filter = new ExclusionFilter("templates/\ndaily-notes/", "");
			expect(filter.isExcluded("templates/my-template.md", [])).toBe(true);
			expect(filter.isExcluded("daily-notes/2024-01-01.md", [])).toBe(true);
			expect(filter.isExcluded("projects/my-project.md", [])).toBe(false);
		});

		it("should exclude files with excluded tags", () => {
			const filter = new ExclusionFilter("", "#private #draft");
			expect(filter.isExcluded("notes/secret.md", ["#private"])).toBe(true);
			expect(filter.isExcluded("notes/wip.md", ["#draft"])).toBe(true);
			expect(filter.isExcluded("notes/public.md", ["#published"])).toBe(false);
		});

		it("should handle combined folder and tag exclusion", () => {
			const filter = new ExclusionFilter("archive/", "#draft");
			expect(filter.isExcluded("archive/old.md", [])).toBe(true);
			expect(filter.isExcluded("notes/wip.md", ["#draft"])).toBe(true);
			expect(filter.isExcluded("notes/good.md", ["#published"])).toBe(false);
		});

		it("should handle empty exclusion rules", () => {
			const filter = new ExclusionFilter("", "");
			expect(filter.isExcluded("anything.md", ["#any"])).toBe(false);
		});

		it("should handle nested folder paths", () => {
			const filter = new ExclusionFilter("projects/archive/", "");
			expect(filter.isExcluded("projects/archive/old.md", [])).toBe(true);
			expect(filter.isExcluded("projects/active/new.md", [])).toBe(false);
		});

		it("should ignore blank lines in folder config", () => {
			const filter = new ExclusionFilter("templates/\n\n\ndaily-notes/\n", "");
			expect(filter.isExcluded("templates/t.md", [])).toBe(true);
			expect(filter.isExcluded("daily-notes/d.md", [])).toBe(true);
			expect(filter.isExcluded("other/o.md", [])).toBe(false);
		});
	});
});
