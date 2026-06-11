# @kaged/utils

Shared foundation utilities for [kaged](https://github.com/kaged-dev) — fs guards, type guards, formatting, async/stream helpers, Snowflake IDs, fetch-retry, rotating logger, XDG dirs, and more.

Extracted from the kaged monorepo (`packages/utils`); symlinked back into it as a workspace member during the transition.

## Install

```sh
bun add @kaged/utils
```

## Develop

```sh
bun install
bun test
bun run typecheck
bun run format
```

## Release

Bump `version` in `package.json`, then tag and push:

```sh
git tag v0.0.x && git push origin v0.0.x
```

The release workflow verifies the tag matches the package version, runs tests, and publishes to npm with provenance.

## License

AGPL-3.0
