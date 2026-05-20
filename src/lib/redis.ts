import IORedis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: IORedis };

export const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

/**
 * Shared connection. BullMQ requires `maxRetriesPerRequest: null` for
 * blocking commands used by workers.
 */
export const redis =
  globalForRedis.redis ??
  new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
