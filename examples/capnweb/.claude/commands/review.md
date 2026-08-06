---
description: Review uncommitted changes against capnweb's conventions and security model
---

Review the current diff (`git diff` plus untracked files under `src/`, `__tests__/`, `packages/`)
against this repo's rules. Check in this order — the first three are the ones that actually break
things here.

## Blocking

- **Untrusted input.** Does anything in `serialize.ts` (or reachable from deserialization) trust a
  peer-supplied value? Check type validation, recursion depth guards, prototype pollution, and
  whether any capability is exposed that wasn't explicitly granted.
- **Wire compatibility.** Would this change break an existing peer? If the wire format changed, was
  `protocol.md` updated in the same change? If not, that's blocking.
- **Cross-runtime.** Did runtime-specific code land in a shared module instead of an entry point?
  Anything added to `__tests__/index.test.ts` runs in **all four** vitest projects — Node, workerd,
  and two browser modes. A Node-only API there breaks three of them.
- **Disposal.** Are stubs and sessions disposed on error paths, not just happy paths? Remember
  `using` is tested both natively and transpiled.

## Conventions

- Imports ending `.ts` instead of `.js` — will not resolve
- New file missing the Cloudflare copyright header
- An `<any>` cast removed from `index.ts` — those are load-bearing for the Proxy-based public types
- An eager `await` added on an `RpcPromise` that was only being used for pipelining — that's a
  performance regression, not a cleanup
- A production dependency added — this package is deliberately zero-dependency
- User-facing change to a published package with no changeset in `.changeset/`

## Output

Most serious first. For each: the file and line, what breaks, and the concrete input or sequence
that triggers it. Separate **blocking** from **non-blocking** from **pre-existing / out of scope**.

If the diff is clean, say so in one line. Do not invent findings to fill space.
