# Review rubric (DRAFT)

> Inferred from 29 merged contributor PRs (what was submitted versus what was
> merged) and 42 maintainer-steered agent sessions, then corrected by the
> maintainer. Rules marked _(weak)_ rest on one or two examples.

`INSTRUCTIONS.md` holds the short always-loaded rules. This file adds the rest,
in three tiers:

- **Self-audit:** the implementer checks these before anyone else sees the
  change. Historically, most review time has gone on these.
- **Blocking:** the reviewer may block on these, with a concrete failure
  scenario.
- **Follow-up:** worth noting, never worth blocking.

If a lint rule or a test can enforce a rule in this file, it should. The rule
is then removed from this file.

## Tier 1: self-audit before presenting

Go through every line you added.

### Comments

- Each comment earns its place. Delete any that restate the code.
- Short, present tense, plain words. Two or three lines at most.
- Say what the code does and why. Not the history of the bug, and not what
  would happen without the code.
- A comment sits on its own line, directly above the code it explains.
- Where siblings need the same explanation, use the same wording or point to
  one central comment.
- If the maintainer has reworded a comment, keep the wording.

### Names

- Use words the codebase already uses. Do not coin terms in code, comments or
  test names. Terms from an external spec or a design discussion do not count
  as existing vocabulary.
- A name describes what the thing returns or computes. If the computation
  changes, the name changes.
- Match siblings: a new config key, CSS variable, event or localization key is
  named by analogy with its nearest existing neighbor.
- Giving different things near-synonymous names is a design smell. Make the
  difference obvious or merge them.
- Verbs are accurate: `fetchX` performs a request, `isX`/`hasX` are booleans in
  the positive sense the caller needs.
- Short names for local scope. Do not build a name around an incidental detail.
- Constants carry their unit: `_SECONDS`, `_PIXELS`. _(weak)_

### Tests

- Names are full "should ..." sentences describing desired behavior in words a
  newcomer understands.
- A regression test fails without the fix. Check that it does.
- A test exercises what its name claims, and asserts the outcome that matters
  rather than an incidental count.
- No test that is true by construction or repeats the previous one.
- `it.each` for parametrized cases; one behavior per test.
- Setup in the narrowest `describe`; `afterEach` for teardown; no unexplained
  numbers.
- `tests/test-utils.ts` holds general helpers only. Domain fixtures get their
  own file. Import existing constants and helpers instead of redefining them.
- Fix the factory, not the source, when a test harness lacks something.
- Do not test Zod or editor bindings for their own sake.
- No flaky tests. Find a deterministic way.

### Simplicity

- Every line and concept earns its keep. When polish costs complexity, the
  default is to leave it out.
- Inline single-use helpers and variables.
- No unexplained numbers. Derive them, or say why that value.
- Plain control flow. Remove branches and guards that cannot occur, unneeded
  optional chaining, and exports with no outside importer.
- Remove debug probes and abandoned alternatives before presenting.

### Style

- US English. No em-dashes.
- Optional interface properties and parameters use `?`, not `| null` or
  `| undefined`; optional parameters last. `null` is for returned and stored
  absent values.
- No type assertions with `as`. Fix the type. `as const` is the exception.
- Several optional positional parameters become an options object. _(weak)_
- Run the formatter.

## Tier 2: blocking

### Reuse before building

- **Search for an existing primitive in the repository** (cache, concurrency
  helper, constant, utility) before writing one.
- **Search for an established external tool** before building any tool, script
  or mechanism. Hand-rolling needs a strong justification and a readiness to
  defend the choice.

### Structure

Agents decide structure without the maintainer, by these rules.

- **New code and state live at the lowest, most isolated level that works.**
  Scope to the instance or the single module that needs it. Widen only when a
  second user appears, and say why.
- **One owner per kind of state.**
- **No new manager or controller unless no existing owner fits**, and the plan
  says why.
- **Logic lives in the layer that already dispatches that concern.** `card.ts`
  and components stay thin. A manager does not perform another manager's side
  effects.
- **Knowledge stays local.** Generic interfaces and events do not carry
  feature-specific fields or causes.
- **Sibling APIs have the same shape.** Subscribe implies unsubscribe.
- **No assumptions about other components' behavior** that the types do not
  guarantee. Prefer making the type require it.
- **Config and shared view items are replaced, not mutated.**
- **Where two designs remain after discussion, the one with fewer new concepts
  wins.**

### Correctness

- **Fix the cause at the component that owns the state**, not the symptom
  where it shows. No `!important` overrides or compensating events around
  another component's behavior.
- **When a fix exposes a class of bug, fix the sibling cases in the same
  change.** Unrelated bugs are different: file an issue.
- **Input and lifecycle edge cases are handled**: cancelled gestures, multiple
  pointers, re-entry, teardown order, state leaking across reused elements.
- **The bug is shown to be real** (reproduced or measured) before complexity is
  added to fix it.
- **Old runtimes keep working**, Chromecast in particular. State what users of those runtimes see.

### Config and user-facing surface

Every config change has already been approved by the maintainer at plan time.
The reviewer checks that what was built matches what was approved, and:

- **The option fits an existing schema shape** and applies everywhere that
  shape is used, not to one special case.
- **Options are named for what the user is doing**, not for the underlying
  API, and reuse the card's existing vocabulary.
- **Orthogonal behavior is its own key**, not a new enum mode.
- **A feature costs nothing unless configured.**
- **Each new option ships complete**: schema default, `en.json` strings, a row
  in the docs table, a line in the reference YAML. Editor support follows the
  precedent of neighboring options.
- **Docs describe current behavior everywhere it is mentioned.** Stale caveats
  on usage and troubleshooting pages are removed in the same change. Worked
  examples go in `docs/examples.md` and are linked from the option's row.

### Tests

- **Coverage requirements hold**; a `v8 ignore` states its reason.
- **Layout, CSS, focus and real-media behavior have a `*.browser.test.ts`
  test.** Prefer a permanent browser test to a manual check, adding a small
  harness capability if needed.

### CSS and accessibility

- Inherit Home Assistant theme variables and use `em`. Follow HA frontend
  conventions for visuals.
- Respect `prefers-reduced-motion` and the card's performance flags.
- State changes are exposed to assistive technology. _(weak)_

## Tier 3: follow-up only

- Hardening for corner cases that are bounded by construction.
- Alternative names for internal symbols that already follow Tier 1.
- Refactors of code the change did not touch.
- Anything whose fix would add config or API surface.
- Style points that contradict a Tier 1 rule or earlier maintainer feedback.

A reviewer finding in these categories is recorded and not acted on in the
change under review.
