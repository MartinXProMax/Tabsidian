import type { UsageStats } from "../settings";

export class UsageTracker {
	constructor(
		private readonly stats: UsageStats,
		private readonly save: () => void,
	) {}

	recordRequest(tokensUsed: number): void {
		this.stats.totalRequests++;
		this.stats.totalTokens += tokensUsed;
		this.save();
	}

	recordAcceptance(): void {
		this.stats.acceptedRequests++;
		this.save();
	}

	getAcceptanceRate(): number {
		if (this.stats.totalRequests === 0) return 0;
		return Math.round((this.stats.acceptedRequests / this.stats.totalRequests) * 100);
	}
}
