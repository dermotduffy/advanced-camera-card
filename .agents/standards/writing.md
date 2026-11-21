# Writing (DRAFT)

Applies to every piece of prose an agent writes: code comments, docs, test
names, identifiers, commit and PR text, and replies to users. The standard is
that a native English speaker who has not seen the code understands it on
first reading, and would have phrased it the same way.

## Rules

- One idea per sentence. Split a sentence rather than joining ideas with "and"
  or a trailing clause.
- Nothing that depends on context the reader does not have: "as it does", "as
  before", "this", "the above", "now". Say what is meant.
- Say who does what: the card, the browser, Home Assistant, the user.
- Plain words. Use the codebase's existing vocabulary; never coin a term.
- A name says what the thing is or returns.
- Read it aloud. If it sounds like a translation, rewrite it.

## The prose check

Run the check after the self-audit and before review. Also run it on every
reply or PR text before it is posted.

1. Collect only the prose the change adds or alters: comments, docs lines, test
   names, new identifiers, PR or reply text.
2. Give it to a fresh-context agent, with this file, **without the code**.
   Reading without the code is the point. It exposes awkwardness that the
   author cannot see.
3. For each item, the agent says whether it passes the standard above. If not,
   it proposes a rewrite.
4. The author applies the rewrites, or keeps the original with a one-line
   reason.

## Examples

Awkward lines next to the version that should have been written. Every prose
correction the maintainer makes is added here as a new pair, in the same
change that applies it.

| Written                                                                                                          | Should have been                                                                                 | Why                                                                                  |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `lazy_unload` stops the stream whenever the camera is not visible, and the card keeps its last frame as it does. | `lazy_unload` stops the stream when the camera is hidden. The card keeps showing the last frame. | Two ideas in one sentence; "as it does" depends on context the reader does not have. |
