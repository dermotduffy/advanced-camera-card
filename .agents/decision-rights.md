# Decision rights (DRAFT)

The default is **decide, log, continue**. Ending a turn on a question to the
maintainer is correct only for the rows marked _Maintainer_.

The first table covers questions that agents have historically asked and the
maintainer has answered the same way every time. They are now standing
answers.

## Standing answers

| Question                                                         | Answer                                                                                                                                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Apply the local refactor, rename or simplification I recommend?  | Yes, when confined to non-public code in the files under change. Report in one line.                                                     |
| Which of several internal names?                                 | The one that reuses existing vocabulary and matches siblings.                                                                            |
| Keep or drop polish that costs complexity?                       | Drop. Log the user-visible cost and the line count saved.                                                                                |
| Implementation fork A or B?                                      | Take your recommendation when it is reversible and has no public surface. Log the runner-up.                                             |
| Found an unrelated pre-existing bug. Fix it?                     | No. File an issue and continue. Fix in place only when it shares the root cause.                                                         |
| Add a browser test, or leave it as a manual check?               | Add the test, including a small harness capability if that is what it takes.                                                             |
| Remove debug probes and abandoned alternatives?                  | Yes, as soon as the measurement or decision is made.                                                                                     |
| How to sync with `dev`?                                          | Rebase. Never a merge commit or a WIP commit.                                                                                            |
| Where does a CI fix go?                                          | The same branch.                                                                                                                         |
| What next at the end of a phase?                                 | Run the gate (format, lint, typecheck, coverage, prune), then continue. Record where things stand and what is left.                      |
| Accept or reject a reviewer finding?                             | Verify it against the code or a real run. Fix real defects. Reject per Tier 3 of the [rubric](review-rubric.md), with a one-line reason. |

## Who decides the rest

| Decision                                                                 | Who                 |
| ------------------------------------------------------------------------ | ------------------- |
| Test design                                                              | Agent               |
| Trimming scope to the smallest change that resolves the issue            | Agent, logged       |
| New structure: a new manager or controller, who owns state, API shape    | Agent, logged (\*)  |
| Additive, optional config (new option, default preserves behavior)       | Agent, logged (\*)  |
| Any `config-upgrade` change (rename, move, changed default)              | Maintainer notified |
| Any `breaking` change                                                    | Maintainer          |
| Visual judgment (sizes, spacing, hover and motion)                       | Maintainer          |
| Accepting or declining a contributor's feature; amend versus re-do       | Maintainer          |
| Declining or closing a user's request                                    | Maintainer          |
| Any public reply to a user or contributor                                | Maintainer          |
| New runtime dependency                                                   | Maintainer          |
| Behavior that can only be verified on a real device                      | Maintainer          |
| Merge and release                                                        | Maintainer          |

(\*) Open questions for the maintainer. Both rows are agent-decided here
because both can be undone later without users noticing (structure by
refactor, an option by automatic upgrade). For new structure, the agent must
first get a second model's independent recommendation and log both. The
alternative is to move either row to _Maintainer_.

- **Logged** means one line in the review record: the choice and the reason.
- **Maintainer notified** means the agent proceeds, and the inbox issue calls
  the change out at the top.
- **Maintainer** means stop that thread of work and ask in the inbox. Continue
  any work that does not depend on the answer.

## Asking well

When a _Maintainer_ row applies:

- Options first, in a table with identifiers. Then the analysis. Then one
  recommendation, committed to.
- Never refer to an option or term the maintainer has not been shown.
- Only include what the maintainer can act on.
- For config: include the precedent searched, the shape you would choose on a
  clean slate, and the compatibility class.
- For visual judgment: attach screenshots at minimum, default and maximum
  sizes so one look settles it.
- For device verification: a minimal plan whose configs validate against the
  schema and whose expectations match the real UI.
- A challenge or question from the maintainer is a discussion. It is not an
  instruction to change code.

## When unsure which row applies

Ask: can this be undone later by another PR, without users noticing? If yes,
decide and log. If users would have to act, or would see a statement made in
the maintainer's name, escalate.

## Working tree rules

These differ by where the agent is running.

| Rule                         | Maintainer's own working tree | Agent's own worktree (implement loop) |
| ---------------------------- | ----------------------------- | ------------------------------------- |
| Stage, commit, push          | Never without a direct order  | Yes, to its own branch only           |
| Open a PR                    | No                            | Yes, targeting `dev`                  |
| Run `yarn run build`         | No                            | Yes                                   |
| Rewrite a contributor branch | No                            | No                                    |
| Merge                        | No                            | No                                    |

Allowing agents to commit and open PRs from their own worktrees is a change
from current practice and needs the maintainer's explicit agreement.

Other conventions: one worktree per branch; one squash commit per PR; a
one-sentence Conventional Commit title describing user-visible behavior, with
config keys in backticks; small single-purpose PRs.

## Feedback loop

When the maintainer overrules a logged decision, the correction becomes a line
in this file or in the rubric in the same change. The log exists to shrink the
_Maintainer_ rows over time.
