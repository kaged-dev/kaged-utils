<div align="center">

<img src="https://kaged.dev/hero.svg" alt="kaged" width="100%" />

# 影 @kaged/utils

**shadow ops for your `[foundation]`**

The shared utility belt of [kaged](https://kaged.dev) — fs guards, type guards, formatting, async/stream helpers, Snowflake IDs, fetch-retry, a rotating logger, XDG dirs, and more. Zero dependencies, Bun-first.

[![npm](https://img.shields.io/npm/v/@kaged/utils?color=FFB000&label=npm&labelColor=0A0A0B)](https://www.npmjs.com/package/@kaged/utils)
[![license](https://img.shields.io/badge/license-AGPL--3.0-FF2E63?labelColor=0A0A0B)](#license)
[![runtime](https://img.shields.io/badge/runtime-bun-00E0FF?labelColor=0A0A0B)](https://bun.com)

</div>

---

## what it is

The foundation package every kaged service and plugin leans on. No frameworks, no transitive dependency tree — just typed, tested primitives shipped as TypeScript source (`main: src/index.ts`), ready for Bun to run directly.

```
> 影 @kaged/utils
> guards ............ fs error codes, runtime type guards
> async ............. timeouts, aborts, retries, streams
> id ................ snowflake generation + validation
> logger ............ structured JSONL, daily rotation
> dirs .............. XDG-aware kaged directories
> system nominal.
```

## install

```bash
bun add @kaged/utils
```

## what's in the box

| Module | What you get |
|---|---|
| `abortable` | `AbortError`, abort-aware stream/operation wrappers |
| `async` | promise timeouts with abort signals, listener-safe cleanup |
| `dirs` | XDG-aware kaged directories (`getDataDir`, `getStateDir`, …) |
| `env` | env var name validation and safety checks |
| `fetch-retry` | `fetch` with retry, backoff, and `Retry-After` hint extraction |
| `format` | human-readable durations (`"1.5s"`, `"2h30m"`, `"3d2h"`) and friends |
| `frontmatter` | YAML frontmatter build/parse round-trip |
| `fs-error` | typed fs error guards — `isEnoent(err)` instead of message matching |
| `glob` | gitignore-style path globbing helpers |
| `id` | Snowflake IDs — `snowflake()`, `isValidSnowflake()` |
| `json` | `tryParseJson<T>()` and safe JSON helpers |
| `logger` | structured rotating file logger — JSONL, daily rotation, Bun-native I/O |
| `mime` | mime type tables and image type guards |
| `peek-file` | sniff a file's head without reading the whole thing |
| `postmortem` | process cleanup registration + postmortem reasons |
| `ring` | `RingBuffer<T>` |
| `sanitize-text` | control-character and text sanitization |
| `stream` | line readers, SSE parsing, JSONL parsing |
| `temp` | `TempDir` — self-cleaning temp directories |
| `type-guards` | `isRecord`, `asRecord`, and friends |
| `which` | resolve executables on `PATH` |

Everything is exported from the root barrel:

```ts
import { snowflake, isEnoent, fetchWithRetry } from "@kaged/utils";
```

## development

```bash
bun install
bun test            # 340 tests
bun run typecheck
bun run format      # biome
```

## release

Bump `version` in `package.json`, tag `v<version>`, push the tag. CI verifies the tag matches, runs the suite, and publishes to npm with provenance.

---

## license

AGPL-3.0 © the kaged project

<div align="center">

`[kaged]` · [kaged.dev](https://kaged.dev) · *sanctioned edge, sacred code*

</div>
