# Advanced Camera Card

## Stack & Workflow

TypeScript (strict), Lit v3, Zod, Vitest, Rollup, Yarn.

Commands: `yarn install`, `yarn run build`, `yarn run test`, `yarn run coverage`, `yarn run format`, `yarn run lint`, `yarn run prune`, `yarn run docs-check-links`.

## Code Style

- Conventional Commits (used by semantic-release).
- Comments explain **why**, not what — only when intent isn't obvious from code.

## TypeScript

- `interface` for object structures; `type` for unions/intersections.
- Never use `any`; use `unknown`, generics, or `as unknown as T`. In tests, use `assert` from `vitest` for type narrowing.
- Never use non-null assertions (`!`); null-check with early return instead.
- `noUnusedParameters` and `noImplicitReturns` are enforced.
- Return `null` (not `undefined`) for absent values.
- `async`/`await` over `.then()` chains.
- `Date` objects over raw `Date.now()`.

## Testing

- `mock<T>()` from `vitest-mock-extended` for type-safe mocks.
- Test files: `*.test.ts` under `tests/`, mirroring source hierarchy.
- 100% coverage required for: `camera-manager/`, `card-controller/`, `components-lib/`, `config/`, `conditions/`, `ha/`, `utils/`, `view/`. Web components (`components/*`) exempt; push logic into `components-lib/` controllers.
- Reuse factories from `tests/test-utils.ts` (`createHASS()`, `createCameraConfig()`, etc.).
- Test names describe observable behavior, not internals.

## Architecture

- Consolidate duplicate logic when adding helpers; don't leave redundant inline expressions.
- **Naming consistency:** Renames span all layers — schema, types, CSS, localization keys, templates, docs. All schema fields must appear in the documentation table.
- **Separation of concerns:** `components/` renders only; logic in `components-lib/` controllers (using `ReactiveController` where needed).
- **Manager pattern:** `CardController` orchestrates managers (`ConfigManager`, `HASSManager`, `ViewManager`, etc.). New cross-cutting concerns → new manager.
- **Module conventions:** `types.ts` for types/schemas, `*-manager.ts` for coordinators, `*-controller.ts` for logic, `utils/` for helpers.

## Preferences

- Think through UX states and edge cases **before** writing code.
- No re-exports or pass-through files — import from source directly.
- Derive TypeScript types from Zod schemas (`z.infer<typeof schema>`); no parallel interfaces.
- User-facing schemas: only user-configurable fields. Internal fields go in a derived interface (`interface InternalFoo extends Foo { ... }`).
- Shared schemas go in `config/schema/common/` from the start.
- Name fields for semantic purpose, not implementation detail.
- Comment headings must reflect all items in the section.
- Verify CSS cascade (e.g. `pointer-events`) before adding interactive children.
- Preserve alphabetical ordering when inserting into sorted lists/sections.
- Prefer structural CSS selectors (`.parent child-element`) over permanently-enabled classes.
