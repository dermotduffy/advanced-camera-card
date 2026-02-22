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

## Coding Standards & Patterns

- **TypeScript:**

  - Prefer `interface` for object structures; `type` for unions/intersections.
  - Avoid `any` at all costs (in both source and tests); use `unknown`, proper generics, or `as unknown as T` for unavoidable type coercions. In tests, use `assert` (imported from `vitest`) for type narrowing.
  - Use `zod` for runtime validation if external data is involved.
  - `noUnusedParameters` and `noImplicitReturns` are enforced — all parameters must be used and all code paths must return.

- **Testing (Vitest):**

  - Follow the **Arrange-Act-Assert (AAA)** pattern.
  - Mock external dependencies using `vi.mock()`.
  - Use `vi.spyOn()` for monitoring method calls without destroying original behavior.
  - Use `mock<T>()` from `vitest-mock-extended` for type-safe interface/class mocks.
  - For time-sensitive tests, use `vi.useFakeTimers()` / `vi.setSystemTime()` and restore with `vi.useRealTimers()` in `afterEach`.
  - Test files must be named `*.test.ts` and reside in a matching file under the `tests/` hierarchy. The source and test file hierarchy must match.
  - 100% coverage is required for all business logic layers: `camera-manager/`, `card-controller/`, `components-lib/`, `config/`, `conditions/`, `ha/`, `utils/`, `view/`. New web components (`components/*`) are exempt; put as much non-render logic as possible in a matching controller under `components-lib/`.
  - Reuse shared test factories from `tests/test-utils.ts` (e.g. `createHASS()`, `createCameraConfig()`, `createFrigateEvent()`) rather than building ad-hoc test data inline.

- **Architecture:**
  - Keep functions small and "pure" where possible.
  - Favor composition over inheritance.
  - Readability and simple understandable code is extremely important.
  - **Separation of concerns:** Web components (`components/`) handle rendering only; business logic belongs in matching controllers under `components-lib/`. Controllers implement Lit's `ReactiveController` pattern where needed.
  - **Manager pattern:** `CardController` (`card-controller/controller.ts`) orchestrates specialized managers (e.g. `ConfigManager`, `HASSManager`, `ViewManager`). New cross-cutting concerns belong in a new manager.
  - **Module conventions:** Within each module use `types.ts` for type/schema definitions, `*-manager.ts` for coordinators, `*-controller.ts` for logic controllers, and a `utils/` subdirectory for helpers.
