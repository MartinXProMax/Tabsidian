export interface ContextResult {
	prefix: string;
	suffix: string;
	prompt: string;
}

export class ContextBuilder {
	build(doc: string, cursorPos: number, maxContextChars: number = 3000): ContextResult {
		const rawPrefix = doc.slice(0, cursorPos);
		const rawSuffix = doc.slice(cursorPos);

		const prefix = this.slicePrefix(rawPrefix, maxContextChars);
		const suffix = this.sliceSuffix(rawSuffix, maxContextChars);

		return {
			prefix,
			suffix,
			prompt: this.buildPrompt(prefix, suffix),
		};
	}

	private slicePrefix(rawPrefix: string, maxContextChars: number): string {
		if (rawPrefix.length <= maxContextChars) {
			return rawPrefix;
		}

		const preferred = Math.min(rawPrefix.length, Math.floor(maxContextChars * 1.2));
		const start = Math.max(0, rawPrefix.length - preferred);
		const candidate = rawPrefix.slice(start);
		const snapped = this.snapStart(candidate, maxContextChars);
		return snapped.length <= maxContextChars ? snapped : snapped.slice(-maxContextChars);
	}

	private sliceSuffix(rawSuffix: string, maxContextChars: number): string {
		if (rawSuffix.length <= maxContextChars) {
			return rawSuffix;
		}

		const preferred = Math.min(rawSuffix.length, Math.floor(maxContextChars * 0.9));
		const candidate = rawSuffix.slice(0, preferred);
		const snapped = this.snapEnd(candidate, rawSuffix, maxContextChars);
		return snapped.length <= maxContextChars ? snapped : snapped.slice(0, maxContextChars);
	}

	private snapStart(candidate: string, maxContextChars: number): string {
		if (candidate.length <= maxContextChars) {
			return candidate;
		}

		const overflow = candidate.length - maxContextChars;
		const searchWindow = candidate.slice(overflow, Math.min(candidate.length, overflow + 200));
		const paragraphIdx = searchWindow.indexOf("\n\n");
		if (paragraphIdx >= 0) {
			return candidate.slice(overflow + paragraphIdx + 2);
		}

		const lineIdx = searchWindow.indexOf("\n");
		if (lineIdx >= 0) {
			return candidate.slice(overflow + lineIdx + 1);
		}

		return candidate.slice(-maxContextChars);
	}

	private snapEnd(candidate: string, rawSuffix: string, maxContextChars: number): string {
		if (candidate.length >= rawSuffix.length) {
			return candidate;
		}

		const searchWindow = rawSuffix.slice(Math.max(0, candidate.length - 1), Math.min(rawSuffix.length, candidate.length + 200));
		const paragraphIdx = searchWindow.indexOf("\n\n");
		if (paragraphIdx >= 0) {
			return rawSuffix.slice(0, Math.min(candidate.length + paragraphIdx + 2, maxContextChars));
		}

		const lineIdx = searchWindow.indexOf("\n");
		if (lineIdx >= 0) {
			return rawSuffix.slice(0, Math.min(candidate.length + lineIdx + 1, maxContextChars));
		}

		return candidate.slice(0, maxContextChars);
	}

	private buildPrompt(prefix: string, suffix: string): string {
		if (suffix.length > 0) {
			return `Continue writing from where the cursor is marked with [CURSOR].\n\n${prefix}[CURSOR]${suffix}`;
		}

		return `Continue writing from the end of this text:\n\n${prefix}`;
	}
}
