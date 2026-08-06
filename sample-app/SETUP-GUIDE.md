# Your Claude Code setup — what's here and how to use it

This is the guide that ships with every delivery. One page, no jargon.

## What was added

```
CLAUDE.md                        loaded automatically at the start of every session
.claude/
  settings.json                  permissions + the typecheck hook
  commands/
    check.md                     /check   — typecheck, lint, test, then fix failures
    review.md                    /review  — review your diff against project conventions
  skills/
    add-endpoint/SKILL.md        loads itself when you add an endpoint
```

Nothing else in your repo was touched. All of it is plain text you can read and edit.

## The four pieces

**CLAUDE.md** is read at the start of every session. It's why Claude stops asking what your stack is
and stops reintroducing bugs you've already fixed. The "Conventions" and "Traps" sections are the
valuable part — those are the rules your codebase actually breaks.

**Commands** are shortcuts you type. `/check` instead of "run the typecheck and the linter and the
tests and fix whatever's broken but don't delete tests to make them pass."

**Skills** load themselves. You don't invoke `add-endpoint` — when you say "add a DELETE route for
categories," Claude sees the description, loads the skill, and follows the steps. That's the
difference between a skill and a command.

**Hooks** run automatically. The one in `settings.json` runs `typecheck` after every file edit, so a
type error surfaces immediately instead of twenty minutes later.

## Try these first

```
/check
```
Confirms everything works end to end.

```
/review
```
Make a small change first, then run it. This is the one you'll use most.

```
add a GET /expenses/summary endpoint that totals by category
```
Watch it load the `add-endpoint` skill on its own and follow the checklist.

## Keeping it useful

CLAUDE.md decays if you don't feed it. The habit that matters:

**When Claude makes the same mistake twice, add a line to the Traps section.** That's it. Two minutes,
and it never makes that mistake again. Teams that do this get compounding value; teams that don't end
up back where they started in about a month.

Don't let it sprawl past ~200 lines. It's loaded every session — long files dilute the important
parts. If a section is only relevant sometimes, move it into a skill.

## Permissions

`settings.json` pre-approves the safe commands (test, typecheck, lint, git status/diff) so you stop
getting prompted for routine things. It explicitly denies reading `.env` files, `git push`,
`npm publish`, and `rm -rf`.

Adjust freely — `allow` is things you're tired of approving, `deny` is things that should never happen
without you.

## Questions

Message me. Support runs 7 days on Pro and 14 on Team, and "how do I extend this" counts as support.
