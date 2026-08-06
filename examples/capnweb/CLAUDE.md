# capnweb (Cap'n Web)

Object-capability RPC for JavaScript/TypeScript with promise pipelining. Zero production
dependencies. Runs in **browsers, Cloudflare Workers (workerd), Node.js, Bun, and Deno.**

## Commands

| Task | Command |
|---|---|
| Build | `npm run build` |
| Test (all runtimes) | `npm test` |
| Test (Node only, fast) | `npx vitest run --project=node` |
| Type tests | `npm run test:types` |
| Bun tests | `npm run test:bun` |
| CI parity | `npm run test:ci && npm run test:types` |

**Always `npm`.** This repo uses `package-lock.json` and npm workspaces. Never pnpm or yarn.

### Build before you test — this is not optional

`npm test` fails without a prior `npm run build`, for two independent reasons:

1. `packages/capnweb-validate` imports `capnweb`, which resolves to `./dist/index.js`.
2. The `workerd` vitest project loads `./dist/index-workers.js` directly as a module.

Symptom if you skip it: *"Failed to resolve entry for package 'capnweb'."* That is a missing build,
not a broken package.json.

### First test run needs browsers

`npm test` includes three browser projects. Run **`npx playwright install`** once — all of chromium,
firefox and webkit, not just chromium. Without it the run dies on
*"browserType.launch: Executable doesn't exist."*

## Architecture

```
src/
  core.ts        79 KB  RPC session core — the import/export table, refcounting
  serialize.ts   53 KB  wire serialization — HANDLES UNTRUSTED INPUT
  rpc.ts         42 KB  stubs, RpcTarget, promise pipelining
  streams.ts     19 KB  stream support
  map.ts         12 KB  RPC-aware Map
  types.d.ts     11 KB  the public type surface
  index.ts        8 KB  Node/browser entry point
  batch.ts        7 KB  HTTP batch transport
  websocket.ts    5 KB  WebSocket transport
  bun.ts / index-bun.ts / index-workers.ts   per-runtime entry points
protocol.md             the wire protocol specification
```

Read `protocol.md` before touching `serialize.ts`.

## Conventions that matter

### Imports end in `.js`, even though the files are `.ts`

34 imports in `src/` use `.js`. Zero use `.ts`. This is ESM/NodeNext resolution — the extension
refers to the *emitted* file.

```ts
import { RpcStub } from "./core.js";   // correct, even though it's core.ts
import { RpcStub } from "./core.ts";   // wrong — will not resolve
```

### Every source file starts with the copyright header

16 of 16 files in `src/` have it. New files need it too:

```ts
// Copyright (c) 2025 Cloudflare, Inc.
// Licensed under the MIT license found in the LICENSE.txt file or at:
//     https://opensource.org/license/mit
```

### The `<any>` casts in `index.ts` are deliberate — do not "clean them up"

`RpcStub` and `RpcPromise` are `Proxy` objects that pretend every possible property exists. The
public types are hand-written to describe that behavior, and the implementations are cast through
`<any>` to attach them. This is load-bearing. Removing a cast breaks the public type surface.

### `RpcPromise` is lazy

It is not a real `Promise`. It has `then()`/`catch()`/`finally()`, so `await` works — but the
resolution is **not requested from the peer until you actually await it.** That laziness is an
optimization for pipelining, not an accident. Adding an eager `await` in a hot path is a
performance regression, not a cleanup.

### Everything off the wire is untrusted

`serialize.ts` parses peer-supplied data. Validate types, guard recursion depth, avoid prototype
pollution, and never leak a capability that wasn't explicitly granted. Treat every deserialization
change as a security change.

### Wire compatibility

Serialization changes must stay compatible with existing peers. An intentional protocol change must
update `protocol.md` **in the same PR**.

### Cross-runtime code

Shared modules must work in browsers, workerd, Node, Bun and Deno. Runtime-specific code belongs in
the per-runtime entry points (`index.ts`, `index-workers.ts`, `index-bun.ts`), never in shared
modules. `esbuild.target` is `es2022`.

### Resource lifecycle

Stubs and sessions use explicit disposal — `Symbol.dispose` / `using`. **Dispose on error paths too.**
The test suite deliberately runs browser tests twice: once where `using` is native, once where it's
transpiled to try/catch. Both must pass.

### Changesets

User-facing changes to published packages need a changeset in `.changeset/` — `patch` for fixes,
`minor` for features.

## Testing

Four vitest projects, defined in `vitest.config.ts`:

| Project | Runs |
|---|---|
| `node` | index, flow-control, limits, capnweb-validate |
| `workerd` | index, workerd — via miniflare, needs `dist/` |
| `browsers-with-using` | index — chromium, native `using` |
| `browsers-without-using` | index — chromium, firefox, webkit, transpiled `using` |

**`__tests__/index.test.ts` runs in all four.** Anything Node-specific added there silently breaks
the other three. This is the easiest mistake to make in this repo.

## Known-failing on Windows — not your fault

Baseline on a non-admin Windows machine is **366 passing, 6 failing**, all in
`packages/capnweb-validate/__tests__/plugin.test.ts`. Five are symlink tests; creating symlinks on
Windows needs admin rights or Developer Mode.

**Capture a baseline before you change anything.** If you see exactly these 6, you didn't break
them. Verify real changes on WSL, Linux, or with Developer Mode enabled.

*(The sixth, "createTransformContext returns the documented surface," was failing at baseline too —
cause not investigated.)*

## Git

- **Never commit directly to `main`.**
- Keep history clean; scope commits logically.

## Ask before

- Adding any production dependency — the package is deliberately zero-dependency
- Changing the wire format or anything in `protocol.md`
- Weakening a validation guard in `serialize.ts`
- Moving runtime-specific code into a shared module
