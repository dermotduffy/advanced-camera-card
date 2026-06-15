# `automations`

Automatically run [actions](actions/README.md) in response to
[triggers](conditions-triggers.md), optionally gated by [conditions](conditions-triggers.md).

> [!TIP]
> To change configuration conditionally, use [overrides](overrides.md) instead.

An automation has three parts, mirroring a Home Assistant automation:

- **`triggers:`** are the momentary occurrences that start the automation
  (required). Multiple triggers are independent: any one firing runs the
  automation (an implicit "or").
- **`conditions:`** are ongoing predicates checked the instant a trigger fires;
  they must _all_ hold for `actions` to run (optional).
- **`actions:`** / **`actions_not:`** are what runs when the conditions hold, and
  when they do not.

```yaml
automations:
  - triggers:
      - [trigger]
    conditions:
      - [condition]
    actions:
      - [action]
    actions_not:
      - [action]
```

| Option        | Default | Description                                                                                                                                   |
| ------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `triggers`    |         | A list of [triggers](conditions-triggers.md) that initiate the automation. At least one is required.                                          |
| `conditions`  |         | An optional list of [conditions](conditions-triggers.md) that must _all_ evaluate `true` at the instant a trigger fires for `actions` to run. |
| `actions`     |         | An optional list of [actions](actions/README.md) run when a trigger fires and the conditions hold (or no conditions are configured).          |
| `actions_not` |         | An optional list of [actions](actions/README.md) run when a trigger fires but the conditions do _not_ all hold.                               |

At least one of `actions` or `actions_not` is required. `actions_not` is a
card-specific extension (Home Assistant automations have no else branch).

# Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
automations:
  - triggers:
      - trigger: state
        entity_id: binary_sensor.front_door
        to: 'on'
    conditions:
      - condition: fullscreen
        fullscreen: true
    actions:
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: substream_on
    actions_not:
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: substream_off
```
