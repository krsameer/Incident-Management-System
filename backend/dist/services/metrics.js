"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsService = void 0;
class MetricsService {
    processedSignals = 0;
    createdWorkItems = 0;
    lastSignals = 0;
    start() {
        setInterval(() => {
            const rate = this.processedSignals - this.lastSignals;
            this.lastSignals = this.processedSignals;
            console.log(`[metrics] signals/sec=${rate} totalSignals=${this.processedSignals} workItems=${this.createdWorkItems}`);
        }, 5000).unref();
    }
    incrementSignals(count = 1) {
        this.processedSignals += count;
    }
    incrementWorkItems() {
        this.createdWorkItems += 1;
    }
}
exports.MetricsService = MetricsService;
