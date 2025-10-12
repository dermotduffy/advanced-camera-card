# Stock Elements

## `conditional`

This element will let you show its sub-elements based on entity states. See [Home Assistant elements documentation](https://www.home-assistant.io/dashboards/picture-elements/#conditional-element).

```yaml
elements:
  - type: conditional
    # [...]
```

## `custom`

Custom elements provided by a card. See [Home Assistant elements documentation](https://www.home-assistant.io/dashboards/picture-elements/#custom-elements).

```yaml
elements:
  - type: custom
    # [...]
```

> [!TIP]
> See [Advanced Camera Card custom elements](../custom//README.md) for the custom elements offered by _this_ card.

## `icon`

This element creates a static icon that is not linked to the state of an entity. See [Home Assistant elements documentation](https://www.home-assistant.io/dashboards/picture-elements/#icon-element).

```yaml
elements:
  - type: icon
    # [...]
```

## `image`

This creates an image element that overlays the background image. See [Home Assistant elements documentation](https://www.home-assistant.io/dashboards/picture-elements/#image-element).

```yaml
elements:
  - type: image
    # [...]
```

## `service-button`

This entity creates a button (with arbitrary text) that can be used to call a service. See [Home Assistant elements documentation](https://www.home-assistant.io/dashboards/picture-elements/#service-call-button).

```yaml
elements:
  - type: service-button
    # [...]
```

## `state-badge`

This element creates a badge representing the state of an entity. See [Home Assistant elements documentation](https://www.home-assistant.io/dashboards/picture-elements/#state-badge).

```yaml
elements:
  - type: state-badge
    # [...]
```

## `state-icon`

This element represents an entity state using an icon. See [Home Assistant elements documentation](https://www.home-assistant.io/dashboards/picture-elements/#state-icon).

```yaml
elements:
  - type: state-icon
    # [...]
```

## `state-label`

This element represents an entity’s state via text. See [Home Assistant elements documentation](https://www.home-assistant.io/dashboards/picture-elements/#state-label).

```yaml
elements:
  - type: state-label
    # [...]
```

## Fully expanded reference

> [Actions](../../actions/README.md) are omitted for simplicity.

[](../../common/expanded-warning.md ':include')

Reference: [Home Assistant Picture Elements](https://www.home-assistant.io/dashboards/picture-elements/)

```yaml
elements:
  - type: state-badge
    entity: sensor.kitchen_dining_multisensor_air_temperature
    style:
      left: 100px
      top: 50px
    title: 'Temperature'
  - type: state-icon
    entity: light.office_main_lights
    icon: mdi:lamp
    state_color: true
    style:
      left: 100px
      top: 100px
  - type: state-label
    entity: sensor.kitchen_motion_sensor_battery
    attribute: battery_voltage
    prefix: Volts
    title: Battery Voltage
    style:
      left: 100px
      top: 150px
  - type: state-label
    entity: sensor.kitchen_motion_sensor_battery
    attribute: battery_voltage
    prefix: 'Volts: '
    title: Battery Voltage
    style:
      background-color: black
      left: 100px
      top: 200px
  - type: service-button
    title: Light on
    service: homeassistant.turn_on
    service_data:
      entity: light.office_main_lights
    style:
      left: 100px
      top: 250px
  - type: icon
    icon: mdi:cow
    title: Moo
    style:
      left: 100px
      top: 300px
  - type: image
    entity: light.office_main_lights
    title: Image
    state_image:
      on: 'https://picsum.photos/id/1003/1181/1772'
      off: 'https://picsum.photos/id/102/4320/3240'
    state_filter:
      'on': brightness(110%) saturate(1.2)
      'off': brightness(50%) hue-rotate(45deg)
    style:
      left: 100px
      top: 350px
      height: 50px
      width: 100px
  - type: conditional
    conditions:
      - condition: state
        entity: light.office_main_lights
        state: on
        state_not: off
      - condition: numeric_state
        entity: sensor.light_level
        above: 20
        below: 100
      - condition: user
        users:
          - 581fca7fdc014b8b894519cc531f9a04
    elements:
      - type: icon
        icon: mdi:dog
        title: Woof
        style:
          left: 100px
          top: 400px
```
