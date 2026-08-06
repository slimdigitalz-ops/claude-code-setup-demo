---
description: Run typecheck, lint and tests, then fix whatever fails
---

Run all three, in this order, and report the results as a short table:

```bash
npm run typecheck
npm run lint
npm test
```

If anything fails:

1. Fix the **root cause**, not the symptom. Do not silence a type error with `any`, `!`, or a
   `@ts-expect-error` unless you explain in one line why the type is genuinely unknowable.
2. Do not delete or skip a failing test to make the suite green. If a test looks wrong, say so and
   ask before changing it.
3. Re-run all three after fixing.

Stop when all three pass, or when you've hit the same failure twice — in that case explain what you
tried and what you think is actually wrong.
