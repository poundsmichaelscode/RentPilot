import {
  Redis,
} from "ioredis";

const redisUrl =
  process.env.REDIS_URL ??
  "redis://127.0.0.1:6379";

export function createRedisConnection() {
  return new Redis(
    redisUrl,
    {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    },
  );
}
