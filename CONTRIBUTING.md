# Contributing to Prossimo

Thanks for helping improve Prossimo. This project is a live transportation app for Turin, so useful contributions are usually practical, focused, and easy to verify.

## Development Setup

Requirements:

- Node.js `24.16.0` or compatible with the root `package.json` engines
- pnpm `10.34.1`
- Docker, if you need the local Postgres/PostGIS database or Redis

Setup:

```bash
pnpm install
cp .env.example .env
pnpm db:dev:start
pnpm redis:dev:start
pnpm dev
```

The main web app runs on port `3030` through `apps/web`. Other apps and services are managed by Turborepo from the root `pnpm dev` command.

Useful commands:

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm format
pnpm format:fix
```

Database commands:

```bash
pnpm db:dev:start
pnpm db:dev:stop
pnpm --filter @prossimo-app/db db:push
```

Redis commands:

```bash
pnpm redis:dev:start
pnpm redis:dev:stop
pnpm redis:dev:logs
```

GTFS development:

```bash
pnpm --filter @prossimo-app/worker dev:sync-gtfs-static
```

## Project Layout

```text
apps/mobile      Expo app
apps/web         Next.js landing site
apps/api         API server
apps/websocket   WebSocket server
apps/worker      Scheduled and background jobs
packages/api     Shared API router and transit logic
packages/db      Database schema and Drizzle setup
packages/gtfs    GTFS helpers
packages/redis   Redis helpers
packages/localization Shared translation resources
tooling/         Shared TypeScript, lint, format, and Tailwind config
```

## Pull request guidelines

- Keep pull requests focused on one problem or feature.
- Explain the user-facing change and the technical approach.
- Include screenshots or screen recordings for UI changes.
- Add or update tests when the change touches shared logic, data parsing, API behavior, or regressions.
- Run `pnpm lint`, `pnpm typecheck`, and any relevant app/package checks before requesting review.
- Do not commit secrets, production credentials, local database data, or generated build output.

## Issues

When opening an issue, include:

- What happened
- What you expected
- Steps to reproduce, if it is a bug
- Device, browser, OS, and app version when relevant
- Screenshots, logs, or affected stop/line examples when helpful

## Code style

Follow the existing code style in the package you are editing. This repo uses shared TypeScript, ESLint, Prettier, and Tailwind configuration from `tooling/`.

Prefer small, readable changes over broad rewrites. If a larger refactor is needed, open an issue first so the direction can be discussed.

## Conduct

Be respectful and constructive. The goal is to make Turin transit easier to use, and that works best when issues and pull requests stay specific, kind, and actionable.
