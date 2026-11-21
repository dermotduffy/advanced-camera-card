# Triage (DRAFT)

How issues are labeled, prioritized, investigated and answered. The public
explanation of this for users is [`docs/ai.md`](../docs/ai.md); keep the two in
step.

## Priority

The triage agent sets `P0` to `P3`, and agents pick work in that order, so this
is a judgment about what gets built. Weigh:

- How many users are affected. A new Home Assistant, Frigate or go2rtc release
  that breaks something for many users outranks an older bug with more votes.
- Whether it is a regression.
- Votes on the top post.
- Fit with the [product stance](product-stance.md).

The maintainer overrides with a label at any time.

## Investigation

Every bug is investigated before anything is concluded about it. The agent
tries to reproduce the problem from the reporter's config and diagnostics, as a
unit or browser test.

| Outcome                                              | Evidence                              | What happens                                      |
| ---------------------------------------------------- | ------------------------------------- | ------------------------------------------------- |
| Reproduced                                           | A failing test                        | Into the implement queue, with the test attached. |
| Passes on `dev`, fails on the reported version       | The test run on both                  | Reply C, close.                                   |
| Works as designed, and a config achieves the request | A config validated against the schema | Reply B.                                          |
| Not reproducible, with a specific hypothesis         | The attempt                           | Reply F, label `waiting`.                         |
| Not reproducible, no diagnostics                     | None                                  | Reply A, label `waiting`.                         |
| Looks upstream                                       | The mechanism and where it belongs    | Recommendation to the maintainer.                 |
| Needs hardware or a setup that cannot be simulated   | What was tried                        | Stays open, labeled, low priority.                |

The existing backlog is drained the same way, in batches, starting with the ten
most recent bugs to measure the cost and the split of outcomes.

## Replies an agent may post without asking

Each needs its evidence. Without it, the reply becomes a recommendation to the
maintainer. Every reply starts with the disclosure line from `INSTRUCTIONS.md`.

| #   | Reply                                                      | Condition                                                      | Required evidence                                                                       |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| A   | A request for card diagnostics, with the docs link         | A bug report without diagnostics                               | None                                                                                    |
| B   | "This is already possible", with a config and docs link    | The request is met by existing options                         | The config validates against the schema, and a test or existing doc example confirms it |
| C   | "Fixed in version X"                                       | A test fails on the reported version and passes on the current | Both test runs                                                                          |
| D   | "Duplicate of #N", closing as duplicate                    | Same symptom and same cause as an open issue                   | The link and a one-line reason they match                                               |
| E   | A request to open a new issue with diagnostics             | A comment raises an unrelated problem on an existing issue     | None                                                                                    |
| F   | Up to three specific questions, optionally a config to try | Not reproducible, and there is a specific hypothesis           | Each question tied to the hypothesis; any config validates against the schema           |

Rules for F:

- Questions only. No conclusions, blame, promises, or anything about whether or
  when something will be fixed.
- Two rounds of questions on one issue at most. Then it goes to the maintainer
  with everything gathered.
- The daily run notices the reporter's answer and resumes the investigation.

**Warm-up:** the first twenty or so replies are shown to the maintainer before
posting. After that they post directly and appear in the daily digest.

**A reporter who asks for a human gets one.** The agent stops replying on that
issue and passes it to the maintainer.

## Always the maintainer's

- Declining a feature request.
- Saying something is an upstream problem.
- Closing anything as not planned or stale.
- Anything addressed to a contributor about their PR.
- Any reply that is not A to F.

Recommendations for these go in the daily digest, each with its evidence and a
drafted reply in the maintainer's voice (see the voice notes in
[product-stance.md](product-stance.md)).
