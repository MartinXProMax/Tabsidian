export interface CompletionRequest {
	prefix: string;
	suffix: string;
	language: string;
	maxTokens: number;
	signal: AbortSignal;
}

export interface CompletionResponse {
	text: string;
	tokensUsed: number;
}

export interface CompletionProvider {
	complete(request: CompletionRequest): Promise<CompletionResponse>;
	validateConfig(): Promise<boolean>;
}
