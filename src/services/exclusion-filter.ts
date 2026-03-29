export class ExclusionFilter {
	private readonly folders: string[];
	private readonly tags: string[];

	constructor(excludedFolders: string, excludedTags: string) {
		this.folders = excludedFolders
			.split("\n")
			.map((f) => f.trim().replace(/\/+$/, ""))
			.filter((f) => f.length > 0);

		this.tags = excludedTags
			.split(/\s+/)
			.map((t) => t.trim())
			.filter((t) => t.length > 0);
	}

	isExcluded(filePath: string, fileTags: string[]): boolean {
		const normalizedPath = filePath.replace(/\\/g, "/");

		for (const folder of this.folders) {
			if (normalizedPath.startsWith(folder + "/") || normalizedPath === folder) {
				return true;
			}
		}

		for (const tag of this.tags) {
			if (fileTags.includes(tag)) {
				return true;
			}
		}

		return false;
	}
}
