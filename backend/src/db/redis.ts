import { createClient } from 'redis';

export function createRedisClient(redisUrl: string) {
  return createClient({ url: redisUrl });
}
