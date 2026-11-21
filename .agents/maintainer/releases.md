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
  marks its release as "latest". This flag behavior is the one property of the
  release tooling that must not regress. The HACS behavior is assumed from how
  the `next` release candidates have behaved so far. It has not been tested.
  The first beta is watched for reports from users who did not opt in.
- The docs site is built from `main`, so it describes the stable release. Beta
  users read the PRs for what is new.

## Versioning

CalVer, `YYYY.M.N`: the year, the month without zero-padding, and a counter.
The counter increases with every release in the month, beta or stable. It
restarts each month. Tags are `v`-prefixed. The day is not part of the
version: three releases on one day are `2026.11.5`, `2026.11.6` and
`2026.11.7`.

Betas and stable releases share one counter, so stable numbers have gaps:

| Release                     | From   | Kind   |
| --------------------------- | ------ | ------ |
| `2026.11.4`                 | `main` | Stable |
| `2026.11.5` to `2026.11.10` | `dev`  | Beta   |
| `2026.11.11`                | `main` | Stable |

## Compatibility and verification classes

Every PR has a compatibility class and a verification class, defined in
[change-classes.md](../standards/change-classes.md). This file covers how
releases use them.

## Config upgrades in releases

### No batching

Config upgrades merge as soon as they are ready, in order, and go through the
beta like any other change. They are never held back to be released together.
Holding PRs back puts work out of order and hides problems between PRs until
release. It also discourages changes that are right for the architecture. The
weekly stable release is the only grouping. A stable user may therefore be asked to upgrade
as often as once a week.

### Telling users

Every release's notes, beta and stable, open with a `Config impact` line for
each class present. The line is never omitted, even when there is nothing to
do. The wording below is provisional until the maintainer edits it.

- `Config impact: none. No changes to your configuration are needed.`
- `Config impact: behavior change. <option> now defaults to <value>. Set it
explicitly to keep the old behavior.`
- `Config impact: automatic upgrade required. Open the card editor, click
Automatic Upgrade, and save. Until you do, the card shows an error.
Affected options: <options>.`
- `Config impact: manual changes required. <what to change, with before and
after>`

The line links to a page in the published user docs that explains it. That
page covers: the stable and beta channels and how to opt in to betas; what
each line means and what to do; and that an automatic upgrade always needs the
user to open the editor and save.

## The release test

- A standing PR from `dev` to `main` carries the checklist. The checklist is
  built from the `verify:pre-release` PRs merged since the last stable
  release. It is deduplicated and ordered, and its configs validate against
  the schema.
- The maintainer runs it and merges the PR. The merge is the release.
- **Who performs a check.** The first choice is the reporter. The agent asks
  them to try the beta, and their confirmation satisfies the check. Otherwise
  the maintainer performs it, provided
  [test-environment.md](test-environment.md) lists the hardware it needs.
- **Nothing ships unverified without the maintainer deciding so.** If the
  reporter has not confirmed within three days of being asked, and the
  maintainer cannot perform the check, the agent asks the maintainer to
  decide. The agent states what the check was for, what could go wrong for
  which users if it is skipped, and what evidence exists so far (tests, time
  on the beta, other reports). It also gives a recommendation. The maintainer
  chooses to release without the check, to wait longer, or something else. An
  agent never waives a check. A check skipped for a release is listed in the
  release PR under "Not verified".
- **Plan for this before merging to `dev`.** If a change's check needs hardware
  the maintainer does not have, the agent lines up the reporter before
  merging. Otherwise it says at plan time that the maintainer lacks the
  hardware. A change is not classed `AUTOMATED_FOR_PRE_RELEASE` if nobody can
  perform its check.
- **Time budget.** The release test takes the maintainer no more than ten
  minutes. If the checks would exceed that, the agent ranks them by risk.
  Checks that do not fit appear under "Not verified".
- **Expensive setups are avoided.** Casting and iPhone emulation cost far more
  than their minutes suggest. A check uses one of them only when nothing
  cheaper would show the same thing. Such a check says why.
- **A failed check is fixed by rolling forward**, never by reverting. The fix
  goes to the front of the queue and merges to `dev`. Only the failed check is
  re-run. The stable release waits for the fix; betas continue.
- **Hotfix.** A `regression` at `P0` does not wait for the weekly release. Its
  fix merges to `dev` as usual. It is also put onto `main` on its own, so that
  the unvalidated work on `dev` is not promoted with it. Its verification
  class decides what must happen first: `AUTOMATED_FOR_RELEASE` needs nothing
  more; `AUTOMATED_FOR_PRE_RELEASE` needs its one check run.

## Migration from semantic-release

One-off. Remove this section when done.

1. **Tool:** release-it with `@csmith/release-it-calver-plugin`
   (`cycle: month`), replacing semantic-release. An established tool was
   chosen over a hand-written workflow. The semantic-release CalVer plugin was
   reviewed and rejected as broken.
2. **Dry run first**, to confirm what could not be confirmed by reading:
   - Done: stable versions increment correctly. The plugin ignores release-it's
     prerelease option, so betas are plain versions flagged as pre-releases
     (see Channels). The plugin will not bump from `8.2.0`, so the first
     CalVer tag is created by hand. After that, the plugin continues
     correctly.
   - that release-it sets the pre-release flag on every release from `dev` and
     never marks one "latest";
   - "resolved in version" comments on released issues and PRs;
   - that HACS orders `2026.x` above `8.x`.
3. If release-it cannot meet the opt-in requirement, the maintainer decides
   what to do. The gap is not filled with custom code.
4. Add the `behavior-change`, `config-upgrade`, `verify:pre-release` and `verify:manual` labels;
   narrow `breaking` to "manual changes required"; generate release notes from
   labels with the `Config impact` line first.
5. Rewrite the release sections of `docs/developing.md` and the "too many
   releases" FAQ entry to say that stable users get about one release a week,
   and that the beta channel still gets a release for every merge. Add the
   user page on
   releases and config impact described under "Telling users", and link the
   `Config impact` line to it.
6. This change is one-way: after `2026.x`, a return to `9.x` would sort as a
   downgrade.
