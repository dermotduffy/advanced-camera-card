# Change classes (DRAFT)

Every change has a compatibility class, which says what users must do, and a
verification class, which says how it is tested before release. Both are
chosen at plan time and set as labels on the PR. How releases use them is in
[releases.md](../maintainer/releases.md).

## Compatibility classes

Every PR is in exactly one class. A release lists every class present among
its PRs, most severe first.

| Class           | PR label          | What the user experiences                                                              |
| --------------- | ----------------- | -------------------------------------------------------------------------------------- |
| Compatible      | _(none)_          | Nothing.                                                                               |
| Behavior change | `behavior-change` | The card keeps working but behaves differently. Nothing to click.                      |
| Config upgrade  | `config-upgrade`  | The card shows an error until they open the editor, click Automatic Upgrade, and save. |
| Breaking        | `breaking`        | The card shows an error and they must edit their configuration by hand.                |

Upgrades run only from the editor. This is deliberate: the card never runs on
an outdated configuration by silently upgrading it, so a configuration that
works is always a valid one. A config upgrade is
therefore a real cost to users. The maintainer approves every config change at
plan time (see [decision-rights.md](../maintainer/decision-rights.md)) and weighs that cost
then.

**Behavior change** is a changed default, or any change where a user who has
not touched their configuration sees the card act differently. It requires the
docs to state the new default and the release note to say how to keep the old
behavior.

**Config upgrade** requires an entry in `UPGRADES`
(`src/config/management.ts`) covering overrides and profiles where relevant,
tests for it, and docs that show only the new shape.

**Breaking** requires maintainer sign-off at plan time and a "what to do"
paragraph for the release notes. It is expected to be very rare.

## Verification classes

Every PR is in exactly one class, chosen at plan time.

| Class                       | PR label             | Gate                                                               |
| --------------------------- | -------------------- | ------------------------------------------------------------------ |
| `AUTOMATED_FOR_RELEASE`     | _(none)_             | None beyond CI. May be promoted to stable untested by a human.     |
| `AUTOMATED_FOR_PRE_RELEASE` | `verify:pre-release` | Ships in the beta. Its check must pass in the weekly release test. |
| `MANUAL`                    | `verify:manual`      | The maintainer tests it in person before it merges to `dev`.       |

`AUTOMATED_FOR_RELEASE` is the default. Over the three months to November 2026, about 69% of merged changes would have been in this class, 28% in
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
asking for the maintainer's time, the agent supplies screenshots at minimum,
default and maximum sizes. It also runs every check it can run itself. The
in-person test plan takes no more than five minutes. The agent cuts it down to
what only a person can judge.
