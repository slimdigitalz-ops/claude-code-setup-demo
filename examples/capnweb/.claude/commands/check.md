---
description: Build, then run the Node test project and the type tests — the fast inner loop
---

This repo's fast feedback loop. Run in this exact order — **the build is not optional**, because
`packages/capnweb-validate` and the workerd project both resolve against `dist/`.

```bash
npm run build
npx vitest run --project=node
npm run test:types
```

## Reading the result

The baseline on a non-admin Windows machine is **366 passing, 6 failing**, all in
`packages/capnweb-validate/__tests__/plugin.test.ts` (symlink tests — Windows needs admin or
Developer Mode). **Those 6 are pre-existing. Do not try to fix them and do not count them as
regressions.**

Report the delta against that baseline, not the raw number.

## If something else fails

1. Fix the root cause. Do not silence a type error with `any` or `@ts-expect-error` unless you
   explain in one line why the type is genuinely unknowable.
2. Do not delete or skip a test to make the suite green. If a test looks wrong, say so and ask.
3. If the failure is in `serialize.ts` or touches the wire format, stop and flag it — that's a
   protocol concern, not a normal bug.

Stop when the delta is zero, or when you hit the same failure twice — then explain what you tried
and what you think is actually wrong.

## Before final handoff

Full cross-runtime coverage needs browsers installed (`npx playwright install`) and is much slower:

```bash
npm run test:ci && npm run test:types
```

Only run that when the fast loop is clean.
