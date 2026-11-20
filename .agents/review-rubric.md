# Review rubric (DRAFT)

> Inferred from 29 merged contributor PRs (what was submitted versus what was
> merged) and 42 maintainer-steered agent sessions. A first draft for the
> maintainer to correct. Rules marked _(weak)_ rest on one or two examples.

`INSTRUCTIONS.md` holds the short always-loaded rules. This file adds what
those rules do not say, and sorts everything into three tiers:

- **Self-audit:** the implementer checks these before anyone else sees the
  change. They are where most review time has gone historically, and they are
  cheap to get right first time.
- **Blocking:** the reviewer may block on these, with a concrete failure
  scenario.
- **Follow-up:** worth noting, never worth blocking.

## Tier 1: self-audit before presenting

Go through every line you added.

### Comments

- Each comment earns its place. Delete any that restate the code.
- Short, present tense, plain words. Two or three lines at most.
- Say what the code does and why. Not the history of the bug, and not what
  would happen without the code.
- A comment explains the code it sits on, on its own line above that code.
- Where siblings need the same explanation, use the same wording or point to
  one central comment.
- If the maintainer has reworded a comment, keep the wording.

### Names

- Use words the codebase already uses. Do not coin terms, in code, comments or
  test names. Terms from an external spec or a design discussion do not count
  as existing vocabulary.
- A name describes what the thing returns or computes. If the computation
  changes, the name changes.
- Match siblings: a new config key, CSS variable, event or localization key is
  named by analogy with its nearest existing neighbor.
- Two near-synonymous names for different things is a design smell. Make the
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
  default is to leave it out. State the user-visible cost and the line count
  if you think it is worth keeping.
- Search for an existing primitive (cache, concurrency helper, constant,
  utility) before writing one.
- Inline single-use helpers and variables.
- No unexplained numbers. Derive them, or say why that value.
- Plain control flow. Remove branches and guards that cannot occur, unneeded
  optional chaining, and exports with no outside importer.
- Remove debug probes and abandoned alternatives before presenting.

### Style

- US English. No em-dashes.
- Optional interface properties and parameters use `?`, not `| null` or
  `| undefined`; optional parameters last. `null` is for returned absent
  values and stored state.
- Fix the type instead of casting. `as unknown as T` is a last resort.
- Several optional positional parameters become an options object. _(weak)_
- Run the formatter.

## Tier 2: blocking

### Correctness and design

- **Fix the cause at the component that owns the state**, not the symptom
  where it shows. No `!important` overrides or compensating events around
  another component's behavior.
- **When a fix exposes a class of bug, fix the sibling cases in the same
  change.** (Unrelated bugs are different: file an issue.)
- **Input and lifecycle edge cases are handled**: cancelled gestures, multiple
  pointers, re-entry, teardown order, state leaking across reused elements.
- **One owner per kind of state.** Before adding a manager or controller, show
  why an existing one cannot own it.
- **Logic lives in the layer that already dispatches that concern.** `card.ts`
  and components stay thin. A manager does not perform another manager's side
  effects.
- **Knowledge stays local.** Generic interfaces and events do not carry
  feature-specific fields or causes.
- **No assumptions about other components' behavior** that the types do not
  guarantee. Prefer making the type require it.
- **No module-scope mutable state.** Config and shared view items are replaced,
  not mutated.
- **The bug is shown to be real** (reproduced or measured) before complexity is
  added to fix it.
- **Old runtimes keep working**, Chromecast in particular. State what they see.

### Config and user-facing surface

- **A new option must be justified.** It fits an existing schema shape and
  applies everywhere that shape is used, not to one special case. Otherwise it
  is not added.
- **Options are named for what the user is doing**, not for the underlying API,
  and reuse the card's existing vocabulary.
- **Orthogonal behavior is its own key**, not a new enum mode.
- **A feature costs nothing unless configured.**
- **Each new option ships complete**: schema default, `en.json` strings, a row
  in the docs table, a line in the reference YAML. Editor support follows the
  precedent of neighboring options.
- **Docs describe current behavior everywhere it is mentioned.** Stale caveats
  on usage and troubleshooting pages are removed in the same change. Worked
  examples go in `docs/examples.md` and are linked from the option's row.
- **The compatibility class is correct** (see
  [compatibility.md](compatibility.md)).

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

## Proposed edits to `INSTRUCTIONS.md`

These lines conflict with observed practice and should be reconciled by the
maintainer:

- `yarn run build` is listed as a workflow command, but agents are told not to
  run it in the maintainer's working tree.
- "Return `null` (not `undefined`) for absent values" needs scoping to return
  values, with `?` for optional properties and parameters.
- "New cross-cutting concerns → new manager" reads as encouragement; practice
  is to resist new managers unless no existing owner fits.
- "`as unknown as T`" is listed as acceptable; practice is to fix the type.
- Browser tests are not mentioned.
