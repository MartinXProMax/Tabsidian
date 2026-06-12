import type { UsageStats } from "../settings";

export class UsageTracker {
	private saveQueue: Promise<void> | null = null;

	constructor(
		private readonly stats: UsageStats,
		private readonly save: () => void | Promise<void>,
	) {}

	recordRequest(tokensUsed: number): void {
		this.stats.totalRequests++;
		this.stats.totalTokens += tokensUsed;
		this.queueSave();
	}

	recordAcceptance(): void {
		if (this.stats.acceptedRequests >= this.stats.totalRequests) return;

		this.stats.acceptedRequests++;
		this.queueSave();
	}

	getAcceptanceRate(): number {
		if (this.stats.totalRequests === 0) return 0;
		return Math.round((this.stats.acceptedRequests / this.stats.totalRequests) * 100);
	}

	flush(): Promise<void> {
		return this.saveQueue ?? Promise.resolve();
	}

	private queueSave(): void {
		const runSave = () => Promise.resolve(this.save()).catch(() => {});

		if (!this.saveQueue) {
			this.saveQueue = runSave().finally(() => {
				this.saveQueue = null;
			});
			return;
		}

		this.saveQueue = this.saveQueue.then(runSave);
	}
}
