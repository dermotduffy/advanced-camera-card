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
- **`actions:`** are what runs when a trigger fires and the conditions hold
  (required).

```yaml
automations:
  - triggers:
      - [trigger]
    conditions:
      - [condition]
    actions:
      - [action]
```

| Option       | Default | Description                                                                                                                                   |
| ------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `triggers`   |         | A list of [triggers](conditions-triggers.md) that initiate the automation. At least one is required.                                          |
| `conditions` |         | An optional list of [conditions](conditions-triggers.md) that must _all_ evaluate `true` at the instant a trigger fires for `actions` to run. |
| `actions`    |         | A list of [actions](actions/README.md) run when a trigger fires and the conditions hold (or no conditions are configured).                    |

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
```
