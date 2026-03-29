export interface ContextResult {
	prefix: string;
	suffix: string;
}

export class ContextBuilder {
	build(doc: string, cursorPos: number, maxContextChars: number = 3000): ContextResult {
		const rawPrefix = doc.slice(0, cursorPos);
		const rawSuffix = doc.slice(cursorPos);

		const prefix = rawPrefix.length > maxContextChars
			? rawPrefix.slice(-maxContextChars)
			: rawPrefix;

		const suffix = rawSuffix.length > maxContextChars
			? rawSuffix.slice(0, maxContextChars)
			: rawSuffix;

		return { prefix, suffix };
	}
}
