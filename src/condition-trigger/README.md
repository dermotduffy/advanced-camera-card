# `condition-trigger`

The runtime behind `automations:`, `overrides:` and conditional
picture-`elements:`, built to mirror Home Assistant's conditions and triggers.
User-facing reference: [`conditions-triggers.md`](../../docs/configuration/conditions-triggers.md).

## Condition vs trigger

The same type (`state`, `camera`, ...) exists as both, but they are opposite shapes:

|         | Condition                                         | Trigger                                |
| ------- | ------------------------------------------------- | -------------------------------------- |
| Asks    | _"is this true right now?"_                       | _"did this just become true?"_         |
| Is a    | level / predicate, pulled via `evaluate()`        | edge / event, pushed via `subscribe()` |
| Used in | `automations` `conditions`, `overrides`, elements | `automations` `triggers` only          |

Both read one source of truth, the **`ConditionStateManager`** -- the card's
live state (`camera`/`view`/`config`/`hass`/...), which notifies on change (the
lone exception is `screen`, which watches a `window.matchMedia` query). The Zod
schema
([`config/schema/condition-trigger/`](../config/schema/condition-trigger/))
shares each type's fields between its condition and trigger (`common/`) so the
two cannot drift.

## Conditions

Each type has a pure level-predicate evaluator (`evaluate(state) -> result`),
built by `createConditionEvaluator`. `ConditionsManager` ANDs a set of them and
notifies when the combined result flips; it backs `overrides`/`elements` and the
automation ongoing-`conditions` pull (below).

## The bridge

A type's meaning lives in exactly one place -- its condition evaluator. A
card-state trigger reuses that same evaluator as a point-in-time value-filter,
built directly from the trigger by `createConditionEvaluatorForTrigger` (the
trigger and condition schemas share a `common/` base, so no discriminator-swap
or cast). One definition of meaning, two readings: the condition asks the
predicate, the trigger watches for change and filters it through the predicate.

## Triggers: four kinds

`createTriggerEvaluator` picks one. Each emits a `TriggerData` payload (the
`trigger.*` template variable); stock triggers report their HA `platform`, card
triggers report `platform: acc` + the kind in `type`.

1. **Stock entity** (`state`, `numeric_state`) -- `EntityStateTriggerBase`:
   per-`entity_id` fan-out, HA `from_state`/`to_state`, `for:` via a `Timer`.
2. **Stock template** (`template`) -- the non-true -> true edge of `value_template`.
3. **Screen** (`screen`) -- `ScreenTrigger`: watches a `matchMedia` query, whose
   state lives outside `ConditionState`, so it subscribes through the screen
   condition evaluator and fires on the rising edge of the match.
4. **Card-state** (every other type: `camera`, `view`, `config`, `fullscreen`,
   ...) -- `ConditionStateTriggerBase`: subscribe to the
   `ConditionStateManager`, fire when the watched field (`_getValue`) changes,
   and emit `from_acc`/`to_acc` snapshots. A value filters the change through
   the matching condition (the bridge); no value fires on any change; `config`
   is trigger-only (no matching condition).

## Automations: push, then pull

`AutomationsManager` runs a `TriggersManager` per automation and, when a trigger
pushes, **pull-evaluates** the ongoing `conditions` against the current state
(this matches Home Assistant actions). The state store updates _before_
dispatching, so a pulled condition already sees the triggering change -- no
ordering needed between the two.
