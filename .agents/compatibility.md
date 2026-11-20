# Compatibility classes (DRAFT)

Every PR is in exactly one class. A release inherits the most severe class
among its PRs.

| Class          | PR label         | Meaning                                                               | Who may ship it    |
| -------------- | ---------------- | --------------------------------------------------------------------- | ------------------ |
| Compatible     | _(none)_         | Existing configs behave as before.                                    | Agent              |
| Config upgrade | `config-upgrade` | Existing configs may need changing; an automatic upgrade is provided. | Agent, with notice |
| Breaking       | `breaking`       | Users must act manually, or behavior is lost with no upgrade path.    | Maintainer only    |

`breaking` is expected to be very rare. If a change looks breaking, first look
for a way to make it a config upgrade.

## Requirements per class

**Config upgrade**

- An entry in `UPGRADES` (`src/config/management.ts`) that rewrites old configs
  to the new shape, including inside `overrides` and profiles where relevant.
- Tests for the upgrade: old shape in, new shape out; already-new configs
  untouched.
- Docs updated to the new shape only.
- A changed default counts as a config upgrade when a user who never set the
  option would see different behavior, even though no config rewrite exists.
  State it in the PR description.

**Breaking**

- Maintainer sign-off in the inbox before the PR is opened.
- A "what to do" paragraph for the release notes.

## Classification

- The implementer states the class in its plan; the design challenger checks it
  before code exists; the reviewer checks it again against the diff.
- Proposed mechanical backstop (not yet built): a test that snapshots the set
  of config schema paths. Removing or renaming a path without a matching
  `UPGRADES` entry fails CI, so a mislabeled PR cannot pass as compatible.

## Release notes

Each release's notes open with one line:

- `Config impact: none.`
- `Config impact: automatic upgrade offered for <options>.`
- `Config impact: manual action required. <what to do>`

That line carries the signal a major version number used to carry.
