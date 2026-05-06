"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
class CacheService {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    async upsertDashboardState(workItems) {
        await this.redis.set('ims:dashboard:active', JSON.stringify(workItems), { EX: 30 });
    }
    async upsertWorkItem(workItem) {
        await this.redis.hSet('ims:work-items', workItem.id, JSON.stringify(workItem));
        const dashboard = await this.getDashboardState();
        const next = dashboard.filter((item) => item.id !== workItem.id && item.status !== 'CLOSED');
        if (workItem.status !== 'CLOSED') {
            next.unshift(workItem);
        }
        await this.upsertDashboardState(next);
    }
    async getDashboardState() {
        const cached = await this.redis.get('ims:dashboard:active');
        if (!cached) {
            return [];
        }
        return JSON.parse(cached);
    }
}
exports.CacheService = CacheService;
