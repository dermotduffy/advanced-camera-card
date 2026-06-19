# Stock Actions

## `if` / `then` / `else`

Run one sequence of actions or another depending on a set of
[conditions](../../conditions-triggers.md). This action has no `action:` key: it
is identified by the presence of an `if` key, exactly as in [Home Assistant
script syntax](https://www.home-assistant.io/docs/scripts/#if-then). The `then`
sequence runs when all `if` conditions hold; the optional `else` sequence runs
otherwise.

```yaml
if:
  - condition: state
    entity_id: input_boolean.notify_enabled
    state: 'on'
then:
  - action: fire-dom-event
    advanced_camera_card_action: live_substream_on
else:
  - action: fire-dom-event
    advanced_camera_card_action: live_substream_off
```

| Parameter | Description                                                       |
| --------- | ----------------------------------------------------------------- |
| `if`      | A list of [conditions](../../conditions-triggers.md) to evaluate. |
| `then`    | A list of actions to run when all `if` conditions hold.           |
| `else`    | An optional list of actions to run when the `if` conditions fail. |

## `more-info`

Open the "more-info" dialog for an entity. See [Home Assistant actions documentation](https://www.home-assistant.io/dashboards/actions/).

```yaml
action: more-info
# [...]
```

## `navigate`

Navigate to a particular dashboard path. See [Home Assistant actions documentation](https://www.home-assistant.io/dashboards/actions/).

```yaml
action: navigate
# [...]
```

## `perform-action`

Perform a Home Assistant action. See [Home Assistant actions documentation](https://www.home-assistant.io/dashboards/actions/).

```yaml
action: perform-action
# [...]
```

## `toggle`

Toggle an entity. See [Home Assistant actions documentation](https://www.home-assistant.io/dashboards/actions/).

```yaml
action: toggle
# [...]
```

## `url`

Navigate to an arbitrary URL. See [Home Assistant actions documentation](https://www.home-assistant.io/dashboards/actions/).

```yaml
action: url
# [...]
```

## Fully expanded reference

[](../../common/expanded-warning.md ':include')

Reference: [Home Assistant Actions](https://www.home-assistant.io/dashboards/actions/).

```yaml
elements:
  - type: icon
    icon: mdi:numeric-1-box
    title: More info action
    style:
      left: 200px
      top: 50px
    entity: light.office_main_lights
    tap_action:
      action: more-info
  - type: icon
    icon: mdi:numeric-2-box
    title: Toggle action
    style:
      left: 200px
      top: 100px
    entity: light.office_main_lights
    tap_action:
      action: toggle
  - type: icon
    icon: mdi:numeric-3-box
    title: Perform Action / Call Service action
    style:
      left: 200px
      top: 150px
    tap_action:
      action: perform-action
      perform_action: homeassistant.toggle
      data:
        entity_id: light.office_main_lights
  - type: icon
    icon: mdi:numeric-4-box
    title: Navigate action
    style:
      left: 200px
      top: 200px
    tap_action:
      action: navigate
      navigation_path: /lovelace/2
  - type: icon
    icon: mdi:numeric-5-box
    title: URL action
    style:
      left: 200px
      top: 250px
    tap_action:
      action: url
      url_path: https://www.home-assistant.io/
  - type: icon
    icon: mdi:numeric-6-box
    title: None action
    style:
      left: 200px
      top: 300px
    tap_action:
      action: none
  - type: icon
    icon: mdi:numeric-7-box
    title: Custom action
    style:
      left: 200px
      top: 350px
    tap_action:
      action: fire-dom-event
      key: value
  - type: icon
    icon: mdi:numeric-8-box
    title: If / then / else action
    style:
      left: 200px
      top: 400px
    tap_action:
      if:
        - condition: state
          entity_id: light.office_main_lights
          state: 'on'
      then:
        - action: fire-dom-event
          advanced_camera_card_action: live_substream_on
      else:
        - action: fire-dom-event
          advanced_camera_card_action: live_substream_off
```
