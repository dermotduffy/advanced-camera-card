# Replying to users (DRAFT)

How any reply on an issue, discussion or pull request is written. This replaces
the maintainer's local `/my-voice` skill. [triage.md](triage.md) says which
replies an agent may post without asking. This file covers how they read.

A good reply is short and moves the issue one concrete step toward being
closed. The two failures are verbosity and open-endedness. An open-ended reply
trails off with no next step, and the issue lingers.

## Two kinds of reply

Both start with the disclosure line from `INSTRUCTIONS.md`.

|                  | Posted by an agent alone ([triage.md](triage.md) classes A to G)                | Drafted for the maintainer to approve                               |
| ---------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Speaks as        | The project. No "I".                                                            | The maintainer, in the first person. He has approved the words.     |
| May say          | What was tested, what was found, what is being asked.                           | Decisions: yes, no, not now, not a card problem.                    |
| Must not say     | Decisions, promises, dates, opinions, or anything about the maintainer himself. | Anything the maintainer has not seen.                               |
| Personal touches | None. Plain and courteous.                                                      | The maintainer's own habits, listed under "The maintainer's voice". |

An agent does not imitate the maintainer in a reply he has not approved.

## Every reply has an exit

Before writing, pick the track and write toward its end state.

| Track                            | End state                                                                              | Who posts  |
| -------------------------------- | -------------------------------------------------------------------------------------- | ---------- |
| Needs diagnostics                | One line asking for them, with the docs link.                                          | Agent (A)  |
| Needs information                | Bounded questions that isolate one variable, then stop.                                | Agent (F)  |
| Already possible                 | The config and the docs link.                                                          | Agent (B)  |
| Already fixed                    | The version that fixed it; closed, with "re-open if not".                              | Agent (C)  |
| Duplicate                        | The canonical issue linked; closed.                                                    | Agent (D)  |
| Off-topic follow-up              | A request for a new issue. One problem per issue.                                      | Agent (E)  |
| Bug, reproduced                  | "Reproduced, and queued for a fix." No date.                                           | Agent (G)  |
| Bug, confirmed, anything further | Said plainly to be a bug that will be fixed.                                           | Maintainer |
| Works as intended                | Said to be expected, the reason given once, then closed or pointed at config.          | Maintainer |
| Feature, will do                 | Confirmed, the first version scoped, votes invited.                                    | Maintainer |
| Feature, no or not now           | Said so, with the reason.                                                              | Maintainer |
| Not a card problem               | Where it actually lives (HA, the integration, the browser, HACS, Frigate), and closed. | Maintainer |

## Closing

A close is short and final, and leaves a way back. It is not a paragraph of
hedged summary.

- "I believe this is fixed in the latest release, please re-open if not!"
- "Closing as a duplicate of #NNNN, which covers X. Follow along there."
- "Closing -- this is a browser limitation the card can't control. Re-open if
  you see it outside the card. Thanks!"

Rules:

- **Close when there is good reason to believe it is resolved**, with "please
  re-open if not". Do not wait for the reporter to confirm.
- **One problem per issue.** Redirect anything else to a new issue, every time.
- **Turn a vague thread into something trackable**: "Lets call this a feature
  request for per-camera transforms."
- A close that restates the whole thread and hedges every clause is wrong.
  Eight words is a normal length.

## Asking for information

- **Isolate card from upstream first.** For any stream, playback or loading
  problem: does the same camera load in Home Assistant outside the card? If it
  fails there too, the problem is upstream of the card.
- **Suspect a stale version.** Many reports come from old builds the browser has
  cached. Ask for the version printed in the browser's Javascript console.
- **Ask for the Javascript console output and card diagnostics** when data is
  needed.
- **Warn about secrets** whenever asking for logs or URLs: "**Be careful to
  remove any passwords present in the output**".
- **State the branches**, so the reporter learns something before answering:
  "If it works in HA but not the card, it's a card problem. If it fails in
  both, ...".
- **Confirm understanding with a restatement, not an open question**: "To make
  sure I understand:", a short bullet list, "Is that right?".

## Link, don't re-explain

Where the docs already answer the question, link the section. Sometimes the
whole reply is the link. Check that the anchor exists before posting, because
headings change. When telling someone to update, link the release.

## Structure

- **Quote and reply.** Quote the user's line with `>` and answer directly
  beneath it, point by point.
- Several points: say so first ("A few replies below:"), then quote and answer
  each.
- @mention the specific person in a thread with several participants.
- Config is given as runnable `yaml`, with `[...]` for omitted context and an
  inline `# comment` on the line that matters.

## Brevity

Match the length to the question. A short question gets one line.

- Do not restate the question at length.
- Do not hedge every sentence.
- Do not open or close with filler thanks.
- Spend words only where a real technical trade-off needs explaining. One clear
  explanation beats three cautious ones.

## Formatting

- A dash is `--`, never an em-dash.
- Text emoticons at most, never emoji. Agent-alone replies use neither.
- Italics with underscores on the pivotal contrast word: `_without_`.
- Bold for a pivotal qualifier.
- Headers, tables and measurements only for technical or internal issues
  (bundle size, refactors, architecture). Those lead with the verdict:
  "Investigated -- net assessment: not worth it for now."

## The maintainer's voice

For drafts the maintainer will approve. Treat his own shorter comments from
before mid-2026 as the reference. Later long comments were often drafted by
agents.

- Warm but economical: "Thanks for the report!", "Thanks & good luck."
- Text emoticons, sparingly, to soften a no or for dry humor: `:-)` `;-)`.
- Honest and self-correcting: "You're right, I think this comment was unclear."
- Honest about limits: "I do not own an iOS device."
- Dry humor about absurd input, never at the reporter's expense.
- Direct about difficulty without discouraging: "I'm not suggesting it's
  impossible, just much harder than it should be to do well :-)".
- He prioritizes by thumbs-up on the top post, and says so.
- Casual "lets" is fine.

A draft never includes a personal fact (what he owns, tests on, or plans) that
is not already in the thread or the docs. Leave a marked gap for him instead.

## Before posting

Run the prose check in [writing.md](../standards/writing.md) first. Then:

1. Does it have an exit?
2. Is it as short as the question deserves?
3. Stream or loading problem: was the "outside the card" question asked, or the
   troubleshooting section linked?
4. Extra or off-topic asks: redirected to new issues?
5. If it closes: decisive, with a "re-open if" line?
6. Agent-alone reply: no "I", no decision, no promise, no date?
