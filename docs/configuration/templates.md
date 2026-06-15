# Templates

Templates may be used in a certain places to allow template values (if present)
to be dynamically replaced. This allows a variety of Home Assistant data, and
Advanced Camera Card data, to be accessible. Templates may be used in:

- [Actions / Automations](./actions/README.md)
- [Folder Media Matchers](./folders.md?id=matchers)

## Stock Templates

The Advanced Camera Card uses
[ha-nunjucks](https://github.com/Nerwyn/ha-nunjucks) to process templates.
Consult its documentation for the wide variety of different template values
supported.

See [an example](../examples.md?id=accessing-home-assistant-state) that
accesses Home Assistant state.

## Custom Templates

Custom template values must be prefixed with `acc`.

| Template | Replaced with                                     |
| -------- | ------------------------------------------------- |
| `camera` | The currently selected camera.                    |
| `view`   | The current [view](./view.md?id=supported-views). |
| `config` | The current card configuration.                   |

See [an example](../examples.md?id=accessing-advanced-camera-card-state) that
accesses Advanced Camera Card state.

### Media Matching

If templates are used for [Folder Media Matching](./folders.md?id=matchers) an
additional `media` variable is available with these properties:

Media template values must be prefixed with `acc.media`.

| Template    | Replaced with                                                                     |
| ----------- | --------------------------------------------------------------------------------- |
| `title`     | The media title being matched.                                                    |
| `is_folder` | Whether the media item is a folder that may be expanded (vs a single media item). |

### Triggers

When an action runs from an [automation](./automations.md), a top-level
`trigger` variable describes what fired it (as in native Home Assistant
actions), including the state before and after the change. Its fields depend on
the kind of trigger.

The stock `state` and `numeric_state` [triggers](./conditions-triggers.md) carry
Home-Assistant-faithful entity data (a subset of Home Assistant's own [trigger
data](https://www.home-assistant.io/docs/automation/templating/#available-trigger-data):
the card does not currently surface `id`, `idx`, `for`, `attribute`, `above` /
`below` or `alias`, so [request](https://github.com/dermotduffy/advanced-camera-card/issues)
if you need more). The `template` trigger has no entity, so it carries only
`trigger.platform` (`template`).

| Template             | Replaced with                                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trigger.platform`   | The trigger platform (`state` or `numeric_state`).                                                                                                         |
| `trigger.entity_id`  | The entity that triggered (also available as `trigger.entity`).                                                                                            |
| `trigger.from_state` | The full Home Assistant [state object](https://www.home-assistant.io/docs/configuration/state_object/) before the change, e.g. `trigger.from_state.state`. |
| `trigger.to_state`   | The full Home Assistant state object after the change, e.g. `trigger.to_state.state` or `trigger.to_state.attributes.<name>`.                              |

The card-specific [triggers](./conditions-triggers.md) (e.g. `camera`, `view`, `config`)
carry the card state before and after the change:

| Template           | Replaced with                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| `trigger.platform` | `acc` for card-specific triggers.                                                                      |
| `trigger.type`     | The card trigger kind (e.g. `camera`, `view`, `config`).                                               |
| `trigger.from_acc` | The card state before the change, with `camera`, `view` and `config` (e.g. `trigger.from_acc.camera`). |
| `trigger.to_acc`   | The card state after the change, with `camera`, `view` and `config` (e.g. `trigger.to_acc.camera`).    |

See [an example](../examples.md?id=accessing-trigger-state) that accesses
trigger state.
