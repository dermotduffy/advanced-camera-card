# Agent operating model (DRAFT)

> Status: draft for maintainer review. Nothing here is in force until this
> notice is removed.

How AI agents work on this project with minimal maintainer involvement. The
maintainer sets direction and owns the decisions that are hard to undo; agents
own everything else, including implementation approach.

## Documents

| File                                       | Purpose                                                      |
| ------------------------------------------ | ------------------------------------------------------------ |
| [decision-rights.md](decision-rights.md)   | What an agent decides alone, decides and logs, or escalates. |
| [review-rubric.md](review-rubric.md)       | The code standards a change is reviewed against.             |
| [product-stance.md](product-stance.md)     | What the card is for, non-goals, accept/decline heuristics.  |
| [compatibility.md](compatibility.md)       | The three compatibility classes and how they are enforced.   |
| [calver-migration.md](calver-migration.md) | One-off proposal to move from SemVer to CalVer.              |

`INSTRUCTIONS.md` (linked as `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`) remains the
short always-loaded rule list. These documents are loaded by the role that
needs them.

## Where things happen

| Activity                  | Place                                                    |
| ------------------------- | -------------------------------------------------------- |
| Maintainer decisions      | Private inbox repository (issues).                       |
| Agent-to-agent discussion | Inside the agent session; summarized in the inbox issue. |
| Watching / stepping in    | VS Code Agents window; one git worktree per issue.       |
| Discussion with an agent  | The agent session itself (desktop or phone).             |
| Public GitHub             | Labels, finished PRs, maintainer-approved user replies.  |

Agents never debate each other, or the maintainer, in public issues or PRs.

## Roles

Each role has a trigger and an output. None is a chat partner.

| Role              | Trigger                | Output                                           |
| ----------------- | ---------------------- | ------------------------------------------------ |
| Implementer       | Approved issue         | Plan, then PR, then inbox issue with the record. |
| Design challenger | Implementer's plan     | Approve or redirect, before code is written.     |
| Reviewer          | Before the PR opens    | Classified findings against the rubric.          |
| Sweep             | Weekly                 | Refactor PRs, new mechanical checks, a report.   |
| Triage            | Daily                  | Labels, one inbox digest of recommendations.     |
| Feature           | Fortnightly            | Ranked proposals in the inbox.                   |

The reviewer and design challenger run on a different model from the
implementer (Codex, called over MCP from the implementer's session).

### Implement loop

1. **Plan.** Modules touched, existing helpers reused, why existing code is not
   being extended instead, compatibility class, tests to add.
2. **Design gate.** The challenger reads the plan with the whole repository
   open, not a diff. It asks: is this the n-th instance of an existing pattern?
   Is the logic in the right layer? Is there a simpler change? Is the
   compatibility class right?
3. **Implement**, with tests and docs, until `yarn run lint`, `typecheck`,
   `coverage`, `format-check` and `prune` pass.
4. **Self-audit** against Tier 1 of the [rubric](review-rubric.md): every
   comment, name and test title added.
5. **Review** under the reviewer guardrails below.
6. **Verify.** Prefer a permanent browser test. Whatever can only be checked on
   a real device becomes a minimal manual plan for the maintainer.
7. **Open the PR** with a short description. File an inbox issue with the
   review record and any manual plan.

### Relation to the existing skills

The maintainer's current pipeline is plan, phased implementation,
`/review-table`, Codex review, `/acc-manual-verify`, `/ready-commit`, then a
manual commit. The implement loop keeps those stages and changes who performs
them:

| Today                                              | Implement loop                                              |
| -------------------------------------------------- | ----------------------------------------------------------- |
| Maintainer annotates the plan                      | Design challenger gates the plan                            |
| Stop after each phase for review                   | Run the gate and continue                                   |
| `/review-table`, line-by-line maintainer review    | Tier 1 self-audit, then reviewer; maintainer samples        |
| Codex review, maintainer builds the fix pile       | Implementer adjudicates per the rubric and logs rejections  |
| `/acc-manual-verify` for most changes              | Browser tests first; manual plan only for device-only cases |
| `/ready-commit`, maintainer commits and opens a PR | Agent commits to its own branch and opens the PR            |
| `/pr-review` and `/my-voice` on contributor PRs    | Unchanged; direction and replies stay with the maintainer   |

Standing rules that currently live only in the maintainer's local memory files
should move into `INSTRUCTIONS.md` or these documents so every agent sees
them.

### Reviewer guardrails

- **Scope:** the diff only. Pre-existing code is the sweep's job.
- **Classification:** every finding is `blocking` or `follow-up` per the
  rubric. `blocking` requires a concrete failure scenario (inputs or state,
  then the wrong outcome). No scenario means `follow-up`.
- **Adjudication:** the implementer may reject a finding with a stated reason.
  The reviewer advises; it does not gate.
- **Rounds:** two at most. The second round only verifies that blocking fixes
  landed; it may not raise new non-blocking findings.
- **Deadlock:** an unresolved blocking disagreement goes to the inbox as a
  one-line question.
- **Verification:** the implementer checks each finding against the code or a
  real run before acting on it. Findings are not taken at face value.
- **Quota:** Codex usage is limited. It is spent first on the design gate and
  on the final review. When it runs out, a fresh-context agent on the
  implementer's model takes the reviewer role and the review record says so.

### Sweep

Reads the whole codebase plus the week's merged diffs. Looks for duplicated
logic, drifting patterns, layering violations (`components/` holding logic
that belongs in `components-lib/`), weak or redundant tests. Each finding
becomes, in order of preference:

1. a mechanical check (lint rule, duplicate detector, boundary check, test);
2. a refactor PR through the implement loop;
3. a new rubric line.

## Inbox issue formats

One issue per decision. Fixed, short. The maintainer answers with a label
(`approved`, `declined`) or a one-line redirect. Closed means done.

**Proposal / triage recommendation**

```
What: <one sentence>
Why: <demand or defect evidence, with issue links>
Recommendation: <fix | decline | needs-info | propose config shape>
Compatibility: <compatible | config-upgrade | breaking>
Options: <only if a real choice exists>
```

**Review record (one per PR)**

```
PR: <link>            Session: <link>
Decisions made alone: <one line each, with reason>
Reviewer findings: <n blocking fixed, n rejected (reason each), n follow-up>
Verified by: <browser tests added | manual plan below>
Needs you: <nothing | the question | the manual plan>
```

Questions follow "Asking well" in [decision-rights.md](decision-rights.md):
options in a table first, then one recommendation.

## Trial

Stage 1 is the implement loop on two or three well-specified bugs. Measured by
maintainer minutes per merged PR, issues closed per week, and regressions after
merge. During the trial the maintainer still reads each PR, and every comment
he would have made becomes a rubric line, so the trial also measures how many
such comments remain. Later stages (CalVer, sweep, triage and feature roles) follow only if
stage 1 works.
