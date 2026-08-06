# Claude Code, set up properly — two worked examples

**This repo is proof, not a pitch.** It contains two complete setups you can read end to end before
deciding anything:

- **[`sample-app/`](sample-app/)** — a small but realistic TypeScript API (money handling, a
  repository layer, an error contract, tests). Shows the *shape* of a delivery.
- **[`examples/capnweb/`](examples/capnweb/)** — the same job done on
  [Cloudflare's capnweb](https://github.com/cloudflare/capnweb), a production library I had never
  seen. 5,700 lines, five target runtimes, **19 minutes** from clone to verified.

Read either one and you know exactly what you'd receive.

---

## What a delivery contains

| File | What it does |
|---|---|
| [`CLAUDE.md`](sample-app/CLAUDE.md) | Loaded every session — architecture, conventions, and the traps this codebase actually falls into |
| [`.claude/settings.json`](sample-app/.claude/settings.json) | Pre-approved safe commands, denied dangerous ones, typecheck hook on every edit |
| [`.claude/commands/check.md`](sample-app/.claude/commands/check.md) | `/check` — typecheck, lint, test, fix failures without gaming them |
| [`.claude/commands/review.md`](sample-app/.claude/commands/review.md) | `/review` — reviews your diff against *your* rules, not generic advice |
| [`.claude/skills/add-endpoint/`](sample-app/.claude/skills/add-endpoint/SKILL.md) | Loads itself when you add an endpoint, enforces the full checklist |
| [`SETUP-GUIDE.md`](sample-app/SETUP-GUIDE.md) | One page explaining every piece, in plain language |

---

## Before and after

**Before** — you type this, every time:

> Add a DELETE route for categories. Remember money is integer cents, don't touch the store directly
> from the route, use ApiError instead of res.status, keep the handler synchronous or error handling
> breaks, use .ts import extensions, colocate the test with node:test, and call repo._reset() in
> beforeEach.

**After** — you type this:

> Add a DELETE route for categories.

The `add-endpoint` skill loads on its own. The conventions are already known. The typecheck hook
catches mistakes the moment they're written.

---

## The part that makes it worth paying for

Anyone can generate a generic CLAUDE.md. Look at what's actually in
[this one](sample-app/CLAUDE.md):

> **`formatAmount` on negatives.** The sign is applied to the whole value, not the cents portion.
> `-405` is `"-4.05"`, not `"-4.-05"`. There's a test for this; keep it passing.

> **Express 4 catches synchronous throws and forwards them to error middleware. It does not catch
> rejections from async handlers.** If you make a handler `async`, you must wrap it — an unwrapped
> async throw becomes an unhandled rejection and the client hangs.

You only write that after reading the code. A template can't produce it, and it's the difference
between a setup that gets used and one that gets deleted in a week.

---

## A real codebase, not just this one

The sample app above shows the *shape* of a delivery. **[examples/capnweb](examples/capnweb/)** shows
what happens against a production repo I didn't write:
[cloudflare/capnweb](https://github.com/cloudflare/capnweb) — ~3.9k stars, 5,700 lines of TypeScript,
shipping to five runtimes.

Clone to verified deliverable: **19 minutes.** Five findings, none of them visible from reading the
source — including a test suite that fails unless you build first, and one test file that silently
runs in four different runtimes.

---

## Running it

```bash
cd sample-app
npm install
npm test
```

Then open the project in Claude Code and try `/check`, or ask it to add an endpoint and watch the
skill load itself.

---

## Getting this for your codebase

I do this as a fixed-price service. Your setup is built from your actual codebase — your conventions,
your commands, the specific things that trip Claude up in *your* project. Not a template. Delivered as
a pull request with a plain-language guide.

Every delivery is run through [`tools/delivery-check.mjs`](tools/delivery-check.mjs) before it's sent.
It verifies that every file path and command referenced in your CLAUDE.md actually resolves against
your repo, that the config parses, and that no placeholder text or credentials slipped in. If it
fails, it doesn't ship.

**[See the gig on Fiverr →](#)** *(link goes here once published)*

Any language, any stack. I never need your API keys or credentials.
