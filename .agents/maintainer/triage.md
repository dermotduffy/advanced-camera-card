# Triage (DRAFT)

How issues are labeled, prioritized, investigated and answered. The public
explanation for users is [`docs/ai.md`](../../docs/ai.md). Keep the two in step.

## Priority

The triage agent sets a priority from `P0` to `P3`. Agents pick work in that
order, so setting a priority is a judgment about what gets built. Weigh:

- How many users are affected. A new Home Assistant, Frigate or go2rtc release
  that breaks something for many users outranks an older bug with more votes.
- Whether it is a regression.
- Votes on the top post.
- Fit with the [product stance](product-stance.md).

The maintainer can override the priority with a label at any time.

## Investigation

An agent investigates every bug before concluding anything about it. It tries
to reproduce the problem as a unit or browser test, from the reporter's config
and diagnostics.

| Outcome                                              | Evidence                              | What happens                                               |
| ---------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| Reproduced                                           | A failing test                        | Reply G. Into the implement queue, with the test attached. |
| Passes on `dev`, fails on the reported version       | The test run on both                  | Reply C, close.                                            |
| Works as designed, and a config achieves the request | A config validated against the schema | Reply B.                                                   |
| Not reproducible, with a specific hypothesis         | The attempt                           | Reply F, label `waiting`.                                  |
| Not reproducible, no diagnostics                     | None                                  | Reply A, label `waiting`.                                  |
| Looks upstream                                       | The mechanism and where it belongs    | Recommendation to the maintainer.                          |
| Needs hardware or a setup that cannot be simulated   | What was tried                        | Stays open, labeled, low priority.                         |

Agents work through the existing backlog the same way, in batches. The first
batch is the ten most recent bugs, to measure the cost and the split of
outcomes.

## Replies an agent may post without asking

Each reply needs its evidence. Without the evidence, the reply becomes a
recommendation to the maintainer. Every reply starts with the disclosure line
from `INSTRUCTIONS.md`. How to write replies is in
[user-replies.md](user-replies.md).

| #   | Reply                                                      | Condition                                                      | Required evidence                                                                       |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| A   | A request for card diagnostics, with the docs link         | A bug report without diagnostics                               | None                                                                                    |
| B   | "This is already possible", with a config and docs link    | The request is met by existing options                         | The config validates against the schema, and a test or existing doc example confirms it |
| C   | "Fixed in version X"                                       | A test fails on the reported version and passes on the current | Both test runs                                                                          |
| D   | "Duplicate of #N", closing as duplicate                    | Same symptom and same cause as an open issue                   | The link and a one-line reason they match                                               |
| E   | A request to open a new issue with diagnostics             | A comment raises an unrelated problem on an existing issue     | None                                                                                    |
| F   | Up to three specific questions, optionally a config to try | Not reproducible, and there is a specific hypothesis           | Each question tied to the hypothesis; any config validates against the schema           |
| G   | "Reproduced, and queued for a fix"                         | The investigation reproduced the bug                           | The failing test. No date is given.                                                     |

Rules for F:

- Questions only. No conclusions, blame, promises, or anything about whether or
  when something will be fixed.
- At most two rounds of questions on one issue. After that, the issue goes to
  the maintainer with everything gathered.
- The daily run notices the reporter's answer and resumes the investigation.

**Warm-up:** the maintainer sees the first twenty or so replies before they are
posted. During the warm-up, an agent makes no public change of any kind until
the maintainer approves it. That means no comment, no label, no pushed branch,
no PR, and no commit message that mentions an issue number. Each of those shows
on the issue. Everything stays inside the agent's session.

- Each run ends with one digest in its session: per issue, the outcome, the
  evidence (a failing test is shown as a diff, not pushed), and the reply
  exactly as it would be posted.
- The maintainer approves, edits or rejects each item there. Only approved
  items are then posted, labeled or pushed.
- The maintainer finds the digest in the Claude app's list of sessions awaiting
  input. The `needs-maintainer` label is not used during the warm-up, because
  it is public.

After the warm-up, replies in the fixed classes are posted directly. They also
appear in the daily digest. The first batch of ten backlog investigations falls inside
the warm-up.

**A reporter who asks for a human gets one.** The agent stops replying on that
issue and passes it to the maintainer.

## Always the maintainer's

- Declining a feature request.
- Saying something is an upstream problem.
- Closing anything as not planned or stale.
- Anything addressed to a contributor about their PR, other than the fixed
  replies in [contributions.md](contributions.md).
- Any reply that is not A to G.

Recommendations for these go in the daily digest. Each has its evidence and a
draft reply that follows [user-replies.md](user-replies.md).
