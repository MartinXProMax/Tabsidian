export class ExclusionFilter {
	private readonly folders: string[];
	private readonly tags: string[];

	constructor(excludedFolders: string, excludedTags: string) {
		this.folders = excludedFolders
			.split("\n")
			.map((f) => f.trim().replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase())
			.filter((f) => f.length > 0);

		this.tags = excludedTags
			.split(/\s+/)
			.map((t) => t.trim().replace(/^#/, "").toLowerCase())
			.filter((t) => t.length > 0);
	}

	isExcluded(filePath: string, fileTags: string[]): boolean {
		const normalizedPath = filePath.replace(/\\/g, "/").toLowerCase();

		for (const folder of this.folders) {
			if (normalizedPath.startsWith(folder + "/") || normalizedPath === folder) {
				return true;
			}
		}

		const normalizedFileTags = fileTags.map((t) => t.replace(/^#/, "").toLowerCase());
		for (const tag of this.tags) {
			if (normalizedFileTags.includes(tag)) {
				return true;
			}
		}

		return false;
	}
}
