# Contributed pull requests (DRAFT)

How a pull request from someone other than the maintainer is handled. The
public summary for contributors is in [`docs/ai.md`](../../docs/ai.md) and
[`docs/developing.md`](../../docs/developing.md). Keep them in sync with this
file.

## Flow

| Step           | Who                              | What                                                                                                                                                                                                                                                                                                                                |
| -------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Intake      | Triage agent, daily              | Labels the PR: type, compatibility and verification class. Codex reviews it automatically on GitHub.                                                                                                                                                                                                                                |
| 2. Investigate | Agent, in a cloud session        | Works out the intent from the PR and any linked issue. Runs `/code-review <PR number>` privately. For a fix, shows a test that fails on `dev` and passes on the PR. Checks the PR against the [product stance](product-stance.md) and the [rubric](../standards/review-rubric.md). Contributor code runs only in the cloud session. |
| 3. Verdict     | Agent drafts, maintainer decides | Product verdict (take it, take it with changes, decline); how much of the author's code would survive; a numbered list of required changes; whether the author allows maintainer edits. Any config change in the PR needs the maintainer's approval here, as at plan time.                                                          |
| 4. Changes     | Agent                            | See below.                                                                                                                                                                                                                                                                                                                          |
| 5. Merge       | Maintainer                       | As for any PR.                                                                                                                                                                                                                                                                                                                      |

## Making the changes

- **If the author allows maintainer edits**, the agent makes the approved
  changes itself, as follow-up commits on the author's branch. It never rewrites
  the author's history. The author keeps the credit. Then the usual self-audit
  and review apply.
- **If the author does not allow maintainer edits**, the agent gives the
  feedback on the PR instead: the numbered changes, in a reply the maintainer
  has approved, starting with the disclosure line.
- **A change to what the PR does**, as opposed to how it does it, is never
  made by the agent on its own. It is part of the verdict the maintainer
  decides.

## Queue position

Contributed PRs come after regressions and before everything else, because a
contributor is waiting. They use one of the three feature and fix slots (see
[README.md](README.md)).

## Replies an agent may post without asking

Each reply is factual and starts with the disclosure line.

| #   | Reply                                | Condition                     |
| --- | ------------------------------------ | ----------------------------- |
| P1  | CI is failing, with the failing step | A required check failed       |
| P2  | Please target `dev`                  | The PR targets another branch |
| P3  | The PR has conflicts with `dev`      | GitHub reports conflicts      |

These fall under the same warm-up as issue replies (see
[triage.md](triage.md)).

## Stale PRs

If the author has not responded within two weeks of being asked for changes,
the agent recommends taking over the PR, with credit to the author. The
maintainer decides.
