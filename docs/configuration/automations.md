# `automations`

Automatically take [actions](actions/README.md) based on [conditions](conditions.md) being met.

> [!TIP]
> To change configuration conditionally use [overrides](overrides.md).

```yaml
automations:
  - conditions:
      - [condition]
    actions:
      - [action]
    actions_not:
      - [action]
```

| Option        | Default | Description                                                                                                              |
| ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `conditions`  |         | A list of [conditions](conditions.md) that must evaluate to `true` in order to trigger the automation.                   |
| `actions`     |         | An optional list of [actions](actions/README.md) that will be run when the [conditions](conditions.md) evaluate `true`.  |
| `actions_not` |         | An optional list of [actions](actions/README.md) that will be run when the [conditions](conditions.md) evaluate `false`. |

# Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
automations:
  - conditions:
      - condition: fullscreen
        fullscreen: true
    actions:
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: live_substream_on
    actions_not:
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: live_substream_off
```
