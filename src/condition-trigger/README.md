# `condition-trigger`

The runtime behind `automations:`, `overrides:` and conditional
picture-`elements:`, built to mirror Home Assistant's conditions and triggers.
User-facing reference: [`conditions-triggers.md`](../../docs/configuration/conditions-triggers.md).

## Condition vs trigger

The same type (`state`, `camera`, ...) exists as both, but they are opposite shapes:

|         | Condition                                  | Trigger                                |
| ------- | ------------------------------------------ | -------------------------------------- |
| Asks    | _"is this true right now?"_                | _"did this just become true?"_         |
| Is a    | level / predicate, pulled via `evaluate()` | edge / event, pushed via `subscribe()` |
| Used in | `automations` gate, `overrides`, elements  | `automations` `triggers:` only         |

Both read one source of truth, the **`ConditionStateManager`** -- the card's live
state (`camera`/`view`/`config`/`hass`/...), which notifies on change. The Zod
schema ([`config/schema/condition-trigger/`](../config/schema/condition-trigger/))
shares each type's fields between its condition and trigger (`common/`) so the two
cannot drift.

## Conditions

`ConditionsManager` ANDs a set of pure level-predicate evaluators and notifies
when the result flips. It has two callers: `overrides:`/`elements:` directly, and
-- the non-obvious bit -- a **single-condition** manager is itself a clean
rising-edge detector, reused by card triggers (kind 4 below).

## Triggers: four kinds

`createTriggerEvaluator` picks one. All subscribe to the `ConditionStateManager`
and emit a `TriggerData` payload (the `trigger.*` template variable). Stock
triggers report their HA `platform`; card triggers report `platform: acc` + the
kind in `type`.

1. **Stock entity** (`state`, `numeric_state`) -- `EntityStateTriggerBase`:
   per-`entity_id` fan-out, HA `from_state`/`to_state`, `for:` via a `Timer`.
2. **Stock template** (`template`) -- the non-true -> true edge of `value_template`.
3. **Card-state** (`camera`, `view`, `config`) -- `CardStateTriggerBase`: watch one
   card facet, emit `from_acc`/`to_acc` snapshots.
4. **Rising-edge reuse** (every other card type: `fullscreen`, `triggered`, ...) --
   `ConditionRisingEdgeTrigger` wraps a single-condition `ConditionsManager`, so
   "trigger" == "rising edge of the matching condition", with no new code.

## Automations: push, then pull

`AutomationsManager` runs a `TriggersManager` per automation and, when a trigger
pushes, **pull-evaluates** the ongoing `conditions:` against the current state
(this matches Home Assistant actions). The state store updates _before_
dispatching, so a pulled condition already sees the triggering change -- no
ordering needed between the two.
