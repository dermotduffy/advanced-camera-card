# Agent operating model (DRAFT)

> Status: draft for maintainer review. Nothing here is in force until this
> notice is removed.

How AI agents effectively work on this project. The maintainer owns the user-facing surface and the final merge. Agents own
everything else, including what to work on next and how the code is
structured.

## Documents

This folder describes how agents acting for the maintainer operate. They also
follow everything in [`../standards/`](../README.md).

| File                                       | Purpose                                                         |
| ------------------------------------------ | --------------------------------------------------------------- |
| [decision-rights.md](decision-rights.md)   | What an agent decides alone and what goes to the maintainer.    |
| [triage.md](triage.md)                     | Priority, investigation, and the replies agents may post alone. |
| [contributions.md](contributions.md)       | How contributed pull requests are handled.                      |
| [user-replies.md](user-replies.md)         | How any reply to a user is written.                             |
| [releases.md](releases.md)                 | Versioning, channels, release notes and the release test.       |
| [test-environment.md](test-environment.md) | Hardware available to the maintainer for testing.               |
| [product-stance.md](product-stance.md)     | What the card is for, non-goals, accept and decline heuristics. |

`INSTRUCTIONS.md` (linked as `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`) is the
short rule list that is always loaded. It points here.

## Where the maintainer is involved

Everything not in this list happens without the maintainer.

| Touchpoint                                                                 | When                                |
| -------------------------------------------------------------------------- | ----------------------------------- |
| Approve a config change                                                    | At plan time, before code           |
| Sign off a `breaking` change                                               | At plan time                        |
| Decide a contributor PR's direction                                        | When one arrives                    |
| Approve declining or closing a request                                     | From the triage digest              |
| Approve a public reply outside the fixed classes in [triage.md](triage.md) | From the triage digest              |
| Test a `MANUAL` change in person                                           | Before it merges to `dev`           |
| Merge a PR to `dev`                                                        | When its checks and record are done |
| Run the release test and merge `dev`→`main`                                | Weekly                              |

## Where things happen

| What                                                            | Where                                                            |
| --------------------------------------------------------------- | ---------------------------------------------------------------- |
| The work queue, slots in use, what is waiting on the maintainer | Labels and PRs; the private project board shows them in one view |
| Questions to the maintainer, and the answers                    | The agent's own session                                          |
| Agent-to-agent discussion                                       | Inside the agent session                                         |
| What a change does and the evidence it works                    | The PR description, kept short                                   |
| Release state and the release-test checklist                    | The standing `dev`→`main` PR                                     |
| Standing rules                                                  | `.agents/standards/` and `.agents/maintainer/`                   |
| Public GitHub                                                   | Labels, PRs, maintainer-approved replies only                    |

The maintainer never debates an agent in public. The only public exchange
between agents is the cross-model review on a PR.

**Every comment, reply, review or PR description an agent posts under the
maintainer's name starts with this line, alone:**

```
_Posted by an AI agent on behalf of the maintainer ([how AI is used in this project](https://card.camera/#/ai))._
```

This includes replies the maintainer approved before an agent posted them.
The linked page, [`docs/ai.md`](../../docs/ai.md), tells users what agents do and
how to reach a human.

Agent sessions run in the cloud. Each session gets its own clone, starts
without any setup by the maintainer, and receives the CI results for its own
PR. A session that needs the maintainer puts the `needs-maintainer` label on
its issue or PR, then waits.

The private project board is a view, not a store. It is configured to reflect
labels and PR activity. Priority comes from the `P0` to `P3` labels. "In
progress" comes from an open draft PR, "ready to merge" from a ready PR, and
"waiting on the maintainer" from `needs-maintainer`. Agents never write to the
board. They set labels and open PRs, and the board follows. `needs-maintainer` is distinct from `waiting`,
which means waiting on the reporter.

## Roles

Each role has a trigger and an output. None is a chat partner.

| Role              | Trigger             | Output                                              |
| ----------------- | ------------------- | --------------------------------------------------- |
| Orchestrator      | Schedule            | Fills free slots from the queue.                    |
| Implementer       | A slot and an issue | Plan, then PR.                                      |
| Design challenger | Implementer's plan  | Approve or redirect, before code is written.        |
| Reviewer          | Before the PR opens | Classified findings against the rubric.             |
| Architecture      | Weekly              | Refactor PRs, new lint rules or checks, a report.   |
| Testing           | Weekly              | Test PRs, harness improvements, a report.           |
| Triage            | Daily               | Labels and priorities; a digest of recommendations. |
| Feature           | Weekly              | Ranked proposals.                                   |

The design challenger and reviewer are fresh-context agents, separate from the
implementer. They are given the rubric and either the plan or the diff, never
the implementer's reasoning. A different model then gives a second review (see
"Cross-model review" below).

### Queue and slots

- Agents choose their own work in this order: regressions, contributed PRs,
  bugs by priority label and age, then features by votes weighed against the
  [product stance](product-stance.md). Anything waiting on an answer from the
  maintainer is skipped, not waited for.
- No more than three features or fixes in flight, plus one slot reserved for
  architecture or testing work. In flight means from plan to merge.
- The maintainer overrides priority with labels. The maintainer also changes
  the slot counts as the process proves itself.

### Implement loop

1. **Plan.** Modules touched; existing code and tools reused; why existing
   code is not being extended instead; any config change; compatibility and
   verification class; tests to add. Plans are short and discarded after merge.
2. **Prior-art search.** Before building any tool, script or mechanism, look
   for an established one. Hand-rolling needs a strong justification and a
   readiness to defend the choice.
3. **Design gate.** The challenger reads the plan with the whole repository
   open. Is this the n-th instance of an existing pattern? Is the code at the
   lowest level that works? Is there a simpler change? Are the compatibility
   and verification classes right?
4. **Config approval**, if the plan changes config. The maintainer sees the
   proposal before any code exists (see
   [decision-rights.md](decision-rights.md)).
5. **Implement**, with tests and docs, until lint, typecheck, coverage,
   format-check and prune pass.
6. **Self-audit** against Tier 1 of the [rubric](../standards/review-rubric.md), covering
   every comment, name and test title the change adds. Then a fresh-context
   agent, which sees the prose but not the code, runs the prose check in
   [writing.md](../standards/writing.md).
7. **Review** with Claude Code's built-in `/code-review`, run privately in the
   session by a fresh-context agent, under the guardrails below.
8. **Open the PR** against `dev` as a draft, with labels, a short description
   and the evidence. Subscribe to its CI and review activity, and fix failures
   on the same branch.
9. **Cross-model review** on the PR (see below). When it is settled, mark the
   PR ready. The maintainer looks only at PRs that are ready.

### Reviewer guardrails

- **Scope:** the diff only. Pre-existing code belongs to the weekly roles.
- **Classification:** every finding is `blocking` or `follow-up` per the
  rubric. `blocking` requires a concrete failure scenario. No scenario means
  `follow-up`.
- **Verification:** the implementer checks each finding against the code or a
  real run before acting on it.
- **Adjudication:** the implementer may reject a finding with a stated reason.
- **Rounds:** two at most. The second only verifies that blocking fixes landed.
- **Deadlock:** where implementer and reviewer still disagree, the option with
  fewer new concepts wins, and the disagreement is logged.

### Cross-model review

Codex, a model from a different family, reviews every PR on GitHub. It uses
Codex's automatic code review on the maintainer's Codex plan. This is the one
place where agents exchange findings in public. The exchange is between agents
only, and the maintainer takes no part in it.

- Codex is guided by the "Review guidelines" section of `INSTRUCTIONS.md`,
  which holds it to the same scope and tiers as the in-session reviewer.
- The implementer verifies each finding against the code or a real run. Real
  defects are fixed with a commit.
- When the implementer will not apply a finding, it replies once, in one line
  that starts with the disclosure line and gives the reason. No further exchange on that thread.
- Two rounds at most. After the second, remaining non-blocking findings are
  left as they are.
- The maintainer never replies in these threads. Maintainer feedback stays
  private.

**Later option: private review on the maintainer's computer.** This has been
tested and works. A session can create a scheduled task that starts sessions on
the maintainer's always-on computer. The task needs one approval when it is
created, and none per run. The results can be read from the transcript of the
session it starts. Running the agent sessions there would make Codex local and the
review private. It would also let Codex review plans as well as diffs. Before
any real work runs there, this option requires a separate account on that
computer that holds only what the agents need. Not adopted for now.

### Weekly roles

Both take the week's merged PRs as input and share the reserved slot.

- **Architecture** looks for repeated patterns, code or state at too high a
  level, drifting structure, and hand-rolled things an established tool covers.
- **Testing** looks for weak or redundant tests, release-test checks that could
  become browser tests, and gaps exposed by the week's bugs.

The testing role also owns the longer-term question of how to test the card
with less of the maintainer's time. It advances that question in small steps.
Running the card against a real Home Assistant in a container is one candidate,
not a commitment. The repository's dev container setup has not been used for
years and may not work. Until something better exists, the safeguards are CI,
the `dist` tests that check that the built output loads, and the maintainer's own
testing before each stable release.

Each finding becomes, in order of preference: a mechanical check (lint rule,
duplicate detector, boundary check); a PR through the implement loop; a new
rubric line.

## Maintainer feedback

The maintainer gives feedback privately in the PR's session, as discussion or
as line-anchored remarks, never as public PR comments. The agent applies it and
classifies it as a one-off or a rule. A rule is added to the rubric or decision rights in the same
change. A question from the maintainer is a discussion, not an instruction to
change code.

## How much code the maintainer reads

- **During the trial:** everything. Each remark is counted by category. The
  trial ends when remarks per PR are few and none are blocking.
- **After it:** the PR description on every PR; the config and docs diff where
  present; full code on one sampled PR a week.

## Build order

1. These documents and `INSTRUCTIONS.md`.
2. The implement loop, trialed on two or three well-specified bugs started by
   hand, one at a time. The loop starts with one slot, so that mistakes in the
   process have a small blast radius. More slots are added once the loop works.
   The trial runs in public from the start. A trial session acts only on its
   own PR: it does not comment on, label or otherwise touch any other issue or
   PR.
3. Releases: CalVer, the beta channel, the release PR (see
   [releases.md](releases.md)).
4. Orchestrator, and the board configured to reflect labels.
5. Architecture and testing roles, and the first lint ratchets.
6. Triage and feature roles.

## Work this plan creates

This section is temporary. When the process starts, a one-time setup session
drafts one issue per row and shows them to the maintainer. Once the maintainer
approves them, the session files the issues and deletes this section in the
same change. From then on, the issues are the record. The work goes through the
implement loop like any other work. Each item starts with a search for an established tool.

| Work                                                                                                              | Enforces or enables                       |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Lint rule restricting network APIs to an allowlist of files                                                       | [Hard rule](../standards/hard-rules.md) 1 |
| Browser tests fail on any request that is not mocked                                                              | Hard rule 1                               |
| Lint rule against type assertions (`as`), with existing uses cleaned up                                           | `INSTRUCTIONS.md`                         |
| Lint rule against disabled and focused tests                                                                      | Proposed hard rule 5                      |
| Lint rule requiring test names to start with "should "                                                            | `INSTRUCTIONS.md`                         |
| Vale prose linter for docs and code comments: spelling, em-dashes, banned words, terms the project does not use   | [writing.md](../standards/writing.md)     |
| Mine the maintainer's past prose corrections into before-and-after pairs in [writing.md](../standards/writing.md) | Writing                                   |
| Run the prose check over `.agents/`, `INSTRUCTIONS.md` and `docs/ai.md` before the maintainer's review continues  | Writing                                   |
| Deny rule for merge tools, and a hook requiring the disclosure line, in `.claude/settings.json`                   | Proposed hard rules 3 and 4               |
| A test that fails when a config path is removed or renamed without an upgrade                                     | Compatibility classes                     |
| Fix the feature request template, which applies a label that does not exist                                       | Triage                                    |
| New labels: `behavior-change`, `config-upgrade`, `verify:pre-release`, `verify:manual`, `needs-maintainer`        | Releases, the board                       |
| Release tooling: release-it with CalVer, the beta channel, the release PR                                         | [Releases](releases.md)                   |
| User docs: releases and config impact; rewrite of `docs/developing.md` and the release FAQ                        | Releases                                  |
| Agent and scheduled-task definitions for each role                                                                | Roles                                     |
| Turn on Codex automatic code review for the repository                                                            | Cross-model review                        |

## Not yet verified

- That release-it can flag every release from `dev` as a pre-release, along
  with the other release-tooling points listed in [releases.md](releases.md).
  One of those points is whether a stable release can take its notes from the
  release PR's description, so that the maintainer can edit them before
  merging.
- That the existing project board can be configured to follow labels and PR
  activity as described above.
- What each session costs in subscription usage. This is measured during the
  trial and is not expected to limit the plan.
