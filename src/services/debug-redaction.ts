export interface RedactDebugTextOptions {
	maxChars?: number;
}

export function redactDebugText(text: string, options: RedactDebugTextOptions = {}): string {
	const maxChars = options.maxChars ?? 4000;
	let redacted = text
		.replace(/(Authorization"?\s*[:=]\s*"?(?:Bearer|Basic|Token|ApiKey)\s+)[^"\s,}]+/gi, "$1[REDACTED]")
		.replace(/("Authorization"\s*:\s*")[^"]+(")/gi, "$1[REDACTED]$2")
		.replace(/("x-api-key"\s*:\s*")[^"]+(")/gi, "$1[REDACTED]$2")
		.replace(/(x-api-key"?\s*[:=]\s*"?)[^"\s,}]+/gi, "$1[REDACTED]")
		.replace(/("(?:api[_-]?key|access_token|secret[_-]?key|bearer_token)"\s*:\s*")[^"]+(")/gi, "$1[REDACTED]$2")
		.replace(/\b(sk-[A-Za-z0-9_-]{8,})/g, "[REDACTED]")
		.replace(/\b(AIza[A-Za-z0-9_-]{30,})/g, "[REDACTED]");

	if (redacted.length > maxChars) {
		redacted = `${redacted.slice(0, maxChars)}\n\n… [truncated]`;
	}

	return redacted;
}
