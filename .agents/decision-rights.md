# Decision rights (DRAFT)

The default is **decide, log, continue**. Ending a turn on a question to the
maintainer is correct only for the rows marked _Maintainer_.

| Decision                                                              | Who                 |
| --------------------------------------------------------------------- | ------------------- |
| Implementation approach, internal structure, internal naming          | Agent               |
| Which existing helper/pattern to reuse or extend                      | Agent               |
| Test design                                                           | Agent               |
| Git mechanics (see conventions below)                                 | Agent               |
| Choosing between viable options                                       | Agent, logged       |
| Accepting or rejecting a reviewer finding                             | Agent, logged       |
| Trimming scope to the smallest change that resolves the issue         | Agent, logged       |
| Filing a follow-up instead of fixing something adjacent               | Agent, logged       |
| Additive, optional config (new option, default preserves behavior)    | Agent, logged (\*)  |
| Any `config-upgrade` change (rename, move, changed default)           | Maintainer notified |
| Any `breaking` change                                                 | Maintainer          |
| Declining or closing a user's request                                 | Maintainer          |
| Any public reply to a user                                            | Maintainer          |
| New runtime dependency                                                | Maintainer          |
| Merge and release                                                     | Maintainer          |

(\*) Open question for the maintainer: additive config is agent-decided here
because a new option can be renamed later with an automatic upgrade. The
alternative is to move this row to _Maintainer_.

- **Logged** means one line in the review record: the choice and the reason.
- **Maintainer notified** means the agent proceeds, and the inbox issue calls
  the change out at the top so it cannot be missed.
- **Maintainer** means stop that thread of work and ask in the inbox, with a
  recommendation. Continue any work that does not depend on the answer.

## When unsure which row applies

Ask: can this be undone later by another PR, without users noticing? If yes,
decide and log. If users would have to act, or would see a public statement
made in the maintainer's name, escalate.

## Fixed conventions (not decisions)

- PRs target `dev`.
- One squash commit per PR, Conventional Commits title.
- Stale contributor PRs are refreshed by merging `dev` in; history on someone
  else's branch is never rewritten.
- PR labels: one type label (`bug`, `feature`, ...) and, where applicable, one
  compatibility label (see [compatibility.md](compatibility.md)).

## Feedback loop

When the maintainer overrules a logged decision, the correction becomes a line
in this file or in the rubric in the same change. The log exists to shrink the
_Maintainer_ rows over time.
