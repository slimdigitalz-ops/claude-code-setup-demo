# ledger-api

Small expense-tracking REST API. Node + TypeScript + Express, ESM throughout.

## Commands

| Task | Command |
|---|---|
| Run tests | `npm test` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Dev server | `npm run dev` (port 3000, override with `PORT`) |

**Run `npm run typecheck && npm test` before telling me a change is done.** Both are fast.

## Architecture

```
src/
  index.ts                 app wiring, 404 handler, error middleware
  routes/expenses.ts       HTTP layer — validation, serialization
  db/expenseRepository.ts  the only module that touches storage
  lib/money.ts             currency handling
  lib/errors.ts            ApiError + the wire error shape
```

Data flows one direction: **route → repository → store.** Never the reverse, never a shortcut.

## Conventions that matter

These are the rules this codebase actually breaks when someone is careless. Follow them exactly.

### Money is integer cents. Always.

`amountCents: number` everywhere internally. **Never** a float, never a `Number` parsed from user
input directly. Use `parseAmount()` at the boundary in and `formatAmount()` at the boundary out.

Over the wire, amounts are **strings** (`"12.30"`), not numbers. This is deliberate — it stops
JSON parsers on the client from turning money into floats.

```ts
// wrong
const amount = parseFloat(req.body.amount);
const total = expenses.reduce((t, e) => t + e.amount, 0);

// right
const amountCents = parseAmount(req.body.amount);
const total = sum(expenses.map((e) => e.amountCents));
```

### Only `expenseRepository.ts` touches storage

Routes call repository functions. They never reach into the store, and they never build queries.
The point is that swapping the in-memory Map for Postgres touches exactly one file.

If a route needs data shaped differently, **add a repository function** — do not query around it.

### Errors: throw `ApiError`, never write an error response

Route handlers `throw ApiError.badRequest(...)` / `ApiError.notFound(...)`. The error middleware in
`src/index.ts` is the **only** place that writes an error body. Do not add `res.status(400).json(...)`
inside a route.

Every client-facing error is `{ error: { code, message } }`. Codes come from the `ErrorCode` union —
if a new one is genuinely needed, add it to the union *and* to `STATUS_BY_CODE` together.

### Handlers stay synchronous

Express 4 catches synchronous throws and forwards them to error middleware. It does **not** catch
rejections from async handlers. Every handler here is sync, which is why `throw` works.

**If you make a handler `async`, you must wrap it** — an unwrapped async throw becomes an unhandled
rejection and the client hangs. Ask before introducing async handlers; it changes this contract.

### Imports use explicit `.ts` extensions

This project is ESM with `allowImportingTsExtensions`. Imports are written `'../lib/money.ts'`, not
`'../lib/money'`. Match the existing style — extensionless imports will not resolve.

## Testing

`node:test` via `tsx`, colocated as `*.test.ts` next to the code under test. No Jest, no Vitest —
don't add a test framework.

Repository state is module-level. **Call `repo._reset()` in `beforeEach`** for any test that touches
storage, or tests will pollute each other. `_reset()` is a test helper and must never be called from
application code.

## Traps

Things that have actually gone wrong here:

- **Rounding.** `Math.round(12.345 * 100)` is not reliable. Parse from the string, don't multiply floats.
- **`formatAmount` on negatives.** The sign is applied to the whole value, not the cents portion.
  `-405` is `"-4.05"`, not `"-4.-05"`. There's a test for this; keep it passing.
- **`list()` sorts by `createdAt` string.** ISO-8601 sorts correctly as text. If the timestamp format
  ever changes, that sort silently breaks.
- **`noUncheckedIndexedAccess` is on.** Indexing an array gives `T | undefined`. Handle it; don't
  reach for `!` to silence it.

## Out of scope without asking

- Adding dependencies — the dependency list is deliberately short
- Changing the wire format of `amount` from string to number
- Introducing a database, ORM, or migration tool
- Adding auth (it's intentionally absent; this is a sample)
