# Proposal: move from SemVer to CalVer (DRAFT)

One-off proposal. Delete this file once the migration is done or rejected.

## Why

`docs/developing.md` defines a MAJOR bump as any change that requires a config
update, _including one that is fully automated_. In practice that makes every
rename or restructure a "major release", users read more into the number than
it means, and the cost deters doing the change properly. CalVer removes the
decision. Compatibility is then stated per release in words (see
[compatibility.md](compatibility.md)) instead of being encoded in a digit.

## Scheme

`YYYY.M.N`, for example `2026.11.0`:

- `YYYY.M` is the month of the release, month not zero-padded (the same shape
  Home Assistant uses, and still a syntactically valid SemVer string, which
  keeps version parsers happy).
- `N` starts at 0 each month and increments per release.
- Tags stay `v`-prefixed: `v2026.11.0`.
- Ordering is preserved: `2026.x` sorts above `8.x`.

## Current setup

- `semantic-release` runs on every push to `main` and `next`; the commit
  analyzer derives the bump from Conventional Commit types; `next` publishes
  `-rc.N` prereleases.
- It also uploads the zip and `dist/*.js`, names the release, and comments
  ":tada: This issue has been resolved in version X" on released issues/PRs.
- `release-drafter` is configured with label-driven categories (including
  `breaking`) and is used for manual releases.
- The build reads `RELEASE_VERSION` from the environment
  (`scripts/vite/build-defines.ts`), so the version scheme does not touch
  application code.

## Options

**A. Keep semantic-release, add a CalVer plugin.** A third-party plugin exists
(`@mrbernnz/semantic-release-calver`) but has little adoption and has not been
evaluated here. semantic-release's core (commit analyzer, prerelease channels)
assumes SemVer, so this fights the tool.

**B. Replace semantic-release with a small release workflow (recommended).**
On push to `main`:

1. Compute the next version from today's date and existing tags.
2. `yarn run build` with `RELEASE_VERSION` set; zip `dist`.
3. Publish the GitHub release with notes from release-drafter, which is
   already label-driven and so picks up the compatibility labels directly.
4. Prepend the `Config impact:` line from the most severe compatibility label
   among the included PRs.
5. Comment on the issues/PRs included in the release (replaces
   `successComment`), and remove `fixed-pending-release`.

This drops four `semantic-release*` dev dependencies. Conventional Commit
titles remain useful for release-drafter's autolabeler and for history, but no
longer drive version numbers.

## Decisions for the maintainer

1. **Go / no-go.** This is one-way: after `2026.x` ships, returning to `9.x`
   would sort as a downgrade.
2. **Prereleases.** Keep the `next` channel as `YYYY.M.N-rc.K`, or drop it and
   rely on frequent releases from `main`.
3. **Option A or B.**

## To verify before switching

- HACS orders `2026.11.0` above `8.2.0` and handles the `-rc` form as a
  prerelease (expected, not yet confirmed).
- The card's own update/version reporting and the diagnostics `card_version`
  field need no parsing changes.
- Any place in docs that reasons about major versions (`developing.md` release
  philosophy, `rolling-back.md`, troubleshooting) is rewritten.

## Label changes

- Add `config-upgrade` to `.github/labels.yml` and as a release-drafter
  category.
- Narrow the meaning of `breaking` to "manual action required".
