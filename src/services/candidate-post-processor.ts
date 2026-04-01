export interface PostProcessCompletionInput {
	prefix: string;
	suffix: string;
	rawText: string;
	maxLines: number;
}

export function postProcessCompletion(input: PostProcessCompletionInput): string {
	let text = input.rawText.replace(/\r\n?/g, "\n");
	text = text.replace(/^\[CURSOR\]\s*/i, "");
	text = text.replace(/^Continue writing from where the cursor is marked with \[CURSOR\]\.\s*/i, "");
	text = text.replace(/^Continue writing from the end of this text:\s*/i, "");
	text = removePrefixOverlap(text, input.prefix);
	text = removeSuffixEcho(text, input.suffix);

	const lines = text.split("\n").slice(0, input.maxLines);
	return lines.join("\n").trimEnd();
}

function removePrefixOverlap(text: string, prefix: string): string {
	const tail = prefix.slice(-200);
	const maxOverlap = Math.min(tail.length, text.length, 80);
	for (let len = maxOverlap; len >= 8; len--) {
		if (tail.slice(-len) === text.slice(0, len)) {
			return text.slice(len);
		}
	}
	return text;
}

function removeSuffixEcho(text: string, suffix: string): string {
	if (!suffix) return text;
	const trimmedSuffix = suffix.trimStart();
	if (trimmedSuffix.length === 0) return text;

	for (let len = Math.min(trimmedSuffix.length, text.length, 80); len >= 8; len--) {
		if (text.endsWith(trimmedSuffix.slice(0, len))) {
			return text.slice(0, -len);
		}
	}
	return text;
}
