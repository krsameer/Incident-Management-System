export class MetricsService {
  private processedSignals = 0;
  private createdWorkItems = 0;
  private lastSignals = 0;

  start(): void {
    setInterval(() => {
      const rate = this.processedSignals - this.lastSignals;
      this.lastSignals = this.processedSignals;
      console.log(`[metrics] signals/sec=${rate} totalSignals=${this.processedSignals} workItems=${this.createdWorkItems}`);
    }, 5000).unref();
  }

  incrementSignals(count = 1): void {
    this.processedSignals += count;
  }

  incrementWorkItems(): void {
    this.createdWorkItems += 1;
  }
}
