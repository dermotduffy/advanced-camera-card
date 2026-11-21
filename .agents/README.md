# Agent operating model (DRAFT)

> Status: draft for maintainer review. Nothing here is in force until this
> notice is removed.

How AI agents work on this project with minimal maintainer involvement. The
maintainer owns the user-facing surface and the final merge. Agents own
everything else, including what to work on next and how the code is
structured.

## Documents

| File                                       | Purpose                                                         |
| ------------------------------------------ | --------------------------------------------------------------- |
| [decision-rights.md](decision-rights.md)   | What an agent decides alone and what goes to the maintainer.    |
| [review-rubric.md](review-rubric.md)       | The code standards a change is held to.                         |
| [product-stance.md](product-stance.md)     | What the card is for, non-goals, accept and decline heuristics. |
| [releases.md](releases.md)                 | Versioning, channels, compatibility and verification classes.   |
| [test-environment.md](test-environment.md) | Hardware available to the maintainer for testing.               |
| [triage.md](triage.md)                     | Priority, investigation, and the replies agents may post alone. |
| [user-replies.md](user-replies.md)         | How any reply to a user is written.                             |

`INSTRUCTIONS.md` (linked as `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`) is the
short always-loaded rule list and points here.

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

| What                                                            | Where                                         |
| --------------------------------------------------------------- | --------------------------------------------- |
| The work queue, slots in use, what is waiting on the maintainer | Private project board, written by agents      |
| Questions to the maintainer, and the answers                    | The agent's own session                       |
| Agent-to-agent discussion                                       | Inside the agent session                      |
| What a change does and the evidence it works                    | The PR description, kept short                |
| Release state and the release-test checklist                    | The standing `dev`→`main` PR                  |
| Standing rules                                                  | This directory                                |
| Public GitHub                                                   | Labels, PRs, maintainer-approved replies only |

The maintainer never debates an agent in public. The only public exchange
between agents is the cross-model review on a PR.

**Every comment, reply, review or PR description an agent posts under the
maintainer's name starts with this line, alone:**

```
_Posted by an AI agent on behalf of the maintainer ([how AI is used in this project](https://card.camera/#/ai))._
```

This includes replies the maintainer approved before an agent posted them.
The linked page, [`docs/ai.md`](../docs/ai.md), tells users what agents do and
how to reach a human.

Agent sessions run in the cloud: each gets its own clone, starts without
maintainer setup, and receives its own PR's CI results. A session that needs
the maintainer waits; its board card moves to "Waiting on you" with the
question summarized and a link to the session.

## Roles

Each role has a trigger and an output. None is a chat partner.

| Role              | Trigger             | Output                                                 |
| ----------------- | ------------------- | ------------------------------------------------------ |
| Orchestrator      | Schedule            | Fills free slots from the queue; keeps the board true. |
| Implementer       | A slot and an issue | Plan, then PR.                                         |
| Design challenger | Implementer's plan  | Approve or redirect, before code is written.           |
| Reviewer          | Before the PR opens | Classified findings against the rubric.                |
| Architecture      | Weekly              | Refactor PRs, new lint rules or checks, a report.      |
| Testing           | Weekly              | Test PRs, harness improvements, a report.              |
| Triage            | Daily               | Labels and priorities; a digest of recommendations.    |
| Feature           | Fortnightly         | Ranked proposals.                                      |

The design challenger and reviewer are fresh-context agents, separate from the
implementer. They are given the plan or the diff and the rubric, never the
implementer's reasoning. A second review, by a different model, happens on the
PR itself (see "Cross-model review" below).

### Queue and slots

- Agents choose their own work: regressions first, then bugs by priority label
  and age, then features by votes weighed against the
  [product stance](product-stance.md). Anything waiting on a maintainer answer
  is skipped, not waited for.
- No more than three features or fixes in flight, plus one slot reserved for
  architecture or testing work. In flight means from plan to merge.
- The maintainer overrides priority with labels or on the board, and changes
  the slot counts as confidence grows.

### Implement loop

1. **Plan.** Modules touched; existing code and tools reused; why existing
   code is not being extended instead; any config change; compatibility and
   verification class; tests to add. Plans are short and discarded after merge.
2. **Prior-art search.** Before building any tool, script or mechanism, look
   for an established one. Hand-rolling needs a strong justification and a
   readiness to defend the choice.
3. **Design gate.** The challenger reads the plan with the whole repository
   open. Is this the n-th instance of an existing pattern? Is the code at the
   lowest level that works? Is there a simpler change? Are the classes right?
4. **Config approval**, if the plan changes config. The maintainer sees the
   proposal before any code exists (see
   [decision-rights.md](decision-rights.md)).
5. **Implement**, with tests and docs, until lint, typecheck, coverage,
   format-check and prune pass.
6. **Self-audit** against Tier 1 of the [rubric](review-rubric.md): every
   comment, name and test title added.
7. **Review** under the guardrails below.
8. **Open the PR** against `dev` as a draft, with labels, a short description
   and the evidence. Subscribe to its CI and fix failures on the same branch.
9. **Cross-model review** on the PR. When it is settled, mark the PR ready.
   The maintainer looks only at PRs that are ready.

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

Codex reviews every PR on GitHub. This is the one place agents exchange
findings in public; it is agent to agent, and the maintainer is not a party
to it.

- Codex is guided by the "Review guidelines" section of `INSTRUCTIONS.md`,
  which holds it to the same scope and tiers as the in-session reviewer.
- The implementer verifies each finding against the code or a real run. Real
  defects are fixed with a commit.
- A finding it will not apply gets one reply of one line giving the reason.
  No further exchange on that thread.
- Two rounds at most. After the second, remaining non-blocking findings are
  left as they are.
- The maintainer never replies in these threads. Maintainer feedback stays
  private.

### Weekly roles

Both take the week's merged PRs as input and share the reserved slot.

- **Architecture** looks for repeated patterns, code or state at too high a
  level, drifting structure, and hand-rolled things an established tool covers.
- **Testing** looks for weak or redundant tests, release-test checks that could
  become browser tests, and gaps exposed by the week's bugs.

Each finding becomes, in order of preference: a mechanical check (lint rule,
duplicate detector, boundary check); a PR through the implement loop; a new
rubric line.

## Maintainer feedback

Given privately in the PR's session, as discussion or as line-anchored remarks.
Never as public PR comments. The agent applies it, and classifies it as a
one-off or a rule. A rule is added to the rubric or decision rights in the same
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
   hand.
3. Releases: CalVer, the beta channel, the release PR (see
   [releases.md](releases.md)).
4. Orchestrator and board automation.
5. Architecture and testing roles, and the first lint ratchets.
6. Triage and feature roles.

## Not yet verified

- That release-it's CalVer plugin can publish betas from `dev`.
- That agents can keep the private project board updated with the available
  token types.
- That the subscription's usage limits allow four concurrent sessions plus the
  scheduled roles.
- How much of the release test can be automated against Home Assistant in a
  container.
