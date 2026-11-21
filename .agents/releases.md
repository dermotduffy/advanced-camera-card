# Releases (DRAFT)

> Describes the target process. Until the migration at the end of this file is
> done, releases still run on semantic-release with SemVer.

## Principles

- Releases are fully automated: a push to a branch produces a release.
- A human merges every PR that reaches users. No agent output ships without
  that merge.
- Version numbers say when, not what. Compatibility is stated in words.

## Channels

| Push to | Release | Audience                  | Example            |
| ------- | ------- | ------------------------- | ------------------ |
| `dev`   | Beta    | Users who opt in to betas | `2026.11.2-beta.3` |
| `main`  | Stable  | Everyone                  | `2026.11.2`        |

- Every merge to `dev` publishes a beta.
- `dev` is merged to `main` about weekly, after the release test.
- The `next` branch is retired.

## Versioning

CalVer, `YYYY.M.N`: the year, the month without zero-padding, and a counter
that restarts each month. Tags are `v`-prefixed.

## Compatibility classes

Every PR is in exactly one class. A release takes the most severe class among
its PRs.

| Class          | PR label         | What the user experiences                                                              |
| -------------- | ---------------- | -------------------------------------------------------------------------------------- |
| Compatible     | _(none)_         | Nothing.                                                                               |
| Config upgrade | `config-upgrade` | The card shows an error until they open the editor, click Automatic Upgrade, and save. |
| Breaking       | `breaking`       | The card shows an error and they must edit their configuration by hand.                |

Upgrades run only from the editor, deliberately: every stored configuration is
valid for the version that reads it. A config upgrade is therefore a real cost
to users. Every config change is approved by the maintainer at plan time (see
[decision-rights.md](decision-rights.md)), which is where that cost is weighed.

**Config upgrade** requires an entry in `UPGRADES`
(`src/config/management.ts`) covering overrides and profiles where relevant,
tests for it, and docs in the new shape only. A changed default counts when a
user who never set the option would see different behavior.

**Breaking** requires maintainer sign-off at plan time and a "what to do"
paragraph for the release notes. It is expected to be very rare.

Each release's notes open with one line:

- `Config impact: none.`
- `Config impact: open the card editor and click Automatic Upgrade (<options>).`
- `Config impact: manual changes required. <what to do>`

## Verification classes

Every PR is in exactly one class, chosen at plan time.

| Class                       | PR label             | Gate                                                               |
| --------------------------- | -------------------- | ------------------------------------------------------------------ |
| `AUTOMATED_FOR_RELEASE`     | _(none)_             | None beyond CI. May be promoted to stable untested by a human.     |
| `AUTOMATED_FOR_PRE_RELEASE` | `verify:pre-release` | Ships in the beta. Its check must pass in the weekly release test. |
| `MANUAL`                    | `verify:manual`      | The maintainer tests it in person before it merges to `dev`.       |

`AUTOMATED_FOR_RELEASE` is the default. Over the three months before this was
written, about 69% of merged changes would have been in it, 28% in
`AUTOMATED_FOR_PRE_RELEASE` and 3% in `MANUAL`. The weekly reports track the
split against that baseline.

**Choosing a higher class** requires a trigger from this list. Uncertainty is
not a trigger.

- `AUTOMATED_FOR_PRE_RELEASE`: behavior that depends on a real microphone or
  speaker; a named runtime (Chromecast, Android WebView, iOS Safari, the
  Companion app); a real camera stream or network path.
- `MANUAL`: a large visual redesign; a rework of a media or audio path. The
  design challenger must agree.

**An `AUTOMATED_FOR_PRE_RELEASE` PR** states its check as a single observable
step, for example "on Chromecast, the template renders".

**A `MANUAL` change** stays on its own branch, kept rebased on `dev`. Before
asking for the maintainer's time the agent supplies screenshots at minimum,
default and maximum sizes and runs what it can itself.

## The release test

- A standing PR from `dev` to `main` carries the checklist, built from the
  `verify:pre-release` PRs merged since the last stable release, deduplicated
  and ordered, with configs that validate against the schema.
- The maintainer runs it and merges the PR. The merge is the release.
- The checklist has a time budget. Checks beyond it are ranked by risk; the
  rest ship on the evidence of the beta.
- **A failed check is fixed by rolling forward**, never by reverting. The fix
  goes to the front of the queue, merges to `dev`, and only the failed check is
  re-run. The stable release waits for it; betas continue.
- A `regression` at `P0` is the exception to the weekly rhythm: it is verified
  alone and released at once.

## Migration from semantic-release

One-off. Remove this section when done.

1. **Tool:** release-it with `@csmith/release-it-calver-plugin`
   (`cycle: month`), replacing semantic-release. An established tool was
   chosen over a hand-written workflow; the semantic-release CalVer plugin was
   read and rejected as broken.
2. **Dry run first**, to confirm what could not be confirmed by reading:
   - beta prereleases from `dev` combined with CalVer versions;
   - the first release, which must be given its version explicitly because the
     plugin will not bump from `8.2.0`;
   - "resolved in version" comments on released issues and PRs;
   - that HACS orders `2026.x` above `8.x` and treats the beta form as a
     prerelease.
3. If betas cannot be done with release-it, that returns to the maintainer as
   a decision. It is not filled with custom code.
4. Add the `config-upgrade`, `verify:pre-release` and `verify:manual` labels;
   narrow `breaking` to "manual changes required"; generate release notes from
   labels with the `Config impact` line first.
5. Rewrite the release sections of `docs/developing.md` and the "too many
   releases" FAQ entry: stable users now get about one release a week; the
   per-merge cadence continues on the beta channel.
6. This change is one-way: after `2026.x`, a return to `9.x` would sort as a
   downgrade.
