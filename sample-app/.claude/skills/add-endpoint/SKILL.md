---
name: add-endpoint
description: Use when adding a new HTTP endpoint or resource to this API — creates the route, repository functions, and tests following the project's layering, money, and error conventions.
---

# Adding an endpoint

Follow this order. Each step depends on the one before it.

## 1. Repository first

Add the storage functions to `src/db/expenseRepository.ts` (or a new `src/db/<resource>Repository.ts`
for a new resource). Routes must never query storage directly, so the data access has to exist before
the route does.

- Exported functions take and return domain types, not HTTP shapes
- Money fields are named `<thing>Cents` and typed `Cents`
- Add a `_reset()` helper for any new module-level store

## 2. Route

Add the handler in `src/routes/`. Keep it **synchronous** — see CLAUDE.md on why async breaks error
handling here.

Every handler does these four things in order:

1. **Validate** each input explicitly. Throw `ApiError.badRequest(...)` with a message naming the
   field. Never trust `req.body` shape.
2. **Convert** money with `parseAmount()` inside a `try`, rethrowing as `badRequest` on failure.
3. **Call the repository.**
4. **Serialize** through a local `present()` function. Amounts go out as `formatAmount()` strings.

Never write an error response in a handler. Throw `ApiError` and let the middleware do it.

## 3. Wire it up

Register the router in `src/app.ts` **above** the 404 handler. Order matters — the 404 handler
matches everything.

Do not add anything to `src/index.ts`. It is bootstrap only, and `app.ts` must stay side-effect-free
on import or the test process will hang on an open socket.

## 4. Tests

Colocate `<name>.test.ts` next to the code. Use `node:test` (`describe`/`it`) and
`node:assert/strict`. Do not add a test framework.

Cover at minimum:

- The happy path
- Each validation failure, asserting the `error.code`
- A money edge case — one decimal place, negative, or a value that would drift as a float
- `beforeEach(() => repo._reset())` if the test touches storage

## 5. Verify

Run `/check`. Do not report the work as done until typecheck, lint, and tests all pass.

## Checklist before finishing

- [ ] No float arithmetic on money anywhere
- [ ] Amounts cross the wire as strings
- [ ] No storage access outside the repository module
- [ ] No `res.status(4xx)` inside a handler
- [ ] Handler is synchronous
- [ ] Imports use explicit `.ts` extensions
- [ ] New `ErrorCode` values added to both the union and `STATUS_BY_CODE`
- [ ] `npm run typecheck && npm run lint && npm test` all pass
