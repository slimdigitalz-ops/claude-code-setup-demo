# Example: a setup written for a real production codebase

The files in this folder are a Claude Code setup I wrote for
**[cloudflare/capnweb](https://github.com/cloudflare/capnweb)** — an object-capability RPC library
with ~3.9k stars, 16 source files, ~5,700 lines of TypeScript, shipping to five runtimes.

> **Unofficial.** This is my own work, produced as a demonstration. It is not affiliated with or
> endorsed by Cloudflare, and it has not been submitted to the project. Only the configuration I
> authored is included here — none of capnweb's source code is redistributed. capnweb is MIT
> licensed; see [their repository](https://github.com/cloudflare/capnweb).

**Time from clone to verified deliverable: 19 minutes.**

---

## Why this one is worth reading

The [sample app](../../sample-app/) in this repo shows the *shape* of a delivery. This shows what
happens against a codebase I didn't write and had never seen.

Every finding below is in the [CLAUDE.md](CLAUDE.md). **None of them were visible from reading the
source** — they only appeared by building and running the project:

### 1. `npm test` fails unless you build first

Two independent causes: `packages/capnweb-validate` imports `capnweb`, which resolves to
`./dist/index.js`; and the `workerd` test project loads `./dist/index-workers.js` as a module.

The error it produces is *"Failed to resolve entry for package 'capnweb'. The package may have
incorrect main/module/exports specified in its package.json"* — which sends you looking in exactly
the wrong file.

### 2. One test file runs in four different runtimes

`__tests__/index.test.ts` is included by the `node`, `workerd`, `browsers-with-using` and
`browsers-without-using` projects. Adding a Node-specific API there passes locally and breaks three
environments silently. This is the easiest mistake to make in the repo and nothing in it says so.

### 3. Imports end in `.js` for `.ts` files

34 imports across `src/`. Zero exceptions. Get it wrong and nothing resolves.

### 4. The `<any>` casts in `index.ts` are load-bearing

`RpcStub` and `RpcPromise` are `Proxy` objects that pretend every property exists. The casts attach
hand-written public types to them. They look exactly like something an agent should tidy up. Tidying
them breaks the public type surface.

### 5. Six tests already fail on Windows

Baseline on a non-admin Windows machine is 366 passing, 6 failing — symlink tests, because Windows
needs admin or Developer Mode to create symlinks. **Recorded as a baseline so nobody wastes an hour
chasing a bug they didn't cause.**

---

## What's in here

| File | |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Commands, architecture, the five findings above, and what to ask before doing |
| [.claude/settings.json](.claude/settings.json) | Permissions scoped to this repo; `protocol.md` and `package-lock.json` denied; typecheck hook on edit |
| [.claude/commands/check.md](.claude/commands/check.md) | `/check` — build, node tests, type tests, **reported as a delta against the known baseline** |
| [.claude/commands/review.md](.claude/commands/review.md) | `/review` — untrusted-input and wire-compatibility review, not generic advice |
| [.claude/commands/runtimes.md](.claude/commands/runtimes.md) | `/runtimes` — a change's safety across all five target runtimes |

The repo already had an agent config for a different tool (`.opencode/agents/bonk.md`). I read it —
the maintainers' own stated conventions are the best input available — and then wrote what it
doesn't cover: the traps only visible from running the code, plus the things a prompt file
structurally can't do. Permissions. Hooks. Commands. Skills that load themselves.

That distinction is the whole job.
