# Implement loop (TRIAL)

How an agent acting for the maintainer takes one issue from plan to a pull
request. This is a trial: the maintainer starts each session by hand, one issue
at a time, and corrects these documents from what the trial shows.

The wider design (triage, contributed PRs, releases, scheduled roles) is
drafted on the `ccr-a1e28a4e-391iok-drafts` branch and is not in force.

## Documents

Agents acting for the maintainer follow these, and everything in
[`../standards/`](../README.md).

| File                                     | Purpose                                                      |
| ---------------------------------------- | ------------------------------------------------------------ |
| [decision-rights.md](decision-rights.md) | What an agent decides alone and what goes to the maintainer. |

## Scope of a trial session

- It works on the one issue it was given.
- It acts only on its own branch and PR. It does not comment on, label or
  otherwise touch any other issue or PR.
- When it needs the maintainer, it asks in its own session and waits.

## Roles

| Role              | Trigger             | Output                                       |
| ----------------- | ------------------- | -------------------------------------------- |
| Implementer       | An issue            | Plan, then PR.                               |
| Design challenger | Implementer's plan  | Approve or redirect, before code is written. |
| Reviewer          | Before the PR opens | Classified findings against the rubric.      |

The design challenger and reviewer are fresh-context agents, separate from the
implementer. They are given the rubric and either the plan or the diff, never
the implementer's reasoning. Codex then gives a second review on the PR (see
"Cross-model review" below).

## Steps

1. **Plan.** Modules touched; existing code and tools reused; why existing
   code is not being extended instead; any config change; tests to add. Plans
   are short and discarded after merge.
2. **Prior-art search.** Before building any tool, script or mechanism, look
   for an established one. Hand-rolling needs a strong justification and a
   readiness to defend the choice.
3. **Design gate.** The challenger reads the plan with the whole repository
   open. Is this the n-th instance of an existing pattern? Is the code at the
   lowest level that works? Is there a simpler change?
4. **Config approval**, if the plan changes config. The maintainer sees the
   proposal before any code exists (see
   [decision-rights.md](decision-rights.md)).
5. **Implement**, with tests and docs, until lint, typecheck, coverage,
   format-check and prune pass.
6. **Self-audit** against Tier 1 of the
   [rubric](../standards/review-rubric.md), covering every comment, name and
   test title the change adds. Then a fresh-context agent, which sees the
   prose but not the code, runs the prose check in
   [writing.md](../standards/writing.md).
7. **Review** with Claude Code's built-in `/code-review`, run privately in the
   session by a fresh-context agent, under the guardrails below.
8. **Open the PR** against `dev` as a draft, with a short description and the
   evidence. Subscribe to its CI and review activity, and fix failures on the
   same branch.
9. **Cross-model review** on the PR (see below). When it is settled, mark the
   PR ready. The maintainer looks only at PRs that are ready.

## Reviewer guardrails

- **Scope:** the diff only.
- **Classification:** every finding is `blocking` or `follow-up` per the
  rubric. `blocking` requires a concrete failure scenario. No scenario means
  `follow-up`.
- **Verification:** the implementer checks each finding against the code or a
  real run before acting on it.
- **Adjudication:** the implementer may reject a finding with a stated reason.
- **Rounds:** two at most. The second only verifies that blocking fixes landed.
- **Deadlock:** where implementer and reviewer still disagree, the option with
  fewer new concepts wins, and the disagreement is logged.

## Cross-model review

Codex reviews every PR on GitHub, using its automatic code review on the
maintainer's Codex plan. This is the one place where agents exchange findings
in public. The maintainer takes no part in it.

- Codex is guided by the "Review guidelines" section of `INSTRUCTIONS.md`.
- The implementer verifies each finding against the code or a real run. Real
  defects are fixed with a commit.
- When the implementer will not apply a finding, it replies once, in one line
  that starts with the disclosure line from `INSTRUCTIONS.md` and gives the
  reason. No further exchange on that thread.
- Two rounds at most. After the second, remaining non-blocking findings are
  left as they are.

## Maintainer feedback

The maintainer gives feedback privately in the PR's session, never as public
PR comments. The agent applies it and classifies it as a one-off or a rule. A
rule is added to the rubric, [writing.md](../standards/writing.md) or decision
rights in the same change. A question from the maintainer is a discussion, not
an instruction to change code.

During the trial the maintainer reads all code. Each remark is counted by
category. The trial ends when remarks per PR are few and none are blocking.
