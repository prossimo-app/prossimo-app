import { randomUUID } from "node:crypto";
import { EventEmitter, on } from "node:events";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { RedisClient } from "@prossimo-app/redis";
import { createRedisClientFromEnv } from "@prossimo-app/redis";

const ACTIVE_TOPICS_KEY = "rt:active_topics";
const ACTIVE_TOPICS_LAST_SEEN_KEY = "rt:active_topics:last_seen";
const TOPIC_UPDATE_CHANNEL = "rt:topic_updates";
const TOPIC_GRACE_PERIOD_MS = 60_000;
const DERIVED_CACHE_TTL_SECONDS = 45;
const TOPIC_CACHE_POLL_INTERVAL_MS = 5_000;

const topicSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1).max(200),
    type: z.literal("route"),
  }),
  z.object({
    id: z.string().min(1).max(200),
    stopCode: z.string().min(1).max(200).nullish(),
    type: z.literal("stop"),
  }),
  z.object({
    id: z.string().min(1).max(200),
    type: z.literal("vehicle"),
  }),
]);

export const observeTopicInputSchema = z.object({
  topic: topicSchema,
});

export type ObservedTopic = z.infer<typeof topicSchema>;

export interface RealtimeTopicPayload<TPayload = unknown> {
  payload: TPayload;
  topic: string;
  updatedAt: string;
}

export interface RealtimeTopicUpdate {
  cacheKey: string;
  id: string;
  payload: RealtimeTopicPayload;
  publishedAt: string;
  topic: string;
}

let redisClient: RedisClient | null | undefined;
let updateSubscriberStarted = false;
const topicEvents = new EventEmitter();
topicEvents.setMaxListeners(0);

export function getRealtimeRedisClient() {
  if (redisClient !== undefined) {
    return redisClient;
  }

  redisClient =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
      ? createRedisClientFromEnv()
      : null;

  return redisClient;
}

export function formatObservedTopic(topic: ObservedTopic) {
  return `${topic.type}:${topic.id}`;
}

export function parseObservedTopic(topic: string): ObservedTopic | null {
  const separatorIndex = topic.indexOf(":");

  if (separatorIndex < 1) {
    return null;
  }

  const type = topic.slice(0, separatorIndex);
  const id = topic.slice(separatorIndex + 1);
  const parsed = topicSchema.safeParse({ id, type });

  return parsed.success ? parsed.data : null;
}

export function getDerivedCacheKey(topic: ObservedTopic | string) {
  const parsedTopic =
    typeof topic === "string" ? parseObservedTopic(topic) : topic;

  if (!parsedTopic) {
    return null;
  }

  if (parsedTopic.type === "route") {
    return `rt:route:${parsedTopic.id}:vehicles`;
  }

  if (parsedTopic.type === "stop") {
    return `rt:stop:${parsedTopic.id}:arrivals`;
  }

  return `rt:vehicle:${parsedTopic.id}`;
}

function getTopicStateKey(topic: string) {
  return `rt:topic:${topic}`;
}

function getStoredStopCode(
  state: Record<string, string> | null,
  fallback: string | null | undefined,
) {
  const storedStopCode = state?.stop_code;

  if (storedStopCode === "") {
    return fallback;
  }

  return storedStopCode ?? fallback;
}

function requireRedis(redis: RedisClient | null = getRealtimeRedisClient()) {
  if (!redis) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Redis is required for realtime topics",
    });
  }

  return redis;
}

export async function registerObservedTopic(
  topic: ObservedTopic,
  redis: RedisClient | null = getRealtimeRedisClient(),
) {
  const client = requireRedis(redis);
  const formattedTopic = formatObservedTopic(topic);
  const now = Date.now();
  const stateKey = getTopicStateKey(formattedTopic);

  await client.sadd(ACTIVE_TOPICS_KEY, formattedTopic);
  await client.zadd(ACTIVE_TOPICS_LAST_SEEN_KEY, {
    member: formattedTopic,
    score: now,
  });
  const subscriberCount = await client.hincrby(stateKey, "subscriber_count", 1);
  await client.hset(stateKey, {
    id: topic.id,
    last_seen_at: new Date(now).toISOString(),
    subscriber_count: String(Math.max(0, subscriberCount)),
    stop_code: topic.type === "stop" ? (topic.stopCode ?? "") : "",
    type: topic.type,
    zero_since_at: "",
  });

  return subscriberCount;
}

export async function unregisterObservedTopic(
  topic: ObservedTopic,
  redis: RedisClient | null = getRealtimeRedisClient(),
) {
  const client = requireRedis(redis);
  const formattedTopic = formatObservedTopic(topic);
  const stateKey = getTopicStateKey(formattedTopic);
  const now = Date.now();
  const subscriberCount = await client.hincrby(
    stateKey,
    "subscriber_count",
    -1,
  );
  const normalizedCount = Math.max(0, subscriberCount);

  await client.hset(stateKey, {
    last_seen_at: new Date(now).toISOString(),
    subscriber_count: String(normalizedCount),
    zero_since_at: normalizedCount === 0 ? new Date(now).toISOString() : "",
  });
  await client.zadd(ACTIVE_TOPICS_LAST_SEEN_KEY, {
    member: formattedTopic,
    score: now,
  });

  return normalizedCount;
}

export async function getActiveObservedTopics(
  redis: RedisClient | null = getRealtimeRedisClient(),
) {
  if (!redis) {
    return [];
  }

  const topics = await redis.smembers<string[]>(ACTIVE_TOPICS_KEY);

  const parsedTopics = topics
    .map((topic) => ({ formatted: topic, parsed: parseObservedTopic(topic) }))
    .filter((topic): topic is { formatted: string; parsed: ObservedTopic } =>
      Boolean(topic.parsed),
    );
  const activeTopics: ObservedTopic[] = [];

  for (const topic of parsedTopics) {
    if (topic.parsed.type !== "stop") {
      activeTopics.push(topic.parsed);
      continue;
    }

    const state = await redis.hgetall<Record<string, string>>(
      getTopicStateKey(topic.formatted),
    );

    activeTopics.push({
      ...topic.parsed,
      stopCode: getStoredStopCode(state, topic.parsed.stopCode),
    });
  }

  return activeTopics;
}

export async function getCachedTopicPayload(
  topic: ObservedTopic,
  redis: RedisClient | null = getRealtimeRedisClient(),
) {
  if (!redis) {
    return null;
  }

  const cacheKey = getDerivedCacheKey(topic);

  return cacheKey ? await redis.get<RealtimeTopicPayload>(cacheKey) : null;
}

export async function setCachedTopicPayload({
  payload,
  redis = getRealtimeRedisClient(),
  topic,
  ttlSeconds = DERIVED_CACHE_TTL_SECONDS,
}: {
  payload: unknown;
  redis?: RedisClient | null;
  topic: ObservedTopic;
  ttlSeconds?: number;
}) {
  if (!redis) {
    return null;
  }

  const cacheKey = getDerivedCacheKey(topic);

  if (!cacheKey) {
    return null;
  }

  const topicPayload: RealtimeTopicPayload = {
    payload,
    topic: formatObservedTopic(topic),
    updatedAt: new Date().toISOString(),
  };

  await redis.set(cacheKey, topicPayload, { ex: ttlSeconds });

  return { cacheKey, topicPayload };
}

export async function publishTopicUpdate({
  cacheKey,
  payload,
  redis = getRealtimeRedisClient(),
  topic,
}: {
  cacheKey: string;
  payload: RealtimeTopicPayload;
  redis?: RedisClient | null;
  topic: ObservedTopic;
}) {
  if (!redis) {
    return;
  }

  const update: RealtimeTopicUpdate = {
    cacheKey,
    id: randomUUID(),
    payload,
    publishedAt: new Date().toISOString(),
    topic: formatObservedTopic(topic),
  };

  await redis.publish(TOPIC_UPDATE_CHANNEL, update);
}

export async function cacheAndPublishTopicPayload({
  payload,
  redis = getRealtimeRedisClient(),
  topic,
  ttlSeconds,
}: {
  payload: unknown;
  redis?: RedisClient | null;
  topic: ObservedTopic;
  ttlSeconds?: number;
}) {
  const cached = await setCachedTopicPayload({
    payload,
    redis,
    topic,
    ttlSeconds,
  });

  if (!cached) {
    return null;
  }

  await publishTopicUpdate({
    cacheKey: cached.cacheKey,
    payload: cached.topicPayload,
    redis,
    topic,
  });

  return cached;
}

export async function cleanupInactiveObservedTopics({
  gracePeriodMs = TOPIC_GRACE_PERIOD_MS,
  redis = getRealtimeRedisClient(),
}: {
  gracePeriodMs?: number;
  redis?: RedisClient | null;
} = {}) {
  if (!redis) {
    return { removed: 0, scanned: 0 };
  }

  const now = Date.now();
  const topics = await redis.smembers<string[]>(ACTIVE_TOPICS_KEY);
  let removed = 0;

  for (const topic of topics) {
    const state = await redis.hgetall<Record<string, string>>(
      getTopicStateKey(topic),
    );
    const subscriberCount = Number(state?.subscriber_count ?? 0);
    const zeroSinceAt = state?.zero_since_at
      ? Date.parse(state.zero_since_at)
      : null;

    if (
      subscriberCount > 0 ||
      !zeroSinceAt ||
      now - zeroSinceAt < gracePeriodMs
    ) {
      continue;
    }

    const cacheKey = getDerivedCacheKey(topic);

    await redis.srem(ACTIVE_TOPICS_KEY, topic);
    await redis.zrem(ACTIVE_TOPICS_LAST_SEEN_KEY, topic);
    await redis.del(getTopicStateKey(topic));

    if (cacheKey) {
      await redis.del(cacheKey);
    }

    removed += 1;
  }

  return { removed, scanned: topics.length };
}

function emitTopicUpdate(update: RealtimeTopicUpdate) {
  topicEvents.emit(update.topic, update.payload);
}

function getTopicPayloadFingerprint(payload: RealtimeTopicPayload) {
  return `${payload.topic}:${payload.updatedAt}`;
}

function startCachedTopicPayloadPoll(
  topic: ObservedTopic,
  signal: AbortSignal,
) {
  const formattedTopic = formatObservedTopic(topic);
  let isPolling = false;
  const interval = setInterval(() => {
    if (isPolling || signal.aborted) {
      return;
    }

    isPolling = true;
    void getCachedTopicPayload(topic)
      .then((payload) => {
        if (payload && !signal.aborted) {
          topicEvents.emit(formattedTopic, payload);
        }
      })
      .catch((error: unknown) => {
        console.warn(`Failed to poll realtime topic ${formattedTopic}`, error);
      })
      .finally(() => {
        isPolling = false;
      });
  }, TOPIC_CACHE_POLL_INTERVAL_MS);

  signal.addEventListener(
    "abort",
    () => {
      clearInterval(interval);
    },
    { once: true },
  );

  return interval;
}

export function startRealtimeTopicUpdateSubscriber(
  redis: RedisClient | null = getRealtimeRedisClient(),
) {
  if (!redis || updateSubscriberStarted) {
    return;
  }

  updateSubscriberStarted = true;
  const subscriber = redis.subscribe(TOPIC_UPDATE_CHANNEL);

  subscriber.on("message", (event) => {
    const update = event.message as RealtimeTopicUpdate;

    if (update.topic) {
      emitTopicUpdate(update);
    }
  });

  subscriber.on("error", (error) => {
    console.warn("Redis realtime topic subscriber failed", error);
  });
}

export async function* observeTopic(topic: ObservedTopic, signal: AbortSignal) {
  const formattedTopic = formatObservedTopic(topic);
  let lastPayloadFingerprint: string | null = null;
  await registerObservedTopic(topic);
  startRealtimeTopicUpdateSubscriber();

  const cachedPayload = await getCachedTopicPayload(topic);

  if (cachedPayload) {
    lastPayloadFingerprint = getTopicPayloadFingerprint(cachedPayload);
    yield cachedPayload;
  }

  const pollInterval = startCachedTopicPayloadPoll(topic, signal);

  try {
    for await (const [payload] of on(topicEvents, formattedTopic, { signal })) {
      const topicPayload = payload as RealtimeTopicPayload;
      const payloadFingerprint = getTopicPayloadFingerprint(topicPayload);

      if (payloadFingerprint === lastPayloadFingerprint) {
        continue;
      }

      lastPayloadFingerprint = payloadFingerprint;
      yield topicPayload;
    }
  } finally {
    clearInterval(pollInterval);
    await unregisterObservedTopic(topic);
  }
}
