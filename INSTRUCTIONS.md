# Advanced Camera Card

## Stack & Workflow

TypeScript (strict), Lit v3, Zod, Vitest, Vite, Yarn.

Commands: `yarn install`, `yarn run build`, `yarn run test`, `yarn run test:browser`, `yarn run coverage`, `yarn run typecheck`, `yarn run format`, `yarn run lint`, `yarn run prune`, `yarn run docs-check-links`.

How agents work on this project, what they decide alone, and the full review standards are in [`.agents/`](.agents/README.md). Read the document your task needs:

- [`.agents/decision-rights.md`](.agents/decision-rights.md) -- before asking the maintainer anything.
- [`.agents/review-rubric.md`](.agents/review-rubric.md) -- before presenting or reviewing a change.
- [`.agents/releases.md`](.agents/releases.md) -- for any change to config, or to how a change is verified.
- [`.agents/product-stance.md`](.agents/product-stance.md) -- for triage and feature proposals.

## Code Style

- Conventional Commits.
- US English spelling in code, comments and docs.
- Comments explain **why**, not what -- only when intent isn't obvious from code. Short, present tense, no history of the bug.
- Use words the codebase already uses. Do not coin terms in code, comments or test names.

## TypeScript

- `interface` for object structures; `type` for unions/intersections.
- Never use `any`; use `unknown` or generics.
- Never use type assertions (`as`); fix the type instead. `as const` is the exception. In tests, use `assert` from `vitest` for type narrowing.
- Never use non-null assertions (`!`); null-check with early return instead.
- `noUnusedParameters` and `noImplicitReturns` are enforced.
- Return and store `null` (not `undefined`) for absent values. Optional properties and parameters use `?`, not `| null`.
- `async`/`await` over `.then()` chains.
- `Date` objects over raw `Date.now()`.

## Testing

- `mock<T>()` from `vitest-mock-extended` for type-safe mocks.
- Test files: `*.test.ts` under `tests/`, mirroring source hierarchy.
- 100% coverage required for: `camera-manager/`, `card-controller/`, `components-lib/`, `config/`, `conditions/`, `ha/`, `utils/`, `view/`. Web components (`components/*`) exempt; push logic into `components-lib/` controllers.
- Layout, CSS, focus and real-media behavior get a `*.browser.test.ts` test.
- Reuse factories from `tests/test-utils.ts` (`createHASS()`, `createCameraConfig()`, etc.).
- Test names are "should ..." sentences describing observable behavior, not internals.
- A regression test must fail without the fix.

## Architecture

- **Reuse before building:** search the repository for an existing primitive, and search for an established external tool, before writing one. Hand-rolling needs a strong justification and a readiness to defend the choice.
- **Lowest level that works:** new code and state live at the lowest, most isolated level that works. Widen only when a second user appears.
- Consolidate duplicate logic when adding helpers; don't leave redundant inline expressions.
- **Naming consistency:** Renames span all layers -- schema, types, CSS, localization keys, templates, docs. All schema fields must appear in the documentation table.
- **Separation of concerns:** `components/` renders only; logic in `components-lib/` controllers (using `ReactiveController` where needed).
- **Manager pattern:** `CardController` orchestrates managers (`ConfigManager`, `HASSManager`, `ViewManager`, etc.). Prefer an existing owner; add a manager only when none fits, and say why.
- **Module conventions:** `types.ts` for types/schemas, `*-manager.ts` for coordinators, `*-controller.ts` for logic, `utils/` for helpers.

## Preferences

- Think through UX states and edge cases **before** writing code.
- Fix the cause at the component that owns the state, not the symptom where it shows.
- No re-exports or pass-through files -- import from source directly.
- Derive TypeScript types from Zod schemas (`z.infer<typeof schema>`); no parallel interfaces.
- User-facing schemas: only user-configurable fields. Internal fields go in a derived interface (`interface InternalFoo extends Foo { ... }`).
- Shared schemas go in `config/schema/common/` from the start.
- Name fields for semantic purpose, not implementation detail.
- Every config change is proposed to the maintainer before code is written.
- Comment headings must reflect all items in the section.
- Verify CSS cascade (e.g. `pointer-events`) before adding interactive children.
- Preserve alphabetical ordering when inserting into sorted lists/sections.
- Prefer structural CSS selectors (`.parent child-element`) over permanently-enabled classes.

## Posting on GitHub

Anything an agent posts under the maintainer's name -- a comment, reply, review or PR description -- starts with this line, alone: `_Posted by an AI agent on behalf of the maintainer._`

## Review guidelines

For any agent reviewing a pull request in this repository:

- Review the diff only. Do not report on code the change did not touch.
- Report only findings that are blocking under Tier 2 of [`.agents/review-rubric.md`](.agents/review-rubric.md), each with a concrete failure scenario: the inputs or state, then the wrong outcome.
- Do not report anything listed under Tier 3 of that file: hardening for cases bounded by construction, alternative internal names, refactors of untouched code, or fixes that would add config or API surface.
- Check that the PR's compatibility and verification labels match the change (see [`.agents/releases.md`](.agents/releases.md)).
