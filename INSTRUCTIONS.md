# AI Project Instructions: Advanced Camera Card

## Core Tech Stack

- **Language:** TypeScript (Strict Mode)
- **Package Manager:** Yarn
- **Test Runner:** Vitest
- **UI Framework:** LitElement (Lit v3)
- **Config/Validation:** Zod
- **Build System:** Rollup

## Development Workflow

- **Install Dependencies:** `yarn install`
- **Build Project:** `yarn run build`
- **Run Tests:** `yarn run test`
- **Run Tests (Coverage):** `yarn run coverage`
- **Format:** `yarn run format`
- **Lint:** `yarn run lint`
- **Prune**: `yarn run prune`
- **Check doc link validity**: `yarn run docs-check-links`

## Code Style

- Prettier enforces: 89-char line width, single quotes, trailing commas, 2-space indent, semicolons.
- Commits must follow the **Conventional Commits** format (used by semantic-release).
- Comments explain **why**, not what. Only add a comment when the intent behind a decision would not be obvious from the code itself.

## Coding Standards & Patterns

- **TypeScript:**

  - Prefer `interface` for object structures; `type` for unions/intersections.
  - Avoid `any` at all costs (in both source and tests); use `unknown`, proper generics, or `as unknown as T` for unavoidable type coercions. In tests, use `assert` (imported from `vitest`) for type narrowing.
  - Never use non-null assertions (`!`); use a null check with an early return or conditional instead.
  - Use `zod` for runtime validation if external data is involved.
  - `noUnusedParameters` and `noImplicitReturns` are enforced — all parameters must be used and all code paths must return.
  - Prefer explicitly returning `null` rather than `undefined` for absent or empty state values.
  - Prefer `async`/`await` over verbose Promise chaining (`.then().catch()`).
  - Prefer instantiating `Date` objects for timestamps rather than using raw numbers (e.g. `Date.now()`).

- **Testing (Vitest):**

  - Follow the **Arrange-Act-Assert (AAA)** pattern.
  - Mock external dependencies using `vi.mock()`.
  - Use `vi.spyOn()` for monitoring method calls without destroying original behavior.
  - Use `mock<T>()` from `vitest-mock-extended` for type-safe interface/class mocks.
  - For time-sensitive tests, use `vi.useFakeTimers()` / `vi.setSystemTime()` and restore with `vi.useRealTimers()` in `afterEach`.
  - Test files must be named `*.test.ts` and reside in a matching file under the `tests/` hierarchy. The source and test file hierarchy must match.
  - 100% coverage is required for all business logic layers: `camera-manager/`, `card-controller/`, `components-lib/`, `config/`, `conditions/`, `ha/`, `utils/`, `view/`. New web components (`components/*`) are exempt; put as much non-render logic as possible in a matching controller under `components-lib/`.
  - Reuse shared test factories from `tests/test-utils.ts` (e.g. `createHASS()`, `createCameraConfig()`, `createFrigateEvent()`) rather than building ad-hoc test data inline.
  - Test names describe observable behavior from the caller's perspective, not the internal mechanism used.

- **Lit / CSS:**

  - Prefer structural CSS selectors (e.g. `.parent child-element`) over permanently-enabled classes. Never use `classMap` with always-true entries — style via the element's DOM context instead.

- **Architecture:**
  - Keep functions small and "pure" where possible.
  - Favor composition over inheritance.
  - Readability and simple understandable code is extremely important.
  - When adding a new helper or method, check whether the same logic already exists inline elsewhere in the same file and consolidate. Don't leave duplicate expressions after introducing an abstraction.
  - **Naming consistency:** When renaming or adding a concept, align the name across all layers: config schema, TypeScript types/interfaces, CSS classes/selectors, localization keys, template references, and documentation. A rename in one layer means a rename in all layers. All schema fields must appear in the corresponding documentation table.
  - **Separation of concerns:** Web components (`components/`) handle rendering only; business logic belongs in matching controllers under `components-lib/`. Controllers implement Lit's `ReactiveController` pattern where needed.
  - **Manager pattern:** `CardController` (`card-controller/controller.ts`) orchestrates specialized managers (e.g. `ConfigManager`, `HASSManager`, `ViewManager`). New cross-cutting concerns belong in a new manager.
  - **Module conventions:** Within each module use `types.ts` for type/schema definitions, `*-manager.ts` for coordinators, `*-controller.ts` for logic controllers, and a `utils/` subdirectory for helpers.

## AI Collaboration Preferences

- **Think through UX before implementing.** For any user-visible change, reason through the full set of states and edge cases it touches. Flag them before writing code, not after.

- **Be concise.** Short, direct answers are preferred. Skip preamble, avoid restating the question, and don't summarize what you just did unless asked.

- **No re-exports or pass-through files.** Have callers import directly from the source module. Don't create files that only re-export from another file.

- **Single source of truth for types.** When a Zod schema defines a shape, derive the TypeScript type from it (`z.infer<typeof schema>`). Don't maintain a parallel interface that duplicates the schema.

- **Separate external API from internal extensions.** User-facing schemas should only contain user-configurable fields. For internal-only fields, create a derived interface (e.g. `interface InternalFoo extends Foo { internalField?: ... }`). Never expose internal plumbing in external schemas.

- **Extract shared schemas eagerly.** If a schema (e.g. `iconSchema`) could apply to multiple features, put it in `config/schema/common/` from the start rather than nesting it under a specific feature.

- **Name fields for their semantic purpose.** Choose names that reflect what the field means in context. Ask yourself what the field actually does.

- **Accurate comment headings.** If a comment section covers multiple related items, the heading must reflect all of them — not just the first one added.

- **Check CSS inheritance before adding interactive elements.** Parent rules like `pointer-events: none` silently block children. When adding clickable items to a container, verify the full CSS cascade allows interaction.

- **Preserve alphabetical ordering.** When inserting into a list, file, or set of sections that is fully or mostly alphabetized, maintain that ordering.
