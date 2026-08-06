---
description: Check whether a change is safe across all five supported runtimes
---

capnweb ships to **browsers, Cloudflare Workers (workerd), Node.js, Bun, and Deno.** This is the
single most common source of breakage, because a change can pass locally and fail in three
environments you didn't run.

Given the current diff (or a change I describe), work through this:

## 1. Where does the code live?

- Shared module (`core.ts`, `rpc.ts`, `serialize.ts`, `streams.ts`, `map.ts`) → **must work
  everywhere.** No Node builtins, no `process`, no Workers-only globals.
- Per-runtime entry point (`index.ts`, `index-workers.ts`, `index-bun.ts`, `bun.ts`) → runtime
  specifics belong here.

If runtime-specific code has landed in a shared module, say so and propose where it should move.

## 2. API availability

For each API the change introduces, state whether it exists in all five runtimes. Flag anything
that doesn't, and name the fallback. Pay particular attention to:

- Node builtins (`node:*`) — unavailable in browsers and workerd
- `WebSocket`, `MessagePort`, `Request`/`Response` — availability and shape differ
- `Symbol.dispose` / `using` — native in some, transpiled in others (`esbuild.target` is `es2022`)
- Timers, streams, and `structuredClone` — subtly different across runtimes

## 3. Test coverage

Which vitest projects actually exercise this change?

| Project | Covers |
|---|---|
| `node` | index, flow-control, limits, capnweb-validate |
| `workerd` | index, workerd |
| `browsers-with-using` | index — native `using` |
| `browsers-without-using` | index — transpiled `using`, plus firefox and webkit |

If the change is only covered by `node`, say so — that's a gap, and `__tests__/index.test.ts` is
usually where the cross-runtime coverage should go.

## 4. Verdict

One of: **safe across all runtimes** / **needs a guard or fallback** (say where) / **needs to move
to an entry point** (say which). Then give the exact command to prove it.
