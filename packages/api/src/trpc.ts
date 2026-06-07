import { createHash } from "node:crypto";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import {
  createRedisClientFromEnv,
  isRedisConfiguredFromEnv,
} from "@prossimo-app/redis";

import type { Context } from "./context.js";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

type RateLimitPolicyName = keyof typeof rateLimitPolicies;
interface RateLimitPolicy {
  readonly algorithm: "fixedWindow" | "slidingWindow";
  readonly limit: number;
  readonly prefix: string;
  readonly timeoutMs?: number;
  readonly window: `${number} ${"ms" | "s" | "m" | "h" | "d"}`;
}

interface RateLimitResult {
  limit: number;
  remaining: number;
  reset: number;
  success: boolean;
}

const rateLimitPolicies = {
  alerts: {
    algorithm: "slidingWindow",
    limit: 120,
    prefix: "alerts",
    timeoutMs: 1_000,
    window: "1 m",
  },
  appBootstrap: {
    algorithm: "slidingWindow",
    limit: 60,
    prefix: "app-bootstrap",
    timeoutMs: 1_000,
    window: "1 m",
  },
  healthCheck: {
    algorithm: "fixedWindow",
    limit: 120,
    prefix: "health-check",
    timeoutMs: 500,
    window: "1 m",
  },
  healthEcho: {
    algorithm: "slidingWindow",
    limit: 30,
    prefix: "health-echo",
    timeoutMs: 500,
    window: "1 m",
  },
  nearbyStops: {
    algorithm: "slidingWindow",
    limit: 120,
    prefix: "nearby-stops",
    timeoutMs: 1_000,
    window: "1 m",
  },
  news: {
    algorithm: "slidingWindow",
    limit: 120,
    prefix: "news",
    timeoutMs: 1_000,
    window: "1 m",
  },
  plannedUpcomingTrips: {
    algorithm: "slidingWindow",
    limit: 120,
    prefix: "planned-upcoming-trips",
    timeoutMs: 1_000,
    window: "1 m",
  },
  routeShapes: {
    algorithm: "slidingWindow",
    limit: 120,
    prefix: "route-shapes",
    timeoutMs: 1_000,
    window: "1 m",
  },
  routes: {
    algorithm: "slidingWindow",
    limit: 120,
    prefix: "routes",
    timeoutMs: 1_000,
    window: "1 m",
  },
  stops: {
    algorithm: "slidingWindow",
    limit: 20,
    prefix: "stops",
    timeoutMs: 2_000,
    window: "1 m",
  },
  scheduledJobCreateRun: {
    algorithm: "slidingWindow",
    limit: 30,
    prefix: "scheduled-job-create-run",
    timeoutMs: 1_000,
    window: "1 m",
  },
  scheduledJobFinishRun: {
    algorithm: "slidingWindow",
    limit: 120,
    prefix: "scheduled-job-finish-run",
    timeoutMs: 1_000,
    window: "1 m",
  },
  scheduledJobRecordSkippedRun: {
    algorithm: "slidingWindow",
    limit: 60,
    prefix: "scheduled-job-record-skipped-run",
    timeoutMs: 1_000,
    window: "1 m",
  },
} satisfies Record<string, RateLimitPolicy>;

const redis = isRedisConfiguredFromEnv() ? createRedisClientFromEnv() : null;

const fixedWindowScript = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return { current, ttl }
`;

const slidingWindowScript = `
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call("ZREMRANGEBYSCORE", KEYS[1], 0, now - window)
local current = redis.call("ZCARD", KEYS[1])
if current < limit then
  redis.call("ZADD", KEYS[1], now, ARGV[4])
  current = current + 1
end
redis.call("PEXPIRE", KEYS[1], window)
return { current, window }
`;

function hashIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getWindowMs(window: RateLimitPolicy["window"]) {
  const [value, unit] = window.split(" ") as [
    string,
    "ms" | "s" | "m" | "h" | "d",
  ];
  const amount = Number(value);

  switch (unit) {
    case "ms":
      return amount;
    case "s":
      return amount * 1_000;
    case "m":
      return amount * 60_000;
    case "h":
      return amount * 60 * 60_000;
    case "d":
      return amount * 24 * 60 * 60_000;
  }
}

function getRateLimitIdentifier(ctx: Context) {
  if (ctx.authToken) {
    return `auth:${hashIdentifier(ctx.authToken)}`;
  }

  if (ctx.clientIp) {
    return `ip:${ctx.clientIp}`;
  }

  return "anonymous";
}

function getRateLimitKey(policy: RateLimitPolicy, identifier: string) {
  return `@prossimo-app/api/ratelimit/${policy.prefix}:${identifier}`;
}

function getRateLimitScriptResult(value: unknown) {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error("Unexpected Redis rate limit response");
  }

  return [Number(value[0]), Number(value[1])] as const;
}

async function getRateLimitResult(
  policy: RateLimitPolicy,
  identifier: string,
): Promise<RateLimitResult> {
  if (!redis) {
    return {
      limit: policy.limit,
      remaining: policy.limit,
      reset: Date.now(),
      success: true,
    };
  }

  const now = Date.now();
  const windowMs = getWindowMs(policy.window);
  const key = getRateLimitKey(policy, identifier);
  const script =
    policy.algorithm === "fixedWindow"
      ? fixedWindowScript
      : slidingWindowScript;
  const member = `${now}:${Math.random().toString(36).slice(2)}`;
  const args =
    policy.algorithm === "fixedWindow"
      ? [String(windowMs)]
      : [String(now), String(windowMs), String(policy.limit), member];
  const [current, ttlMs] = getRateLimitScriptResult(
    await redis.eval(script, [key], args),
  );
  const remaining = Math.max(0, policy.limit - current);

  return {
    limit: policy.limit,
    remaining,
    reset: now + Math.max(0, ttlMs),
    success: current <= policy.limit,
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs?: number) {
  if (!timeoutMs) {
    return await promise;
  }

  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error("Redis rate limit timed out"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function rateLimitMiddleware(policyName: RateLimitPolicyName) {
  return t.middleware(async ({ ctx, next }) => {
    const policy = rateLimitPolicies[policyName];

    if (!redis) {
      return next();
    }

    const result = await withTimeout(
      getRateLimitResult(policy, getRateLimitIdentifier(ctx)),
      policy.timeoutMs,
    ).catch((error: unknown) => {
      console.warn("Redis rate limit check failed", error);

      return {
        limit: policy.limit,
        remaining: policy.limit,
        reset: Date.now(),
        success: true,
      } satisfies RateLimitResult;
    });

    if (!result.success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Rate limit exceeded",
        cause: {
          limit: result.limit,
          remaining: result.remaining,
          reset: result.reset,
        },
      });
    }

    return next();
  });
}

export const createCallerFactory = t.createCallerFactory;
export const router = t.router;
export const publicProcedure = t.procedure;
export const rateLimitedProcedure = (policyName: RateLimitPolicyName) =>
  publicProcedure.use(rateLimitMiddleware(policyName));

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.authToken) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      ...ctx,
      authToken: ctx.authToken,
    },
  });
});
export const protectedRateLimitedProcedure = (
  policyName: RateLimitPolicyName,
) => protectedProcedure.use(rateLimitMiddleware(policyName));
