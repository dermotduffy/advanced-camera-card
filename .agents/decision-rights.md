# Decision rights (DRAFT)

The default is **decide, log, continue**. Ending a turn on a question to the
maintainer is correct only for the rows marked _Maintainer_.

## Standing answers

Questions agents have historically asked, which the maintainer has answered
the same way every time.

| Question                                                        | Answer                                                                                                                                   |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Apply the local refactor, rename or simplification I recommend? | Yes. Report in one line.                                                                                                                 |
| Which of several internal names?                                | The one that reuses existing vocabulary and matches siblings.                                                                            |
| Keep or drop polish that costs complexity?                      | Drop. Log the user-visible cost and the lines saved.                                                                                     |
| Implementation fork A or B?                                     | Take your recommendation. Log the runner-up.                                                                                             |
| Build it, or use an existing tool?                              | Use the existing tool. Hand-rolling needs a strong justification and a readiness to defend the choice.                                   |
| Found an unrelated pre-existing bug. Fix it?                    | No. File an issue and continue. Fix in place only when it shares the root cause.                                                         |
| Add a browser test, or leave it as a manual check?              | Add the test, including a small harness capability if that is what it takes.                                                             |
| Remove debug probes and abandoned alternatives?                 | Yes, as soon as the measurement or decision is made.                                                                                     |
| How to sync with `dev`?                                         | Rebase. Never a merge commit or a WIP commit.                                                                                            |
| Where does a CI fix go?                                         | The same branch.                                                                                                                         |
| What next at the end of a phase?                                | Run the gate (format, lint, typecheck, coverage, prune) and continue.                                                                    |
| Accept or reject a reviewer finding?                            | Verify it against the code or a real run. Fix real defects. Reject per Tier 3 of the [rubric](review-rubric.md), with a one-line reason. |
| What to work on next?                                           | The queue order in [README.md](README.md). Do not ask.                                                                                   |

## Who decides the rest

| Decision                                                              | Who        |
| --------------------------------------------------------------------- | ---------- |
| Implementation approach, test design, internal naming                 | Agent      |
| Structure: a new manager or controller, who owns state, internal APIs | Agent      |
| Trimming scope to the smallest change that resolves the issue         | Agent      |
| Compatibility and verification class                                  | Agent      |
| Any config change: new option, rename, move, changed default          | Maintainer |
| Any `breaking` change                                                 | Maintainer |
| Accepting or declining a contributor's feature; amend versus re-do    | Maintainer |
| Declining or closing a user's request                                 | Maintainer |
| Any public reply to a user or contributor                             | Maintainer |
| New runtime dependency                                                | Maintainer |
| In-person testing of a `MANUAL` change; the weekly release test       | Maintainer |
| Merge and release                                                     | Maintainer |

Agent decisions are logged in one line each: the choice and the reason.

### Structure

Structure decisions never go to the maintainer. They follow the structure
section of the [rubric](review-rubric.md), are checked by the design
challenger before code exists, and are revisited by the weekly architecture
role. A wrong call is fixed by a later refactor.

### Config

Config is the card's main interface with its users, so every config change is
proposed at plan time, before code is written:

- The option's name, location in the schema, type and default.
- The nearest existing option it is modeled on.
- Its compatibility class, and the upgrade if one is needed.
- The docs table row as it would read.

That piece of work waits for the answer. Other work continues. Once the shape
is approved, the implementation does not return for it.

## Asking well

When a _Maintainer_ row applies:

- Options first, in a table with identifiers. Then the analysis. Then one
  recommendation, committed to.
- Never refer to an option or term the maintainer has not been shown.
- Only include what the maintainer can act on.
- For anything visual, attach screenshots at minimum, default and maximum
  sizes.
- For in-person testing, a minimal plan whose configs validate against the
  schema and whose expectations match the real UI.

## When unsure which row applies

Ask: can this be undone later by another PR, without users noticing? If yes,
decide and log. If users would have to act, or would see a statement made in
the maintainer's name, it is the maintainer's.

## Git conventions

- An agent works in its own clone, commits to its own branch, and opens a PR
  against `dev`. It never merges, and never rewrites someone else's branch.
- One squash commit per PR. The PR title is a one-sentence Conventional Commit
  describing user-visible behavior, with config keys in backticks.
- Small, single-purpose PRs.

## Feedback loop

When the maintainer overrules a logged decision, the correction becomes a line
in this file or in the rubric in the same change.
