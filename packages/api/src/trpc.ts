import { createHash } from "node:crypto";
import { initTRPC, TRPCError } from "@trpc/server";
import { Ratelimit } from "@upstash/ratelimit";
import superjson from "superjson";

import { createRedisClientFromEnv } from "@prossimo-app/redis";

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

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? createRedisClientFromEnv()
    : null;
const rateLimiters = new Map<RateLimitPolicyName, Ratelimit>();

function getRateLimiter(policyName: RateLimitPolicyName) {
  if (!redis) {
    return null;
  }

  const existing = rateLimiters.get(policyName);

  if (existing) {
    return existing;
  }

  const policy = rateLimitPolicies[policyName];
  const limiter =
    policy.algorithm === "fixedWindow"
      ? Ratelimit.fixedWindow(policy.limit, policy.window)
      : Ratelimit.slidingWindow(policy.limit, policy.window);
  const ratelimit = new Ratelimit({
    analytics: true,
    enableProtection: true,
    limiter,
    prefix: `@prossimo-app/api/ratelimit/${policy.prefix}`,
    redis,
    timeout: policy.timeoutMs,
  });

  rateLimiters.set(policyName, ratelimit);

  return ratelimit;
}

function hashIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex");
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

function rateLimitMiddleware(policyName: RateLimitPolicyName) {
  return t.middleware(async ({ ctx, next }) => {
    const ratelimit = getRateLimiter(policyName);

    if (!ratelimit) {
      return next();
    }

    const result = await ratelimit.limit(getRateLimitIdentifier(ctx), {
      country: ctx.country ?? undefined,
      ip: ctx.clientIp ?? undefined,
      userAgent: ctx.userAgent ?? undefined,
    });

    result.pending.catch(() => undefined);

    if (!result.success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Rate limit exceeded",
        cause: {
          limit: result.limit,
          reason: result.reason,
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
