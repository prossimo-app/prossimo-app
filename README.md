![Prossimo product banner](./.github/banner.png)

# Prossimo

Prossimo is a live transportation tracking app for Turin.

It is built for people who want a faster, clearer way to see what is coming next across the city. The goal is simple: make Turin public transport easier to follow in real time, without the friction of the current options.

I started Prossimo because I was not happy with the existing tools. This project is my attempt to build the transit experience I actually want to use every day.

## Always open source

Prossimo is open source because better local transport tools should be easier to inspect, improve, and adapt. Contributions are welcome.

The project is licensed under MIT. If you want to contribute, start with [CONTRIBUTING.md](./CONTRIBUTING.md), open an issue, or send a focused pull request.

## Project structure

```text
apps/       Product apps and services
packages/   Shared API, database, GTFS, Redis, and localization packages
tooling/    Shared linting, formatting, TypeScript, and Tailwind configuration
```

## Development

```bash
pnpm install
cp .env.example .env
pnpm db:dev:start
pnpm redis:dev:start
pnpm dev
```

Useful commands:

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm format
```

## Coolify deployments

The worker and WebSocket server can be deployed as separate Coolify applications
from this monorepo with the Nixpacks build pack.

Use the repository root as the Coolify base directory for both applications so
pnpm workspace dependencies are available during the build.

Worker application:

```text
Build Pack: Nixpacks
Base Directory: /
NIXPACKS_CONFIG_FILE: nixpacks.worker.toml
Port: leave unset or use any internal-only value if Coolify requires one
```

WebSocket application:

```text
Build Pack: Nixpacks
Base Directory: /
NIXPACKS_CONFIG_FILE: nixpacks.ws.toml
Port: 1337
```

Configure runtime variables in Coolify for the services that need them, including
`DATABASE_URL`, `REDIS_URL`, and `WORKER_API_TOKEN`.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

## Donate

If Prossimo is useful to you, you can support the project through GitHub Sponsors:

[Sponsor EgeOnder](https://github.com/sponsors/EgeOnder)

## License

See [LICENSE](./LICENSE).
