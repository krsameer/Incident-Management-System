import { RedisClientType } from 'redis';
import { WorkItemRecord } from '../types';

export class CacheService {
  constructor(private readonly redis: RedisClientType<any, any, any>) {}

  async upsertDashboardState(workItems: WorkItemRecord[]): Promise<void> {
    await this.redis.set('ims:dashboard:active', JSON.stringify(workItems), { EX: 30 });
  }

  async upsertWorkItem(workItem: WorkItemRecord): Promise<void> {
    await this.redis.hSet('ims:work-items', workItem.id, JSON.stringify(workItem));
    const dashboard = await this.getDashboardState();
    const next = dashboard.filter((item) => item.id !== workItem.id && item.status !== 'CLOSED');
    if (workItem.status !== 'CLOSED') {
      next.unshift(workItem);
    }
    await this.upsertDashboardState(next);
  }

  async getDashboardState(): Promise<WorkItemRecord[]> {
    const cached = await this.redis.get('ims:dashboard:active');
    if (!cached) {
      return [];
    }
    return JSON.parse(cached) as WorkItemRecord[];
  }
}
