import type { RedisClientOptions } from "redis";
import { createClient } from "redis";

export type CreateRedisClientOptions = RedisClientOptions;
export type CreateRedisClientFromEnvOptions = Omit<RedisClientOptions, "url">;

export interface RedisSubscription {
  unsubscribe(): Promise<void>;
}

export class Redis {
  private readonly client: ReturnType<typeof createClient>;
  private connectPromise: ReturnType<
    ReturnType<typeof createClient>["connect"]
  > | null = null;

  constructor(options: CreateRedisClientOptions) {
    this.client = createClient(options);
    this.client.on("error", (error) => {
      console.warn("Redis client error", error);
    });
  }

  private async getClient() {
    if (this.client.isOpen) {
      return this.client;
    }

    this.connectPromise ??= this.client.connect().catch((error: unknown) => {
      this.connectPromise = null;
      throw error;
    });

    return await this.connectPromise;
  }

  private static stringify(value: unknown) {
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  private static parseJson<T>(value: string | null) {
    return value === null ? null : (JSON.parse(value) as T);
  }

  async del(...keys: string[]) {
    if (keys.length === 0) {
      return 0;
    }

    const client = await this.getClient();

    return await client.del(keys);
  }

  async eval(script: string, keys: string[], args: string[] = []) {
    const client = await this.getClient();

    return await client.eval(script, {
      arguments: args,
      keys,
    });
  }

  async get<T = string>(key: string) {
    const client = await this.getClient();
    const value = await client.get(key);

    return Redis.parseJson<T>(value);
  }

  async getString(key: string) {
    const client = await this.getClient();

    return await client.get(key);
  }

  async hgetall<T extends Record<string, string> = Record<string, string>>(
    key: string,
  ) {
    const client = await this.getClient();
    const value = await client.hGetAll(key);

    return value as T;
  }

  async hincrby(key: string, field: string, increment: number) {
    const client = await this.getClient();

    return await client.hIncrBy(key, field, increment);
  }

  async hset(key: string, value: Record<string, string>) {
    const client = await this.getClient();

    return await client.hSet(key, value);
  }

  async publish(channel: string, value: unknown) {
    const client = await this.getClient();

    return await client.publish(channel, Redis.stringify(value));
  }

  async sadd(key: string, ...members: string[]) {
    if (members.length === 0) {
      return 0;
    }

    const client = await this.getClient();

    return await client.sAdd(key, members);
  }

  async set(
    key: string,
    value: unknown,
    options: {
      ex?: number;
    } = {},
  ) {
    const client = await this.getClient();
    const serializedValue = Redis.stringify(value);

    if (options.ex) {
      return await client.set(key, serializedValue, {
        expiration: { type: "EX", value: options.ex },
      });
    }

    return await client.set(key, serializedValue);
  }

  async smembers<T extends string[] = string[]>(key: string) {
    const client = await this.getClient();

    return (await client.sMembers(key)) as T;
  }

  async srem(key: string, ...members: string[]) {
    if (members.length === 0) {
      return 0;
    }

    const client = await this.getClient();

    return await client.sRem(key, members);
  }

  async subscribe<T = unknown>(
    channel: string,
    onMessage: (message: T) => void,
  ): Promise<RedisSubscription> {
    const subscriber = this.client.duplicate();
    subscriber.on("error", (error) => {
      console.warn("Redis subscriber error", error);
    });
    await subscriber.connect();
    await subscriber.subscribe(channel, (message) => {
      onMessage(Redis.parseJson<T>(message) as T);
    });

    return {
      async unsubscribe() {
        await subscriber.unsubscribe(channel);
        await subscriber.close();
      },
    };
  }

  async zadd(
    key: string,
    value: {
      member: string;
      score: number;
    },
  ) {
    const client = await this.getClient();

    return await client.zAdd(key, {
      score: value.score,
      value: value.member,
    });
  }

  async zrem(key: string, ...members: string[]) {
    if (members.length === 0) {
      return 0;
    }

    const client = await this.getClient();

    return await client.zRem(key, members);
  }
}

export type RedisClient = Redis;

export function createRedisClient(options: CreateRedisClientOptions) {
  return new Redis(options);
}

export function createRedisClientFromEnv(
  options?: CreateRedisClientFromEnvOptions,
) {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL is required to create a Redis client");
  }

  return createRedisClient({
    ...options,
    url: redisUrl,
  });
}

export function isRedisConfiguredFromEnv() {
  return Boolean(process.env.REDIS_URL);
}
