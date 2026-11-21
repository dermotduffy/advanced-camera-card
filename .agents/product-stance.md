# Product stance (DRAFT)

> Inferred from the maintainer's replies on roughly 80 issues (2023 to 2026).
> Evidence is cited as issue numbers. This is a first draft for the maintainer
> to correct, not yet a statement of policy.

Used by the triage and feature roles to recommend what to build, what to
decline and how to reply. Recommendations go to the maintainer; nothing here
authorizes an agent to decline a request or reply to a user on its own (see
[decision-rights.md](decision-rights.md)).

## What the card is for

- **Live viewing of many cameras in one card**: carousel and grid (#1075,
  #1946).
- **Browsing recorded media**: clips, snapshots, recordings, reviews, timeline,
  gallery, filters (#1502, #2075).
- **Frigate as the richest engine, but not Frigate-only**: generic camera
  entities, Home Assistant media folders, Reolink (#1748, #1027).
- **Doorbell and 2-way audio "call" flow** (#2587, #2679).
- **PTZ** (#1839, #1889).
- **Wall tablets, kiosks and casting**; Chromecast support matters (#2785).
- **Composable primitives** over one-off features: actions, automations,
  overrides, conditions, templates, elements, profiles, remote control.
- **Reasonable performance on modest devices** (#2337).

## Non-goals

- **Fixing upstream behavior card-side.** If the same problem appears in Home
  Assistant without the card, it belongs upstream (HA, Frigate, go2rtc, the
  camera integration, HACS, the browser) (#2156, #2498). A cheap, contained
  workaround for a confirmed upstream bug is acceptable (#2883).
- **`card-mod` support.** It depends on the card's internal DOM. Styling goes
  through themes, documented CSS variables and `style` options (#2117, #2287).
- **Cross-device or cross-card state sync.** `remote_control` through an HA
  entity is the supported narrow alternative (#2002, #2239).
- **Features needing information the card cannot have** (#998, #2152).
- **Per-device certification.** The card supports what the engine and go2rtc
  support; individual hardware is not vouched for (#2652).
- **Feature parity across engines.** Other engines get what their integration
  exposes; per-camera action mapping is the escape hatch (#1964, #2301).
- **Refactors or bundle work without a measured payoff** (#2533, #2086).
- **Guaranteed support.** See `docs/support.md`.

## Accepting a request

Signals in favor, strongest first:

1. **Votes** on the top post. This is the stated prioritization mechanism
   (#1785, #1246).
2. **It generalizes.** A specific ask that can be reframed as a primitive many
   users benefit from (#1701, #2287).
3. **The card's own behavior is too strict or misleading**, even when the
   trigger is upstream (#2124).
4. **It fits an area under active work**, or exposes something the engine
   already provides (#2587, #2075).
5. **There is a root-cause fix** that removes the need for the requested
   option. Prefer that to the option (#2424).

## Declining a request

Reasons, most common first:

1. **Already possible** with existing config, actions, automations or
   overrides. Reply with paste-ready YAML and a docs link (#2514, #2453).
2. **Upstream responsibility.** Explain the mechanism and name where it
   belongs (#2156).
3. **Infeasible** with the data available, or blocked by browser security
   (#998, #1777).
4. **Cost outweighs benefit**, including the cost of one more option (#1664).
5. **It would hide a useful signal** from most users, such as an error or a
   loading state (#2276, #2148).
6. **It breaks component encapsulation or build hygiene** (#1664, #2086).
7. **No demand** (#2679).

## Config design

- Nest options by area and name them for what the user sees:
  `live.controls.call.enabled`, `menu.buttons.<name>.priority`.
- Prefer an enumerated mode to a boolean when a third behavior is plausible.
- New options are opt-in. The default preserves current behavior.
- Do not add an option where composing existing primitives works well. Add one
  when composition is clumsy for a common need (#2587).
- Settle scope before shape: per camera or card-wide? Only in certain views?
  (#2770, #2110).
- Anything reachable in the UI should also be an action.
- Remove option values that no longer do anything (#2679).
- Docs are part of the feature: every schema field appears in the docs table,
  with a worked example where it helps.

## Handling recurring situations

| Situation                   | Recommendation                                                         |
| --------------------------- | ---------------------------------------------------------------------- |
| Bug without diagnostics     | Ask for card diagnostics, with the docs link. Label `waiting`.         |
| Cannot reproduce            | Say so, give a minimal working config, ask the reporter to try it.     |
| Possibly upstream           | Ask whether it happens in HA without the card.                         |
| Duplicate                   | Link the canonical issue; close as duplicate.                          |
| Already fixed or in beta    | One line pointing at the release.                                      |
| Unrelated follow-up comment | Ask for a new issue with diagnostics.                                  |
| Confirmed regression        | `regression` plus `P0`/`P1`; goes to the front of the implement queue. |
| Stale and unanswered        | Close as not planned, inviting a reopen with more information.         |
| Contribution offered        | Welcome it.                                                            |

## Voice for drafted replies

- Short. One or two sentences, or a YAML block and a link.
- Restate the request first when it is ambiguous; end with a question if one
  is needed.
- Friendly and plain. Direct about limits: "This is not possible today."
- Say when something is untested.
- Leave the door open when closing.

## Labels

Type: `bug`, `feature`, `documentation`, `performance`, `refactoring`,
`testing`, `chore`, `ci`. Priority: `P0` to `P3`. State: `waiting`,
`regression`, `fixed-pending-release`, `help wanted`, `question`.
Compatibility and verification: see [releases.md](releases.md).

Known gaps for triage to correct:

- The feature request template applies a label, `feature request`, that does
  not exist, so new requests arrive unlabeled. The intended label is `feature`.
- The bug template applies `bug` automatically, so support questions and
  upstream problems carry it until triaged.
