# AGENTS.md

Prossimo is a live public-transport tracking app for Turin, Italy, built on GTT's GTFS data. It is a pnpm + Turborepo monorepo:

- `apps/api` — standalone tRPC HTTP server (port 3000)
- `apps/mobile` — Expo / React Native app (iOS + Android)
- `apps/web` — Next.js marketing/web app (port 3030)
- `apps/websocket` — tRPC-over-WebSocket server (port 1337)
- `apps/worker` — scheduled jobs (GTFS imports, realtime polling, notifications)
- `packages/api` — shared tRPC routers/context consumed by api, websocket, and worker
- `packages/db` — Drizzle ORM schema and client (Postgres/PostGIS, Neon in prod)
- `packages/gtfs` — GTFS static + realtime parsing
- `packages/redis` — Redis client helpers
- `packages/localization` — i18next setup and the `en`/`it` locale resources
- `tooling/` — shared ESLint, Prettier, TypeScript, and Tailwind configs

## Localization is mandatory

**Every user-facing string must be localized — both text rendered on the client and text returned from the server.** Never hardcode strings that a user will see.

- Locale resources live in `packages/localization/src/locales/en.json` and `it.json`. When you add a key, add it to **both** files, keeping the same nested structure. English is the fallback language.
- Client-side (mobile and web React components): use `useTranslation` / `Trans` from `@prossimo-app/localization`.
- Server-side in tRPC procedures and middleware: the request language is resolved automatically (`x-language` header, then `Accept-Language`) into `ctx.language`, and `ctx.t("key")` translates — use it for every user-facing error message and response string (see `serverErrors.*` keys). The translator lives in `packages/api/src/i18n.ts`.
- Web server components (Next.js) use `createTranslator(language)` from `@prossimo-app/localization/server`.
- `packages/api` must NOT import TypeScript from `@prossimo-app/localization` — production runs compiled JS (`node dist/...`) and the localization package ships raw TS. Only the locale **JSON** files may be imported there (via `with { type: "json" }`), which is how `packages/api/src/i18n.ts` works.
- Clients must send their language: the mobile tRPC client sets the `x-language` header from i18next (`apps/mobile/src/utils/api.tsx`). If you add a new client or transport, plumb the language through rather than letting the server fall back to English.
- Interpolation uses `{{placeholder}}` syntax in locale JSON; pass values as the second argument to `t()`.

## Commands

```bash
pnpm install
pnpm dev            # all apps via Turborepo
pnpm lint           # ESLint (use lint:fix to autofix)
pnpm typecheck
pnpm format         # Prettier check (format:fix to write)
pnpm build
pnpm db:dev:start   # local Postgres/PostGIS (Docker)
pnpm redis:dev:start
pnpm --filter @prossimo-app/db db:push
```

Run `pnpm lint`, `pnpm typecheck`, and `pnpm format` before considering a change done. Node `^24.16.0` and pnpm `^10.34.1` are required.

## Repo-specific gotchas

- **GTT `stop_id` vs `stop_code` namespaces overlap.** A value like `592` can be a valid `stop_id` for one stop and a valid `stop_code` for a different stop. Never OR-match a user-supplied identifier across both columns; resolve it to a single physical stop, preferring `stop_code` (the number printed on physical stop signs).
- **expo-maps marker constraints (mobile).** Custom marker labels are Android-only, and marker icons must be rasterized PNGs (via `@shopify/react-native-skia`), not SVGs. Don't assume iOS/Android map markers behave the same — check the platform-specific files (`*.android.tsx` / `*.ios.tsx`).
- **Timezone:** all transit schedules are in Europe/Rome time. Use the helpers in `packages/api/src/utils/italian-time.ts` instead of doing date math with the server's local timezone or naive `Date` arithmetic.
- **Shared API package fan-out.** `packages/api` is consumed by three runtimes (HTTP server, WebSocket server, worker). Changes to context, routers, or procedure shapes affect all of them — check each consumer before changing signatures.
- **Mobile platform splits.** The mobile app uses platform-specific component files extensively. When changing a screen or component, check whether a `.android.tsx` / `.ios.tsx` sibling exists and update both.
- **Dependency versions** are managed with the pnpm workspace catalog (`pnpm-workspace.yaml`) for shared deps; prefer `catalog:` over pinning new versions in individual packages.
- **Deployment** of api/worker/websocket is via Coolify + Nixpacks (`nixpacks.*.toml` at the root); keep build/start commands in those files in sync with package scripts.

## Conventions

- TypeScript everywhere; shared configs come from `tooling/` (`@prossimo-app/tsconfig`, ESLint, Prettier, Tailwind). Don't introduce per-package config that diverges from these.
- Workspace packages are imported as `@prossimo-app/*` with `workspace:*` versions.
- The API layer is tRPC with `zod` input validation and `superjson` — validate every new procedure's input with zod.
- Database access goes through Drizzle (`packages/db`); add schema changes to `packages/db/src/schema.ts` and push with `db:push`.
- Match the existing code style of the file you are editing; Prettier and ESLint are the source of truth.
