# Releases (DRAFT)

> Describes the target process. Until the migration at the end of this file is
> done, releases still run on semantic-release with SemVer.

## Principles

- Releases are fully automated: a push to a branch produces a release.
- A human merges every PR that reaches users. No agent output ships without
  that merge.
- Version numbers say when, not what. Compatibility is stated in words.

## Channels

| Push to | Release | GitHub pre-release flag | Audience                          |
| ------- | ------- | ----------------------- | --------------------------------- |
| `dev`   | Beta    | Set                     | Users who opt in to betas in HACS |
| `main`  | Stable  | Not set                 | Everyone                          |

- Every merge to `dev` publishes a beta.
- `dev` is merged to `main` about weekly, after the release test.
- The `next` branch is retired.
- **A beta must never reach a user who has not opted in.** HACS offers a
  release flagged as a pre-release only to users who have enabled pre-releases
  for the card. The `dev` workflow therefore always sets the flag and never
  marks its release as "latest". This is checked before the first beta ships
  and is the one property of the release tooling that may not regress.
- The docs site is built from `main`, so it describes the stable release. Beta
  users read the PRs for what is new.

## Versioning

CalVer, `YYYY.M.N`: the year, the month without zero-padding, and a counter
that increases with every release in that month, beta or stable, and restarts
the next month. Tags are `v`-prefixed. The day is not part of the version:
three releases on one day are `2026.11.5`, `2026.11.6` and `2026.11.7`.

Betas and stable releases share the one counter, so stable numbers skip:

| Release                     | From   | Kind   |
| --------------------------- | ------ | ------ |
| `2026.11.4`                 | `main` | Stable |
| `2026.11.5` to `2026.11.10` | `dev`  | Beta   |
| `2026.11.11`                | `main` | Stable |

## Compatibility classes

Every PR is in exactly one class. A release lists every class present among
its PRs, most severe first.

| Class           | PR label          | What the user experiences                                                              |
| --------------- | ----------------- | -------------------------------------------------------------------------------------- |
| Compatible      | _(none)_          | Nothing.                                                                               |
| Behavior change | `behavior-change` | The card keeps working but behaves differently. Nothing to click.                      |
| Config upgrade  | `config-upgrade`  | The card shows an error until they open the editor, click Automatic Upgrade, and save. |
| Breaking        | `breaking`        | The card shows an error and they must edit their configuration by hand.                |

Upgrades run only from the editor, deliberately: every stored configuration is
valid for the version that reads it. A config upgrade is therefore a real cost
to users. Every config change is approved by the maintainer at plan time (see
[decision-rights.md](decision-rights.md)), which is where that cost is weighed.

**Behavior change** is a changed default, or any change where a user who has
not touched their configuration sees the card act differently. It requires the
docs to state the new default and the release note to say how to keep the old
behavior.

**Config upgrade** requires an entry in `UPGRADES`
(`src/config/management.ts`) covering overrides and profiles where relevant,
tests for it, and docs in the new shape only.

**Breaking** requires maintainer sign-off at plan time and a "what to do"
paragraph for the release notes. It is expected to be very rare.

### No batching

Config upgrades merge as soon as they are ready, in order, and go through the
beta like any other change. They are never held back to group them: holding
PRs puts work out of order, hides problems between PRs until release, and
discourages doing the right thing by the architecture. The weekly stable
release is the only grouping. A stable user may therefore be asked to upgrade
as often as once a week.

### Telling users

Every release's notes, beta and stable, open with a `Config impact` line for
each class present. It is never omitted, including when there is nothing to
do. The wording below is provisional, pending the maintainer's edit.

- `Config impact: none. No changes to your configuration are needed.`
- `Config impact: behavior change. <option> now defaults to <value>. Set it
explicitly to keep the old behavior.`
- `Config impact: automatic upgrade required. Open the card editor, click
Automatic Upgrade, and save. Until you do, the card shows an error.
Affected options: <options>.`
- `Config impact: manual changes required. <what to change, with before and
after>`

The line links to the user documentation that explains it. That page, part of
the published docs, covers: the stable and beta channels and how to opt in to
betas; what each of the lines means and what to do; and that an
automatic upgrade always needs the user to open the editor and save.

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
step, for example "on Android, the stream keeps playing after entering
fullscreen", and names the hardware it needs.

**A `MANUAL` change** stays on its own branch, kept rebased on `dev`. Before
asking for the maintainer's time the agent supplies screenshots at minimum,
default and maximum sizes and runs what it can itself. The in-person test plan
takes no more than five minutes; the agent cuts it to what only a person can
judge.

## The release test

- A standing PR from `dev` to `main` carries the checklist, built from the
  `verify:pre-release` PRs merged since the last stable release, deduplicated
  and ordered, with configs that validate against the schema.
- The maintainer runs it and merges the PR. The merge is the release.
- **Who performs a check.** First choice is the reporter: the agent asks them
  to try the beta, and their confirmation satisfies the check. Otherwise the
  maintainer performs it, provided [test-environment.md](test-environment.md)
  lists the hardware it needs.
- **Nothing ships unverified by default.** A check that nobody has performed
  is listed at the top of the release PR under "Not verified", with the reason.
  Whether to release with it outstanding is the maintainer's judgment, made by
  merging or not merging. An agent never waives a check.
- **Plan for this before merging to `dev`.** If a change's check needs hardware
  the maintainer does not have, the agent lines up the reporter first, or says
  so at plan time. A change is not classed `AUTOMATED_FOR_PRE_RELEASE` with a
  check that has no one to perform it.
- **Time budget.** The release test takes the maintainer no more than ten
  minutes. If the checks would exceed that, the agent ranks them by risk and
  the remainder appear under "Not verified".
- **Expensive setups are avoided.** Casting and iPhone emulation cost far more
  than their minutes suggest. A check needs one of them only when nothing
  cheaper would show the same thing, and says why.
- **A failed check is fixed by rolling forward**, never by reverting. The fix
  goes to the front of the queue, merges to `dev`, and only the failed check is
  re-run. The stable release waits for it; betas continue.
- **Hotfix.** A `regression` at `P0` does not wait for the weekly release. Its
  fix merges to `dev` as usual and is also put onto `main` by itself, so that
  the unvalidated work on `dev` is not promoted with it. Its verification
  class decides what must happen first: `AUTOMATED_FOR_RELEASE` needs nothing
  more; `AUTOMATED_FOR_PRE_RELEASE` needs its one check run.

## Migration from semantic-release

One-off. Remove this section when done.

1. **Tool:** release-it with `@csmith/release-it-calver-plugin`
   (`cycle: month`), replacing semantic-release. An established tool was
   chosen over a hand-written workflow; the semantic-release CalVer plugin was
   read and rejected as broken.
2. **Dry run first**, to confirm what could not be confirmed by reading:
   - Done: stable versions increment correctly. The plugin ignores release-it's
     prerelease option, so betas are plain versions flagged as pre-releases
     (see Channels). The plugin will not bump from `8.2.0`: the first CalVer
     tag is created by hand, after which it continues correctly.
   - that a release from `dev` is flagged as a pre-release and is not offered
     by HACS to a user who has not opted in;
   - "resolved in version" comments on released issues and PRs;
   - that HACS orders `2026.x` above `8.x`.
3. If release-it cannot meet the opt-in requirement, that returns to the
   maintainer as a decision. It is not filled with custom code.
4. Add the `behavior-change`, `config-upgrade`, `verify:pre-release` and `verify:manual` labels;
   narrow `breaking` to "manual changes required"; generate release notes from
   labels with the `Config impact` line first.
5. Rewrite the release sections of `docs/developing.md` and the "too many
   releases" FAQ entry: stable users now get about one release a week; the
   per-merge cadence continues on the beta channel. Add the user page on
   releases and config impact described under "Telling users", and link the
   `Config impact` line to it.
6. This change is one-way: after `2026.x`, a return to `9.x` would sort as a
   downgrade.
