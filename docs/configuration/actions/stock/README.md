# Stock Actions

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
```
