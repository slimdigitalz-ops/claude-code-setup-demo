---
description: Review uncommitted changes against this project's conventions
---

Review the current diff (`git diff` plus any untracked files under `src/`) against the rules in
CLAUDE.md. Check specifically:

- **Money:** any float arithmetic on currency? Any amount crossing the wire as a number instead of a
  string? Any `parseFloat` on user input?
- **Layering:** does anything outside `db/expenseRepository.ts` touch the store directly?
- **Errors:** does any route write an error response itself instead of throwing `ApiError`? Was a new
  `ErrorCode` added to the union without a matching entry in `STATUS_BY_CODE`?
- **Async handlers:** was a route handler made `async` without wrapping? That silently breaks error
  handling.
- **Imports:** are new imports using explicit `.ts` extensions?
- **Tests:** does anything touching storage call `repo._reset()` in `beforeEach`?

Report only real problems, most serious first. For each: the file and line, what breaks, and the
concrete input or sequence that would trigger it.

If the diff is clean, say so in one line. Do not invent findings to fill space.
