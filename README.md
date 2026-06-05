![Prossimo product banner](./.github/banner.png)

# Prossimo

Prossimo is a live transportation tracking app for Turin.

It is built for people who want a faster, clearer way to see what is coming next across the city. The goal is simple: make Turin public transport easier to follow in real time, without the friction of the current options.

I started Prossimo because I was not happy with the existing tools. This project is my attempt to build the transit experience I actually want to use every day.

## Project Structure

```text
apps/       Product apps and services
packages/   Shared API, database, GTFS, Redis, and localization packages
tooling/    Shared linting, formatting, TypeScript, and Tailwind configuration
```

## Development

```bash
pnpm install
pnpm dev
```

Useful commands:

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm format
```

## Funding

If Prossimo is useful to you, you can support the project through GitHub Sponsors:

[Sponsor EgeOnder](https://github.com/sponsors/EgeOnder)

Funding is also configured in `.github/FUNDING.yml`, so GitHub can show the sponsor button on the repository.

## License

See [LICENSE](./LICENSE).
