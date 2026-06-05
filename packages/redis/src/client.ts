import { Redis } from "@upstash/redis";

export { Redis };

export type RedisClient = Redis;
export type CreateRedisClientOptions = ConstructorParameters<typeof Redis>[0];
export type CreateRedisClientFromEnvOptions = Parameters<
  typeof Redis.fromEnv
>[0];

export function createRedisClient(options: CreateRedisClientOptions) {
  return new Redis(options);
}

export function createRedisClientFromEnv(
  options?: CreateRedisClientFromEnvOptions,
) {
  return Redis.fromEnv(options);
}
