# Custom Elements

## `conditional`

Restrict a set of elements to only render when the card is matches a set of [conditions](../../conditions.md). This is analogous to the stock [`conditional`](../stock/README.md?id=conditional) element except supporting a rich set of Advanced Camera Card [conditions](../../conditions.md).

```yaml
elements:
  - type: custom:advanced-camera-card-conditional
    # [...]
```

Parameters for the `custom:advanced-camera-card-conditional` element:

| Parameter    | Description                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| `type`       | Must be `custom:advanced-camera-card-conditional`.                                                               |
| `conditions` | A list of [conditions](../../conditions.md) that must evaluate to true in order for the elements to be rendered. |
| `elements`   | The elements to render. Can be any supported element.                                                            |

See the [conditional elements example](../../../examples.md?id=conditional-elements).

## `menu-icon`

Add an arbitrary icon to the Advanced Camera Card menu.

```yaml
elements:
  - type: custom:advanced-camera-card-menu-icon
    # [...]
```

Configuration is similar to a stock [Picture Elements Icon](https://www.home-assistant.io/lovelace/picture-elements/#icon-element).

| Parameter                                                                | Default    | Description                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                                                                   |            | Must be `custom:advanced-camera-card-menu-icon`.                                                                                                                                                                                                                                                                             |
| `alignment`                                                              | `matching` | Whether this menu item should have an alignment that is `matching` the menu alignment or `opposing` the menu alignment. Can be used to create two separate groups of buttons on the menu. The `priority` option orders buttons within a given `alignment`.                                                                   |
| `enabled`                                                                | `true`     | Whether or not to show this menu item.                                                                                                                                                                                                                                                                                       |
| `entity`                                                                 |            | An optional Home Assistant entity for use with actions.                                                                                                                                                                                                                                                                      |
| `icon`                                                                   |            | An required icon to display, e.g. `mdi:car`. See also [custom icons](../../../usage/custom-icons.md).                                                                                                                                                                                                                        |
| `permanent`                                                              | `false`    | If `false` the menu item is hidden when the menu has the `hidden` style and the menu is closed, otherwise it is shown (and sorted to the front).                                                                                                                                                                             |
| `priority`                                                               | `50`       | The menu item priority. Higher priority items are ordered closer to the start of the menu alignment (i.e. a button with priority `70` will order further to the left than a button with priority `60`). Priority applies separately to `matching` and `opposing` groups (see `alignment` above). Minimum `0`, maximum `100`. |
| `style`                                                                  |            | Position and style the element using CSS.                                                                                                                                                                                                                                                                                    |
| `tap_action`, `double_tap_action`, `hold_action`, `start_tap`, `end_tap` |            | The [actions](../../actions/README.md) to take when this item is interacted with.                                                                                                                                                                                                                                            |
| `title`                                                                  |            | An optional title to display.                                                                                                                                                                                                                                                                                                |

## `menu-submenu`

Add a configurable submenu dropdown.

```yaml
elements:
  - type: custom:advanced-camera-card-menu-submenu
    # [...]
```

| Parameter                                                                | Default    | Description                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                                                                   |            | Must be `custom:advanced-camera-card-menu-submenu`.                                                                                                                                                                                                                                                                          |
| `alignment`                                                              | `matching` | Whether this menu item should have an alignment that is `matching` the menu alignment or `opposing` the menu alignment. Can be used to create two separate groups of buttons on the menu. The `priority` option orders buttons within a given `alignment`.                                                                   |
| `enabled`                                                                | `true`     | Whether or not to show this menu item.                                                                                                                                                                                                                                                                                       |
| `entity`                                                                 |            | An optional Home Assistant entity for use with actions.                                                                                                                                                                                                                                                                      |
| `icon`                                                                   |            | An required icon to display, e.g. `mdi:car`. See also [custom icons](../../../usage/custom-icons.md).                                                                                                                                                                                                                        |
| `items`                                                                  |            | A list of menu items, as described below.                                                                                                                                                                                                                                                                                    |
| `permanent`                                                              | `false`    | If `false` the menu item is hidden when the menu has the `hidden` style and the menu is closed, otherwise it is shown (and sorted to the front).                                                                                                                                                                             |
| `priority`                                                               | `50`       | The menu item priority. Higher priority items are ordered closer to the start of the menu alignment (i.e. a button with priority `70` will order further to the left than a button with priority `60`). Priority applies separately to `matching` and `opposing` groups (see `alignment` above). Minimum `0`, maximum `100`. |
| `style`                                                                  |            | Position and style the element using CSS.                                                                                                                                                                                                                                                                                    |
| `tap_action`, `double_tap_action`, `hold_action`, `start_tap`, `end_tap` |            | The [actions](../../actions/README.md) to take when this item is interacted with.                                                                                                                                                                                                                                            |
| `title`                                                                  |            | An optional title to display.                                                                                                                                                                                                                                                                                                |

### Submenu items

| Parameter                                                                | Default | Description                                                                                                |
| ------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------- |
| `enabled`                                                                | `true`  | Whether or not to show this item as enabled / selectable.                                                  |
| `entity`                                                                 |         | An optional Home Assistant entity from which title, icon and style can be automatically computed.          |
| `icon`                                                                   |         | An optional item icon to display, e.g. `mdi:car`. See also [custom icons](../../../usage/custom-icons.md). |
| `selected`                                                               | `false` | Whether or not to show this item as selected.                                                              |
| `state_color`                                                            | `true`  | Whether or not the title and icon should be stylized based on state.                                       |
| `style`                                                                  |         | Position and style the element using CSS.                                                                  |
| `tap_action`, `double_tap_action`, `hold_action`, `start_tap`, `end_tap` |         | The [actions](../../actions/README.md) to take when this item is interacted with.                          |
| `title`                                                                  |         | An optional title to display.                                                                              |

## `menu-submenu-select`

Add a submenu based on a `select` or `input_select`. This element allows you to convert a [Home Assistant Select Entity](https://www.home-assistant.io/integrations/select/) or [Home Assistant Input Select Entity](https://www.home-assistant.io/integrations/input_select/) (an entity either starting with `select` or `input_select`) into an overridable submenu. This _could_ be done by hand using a regular submenu (above) -- this element is a convenience.

```yaml
elements:
  - type: custom:advanced-camera-card-menu-submenu-select
    # [...]
```

| Parameter                                                                | Default    | Description                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                                                                   |            | Must be `custom:advanced-camera-card-menu-submenu-select`.                                                                                                                                                                                                                                                                   |
| `alignment`                                                              | `matching` | Whether this menu item should have an alignment that is `matching` the menu alignment or `opposing` the menu alignment. Can be used to create two separate groups of buttons on the menu. The `priority` option orders buttons within a given `alignment`.                                                                   |
| `enabled`                                                                | `true`     | Whether or not to show this menu item.                                                                                                                                                                                                                                                                                       |
| `entity`                                                                 |            | An optional Home Assistant entity for use with actions.                                                                                                                                                                                                                                                                      |
| `icon`                                                                   |            | An required icon to display, e.g. `mdi:car`. See also [custom icons](../../../usage/custom-icons.md).                                                                                                                                                                                                                        |
| `options`                                                                |            | An optional dictionary of overrides keyed by the option name that the given select entity supports. These options can be used to set or override submenu item parameters on a per-option basis. The format is as described in [Submenu Items](./README.md?id=submenu-items) above.                                           |
| `permanent`                                                              | `false`    | If `false` the menu item is hidden when the menu has the `hidden` style and the menu is closed, otherwise it is shown (and sorted to the front).                                                                                                                                                                             |
| `priority`                                                               | `50`       | The menu item priority. Higher priority items are ordered closer to the start of the menu alignment (i.e. a button with priority `70` will order further to the left than a button with priority `60`). Priority applies separately to `matching` and `opposing` groups (see `alignment` above). Minimum `0`, maximum `100`. |
| `style`                                                                  |            | Position and style the element using CSS.                                                                                                                                                                                                                                                                                    |
| `tap_action`, `double_tap_action`, `hold_action`, `start_tap`, `end_tap` |            | The [actions](../../actions/README.md) to take when this item is interacted with.                                                                                                                                                                                                                                            |
| `title`                                                                  |            | An optional title to display.                                                                                                                                                                                                                                                                                                |

See the `select` [submenu example](../../../examples.md?id=select-submenu).

## `menu-state-icon`

Add a state icon to the Advanced Camera Card menu that represents the state of a Home Assistant entity.

```yaml
elements:
  - type: custom:advanced-camera-card-menu-state-icon
    # [...]
```

Configuration is similar to a stock [Picture Elements State Icon](https://www.home-assistant.io/lovelace/picture-elements/#state-icon).

| Parameter                                                                | Default    | Description                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                                                                   |            | Must be `custom:advanced-camera-card-menu-state-icon`.                                                                                                                                                                                                                                                                       |
| `alignment`                                                              | `matching` | Whether this menu item should have an alignment that is `matching` the menu alignment or `opposing` the menu alignment. Can be used to create two separate groups of buttons on the menu. The `priority` option orders buttons within a given `alignment`.                                                                   |
| `enabled`                                                                | `true`     | Whether or not to show this menu item.                                                                                                                                                                                                                                                                                       |
| `entity`                                                                 |            | An optional Home Assistant entity for use with actions.                                                                                                                                                                                                                                                                      |
| `icon`                                                                   |            | An required icon to display, e.g. `mdi:car`. See also [custom icons](../../../usage/custom-icons.md).                                                                                                                                                                                                                        |
| `permanent`                                                              | `false`    | If `false` the menu item is hidden when the menu has the `hidden` style and the menu is closed, otherwise it is shown (and sorted to the front).                                                                                                                                                                             |
| `priority`                                                               | `50`       | The menu item priority. Higher priority items are ordered closer to the start of the menu alignment (i.e. a button with priority `70` will order further to the left than a button with priority `60`). Priority applies separately to `matching` and `opposing` groups (see `alignment` above). Minimum `0`, maximum `100`. |
| `tap_action`, `double_tap_action`, `hold_action`, `start_tap`, `end_tap` |            | The [actions](../../actions/README.md) to take when this item is interacted with.                                                                                                                                                                                                                                            |
| `state_color`                                                            | `true`     | Set to true to have icons colored when entity is active.                                                                                                                                                                                                                                                                     |
| `style`                                                                  |            | Position and style the element using CSS.                                                                                                                                                                                                                                                                                    |
| `title`                                                                  |            | An optional title to display.                                                                                                                                                                                                                                                                                                |

## `status-bar-icon`

Add an arbitrary icon to the status bar.

```yaml
elements:
  - type: custom:advanced-camera-card-status-bar-icon
    # [...]
```

| Parameter    | Default | Description                                                                                                                                                                                                              |
| ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `type`       |         | Must be `custom:advanced-camera-card-status-bar-icon`.                                                                                                                                                                   |
| `actions`    |         | Actions to performs when the status bar item is interacted with. See [actions](../../actions/README.md).                                                                                                                 |
| `enabled`    | `true`  | `true` to enable this status bar item, `false` to disable.                                                                                                                                                               |
| `exclusive`  | `false` | Whether or not this item should evict non-exclusive items from the status bar.                                                                                                                                           |
| `expand`     | `false` | If `false` this status bar item will consume the minimum possible space, if `true` will expand to the available space.                                                                                                   |
| `icon`       |         | The icon to show in the status bar, e.g. `mdi:camera-front`. See also [custom icons](../../../usage/custom-icons.md).                                                                                                    |
| `priority`   | `50`    | The item priority. Higher priority items are ordered closer to the start of the status bar (i.e. an item with priority `70` will order further to the left than an item with priority `60`). Minimum `0`, maximum `100`. |
| `sufficient` | `false` | Whether or not this item is sufficient to display the status bar if it's otherwise hidden (e.g. with the `popup` [status bar style](../../status-bar.md)).                                                               |

## `status-bar-image`

Add an arbitrary image to the status bar.

```yaml
elements:
  - type: custom:advanced-camera-card-status-bar-image
    # [...]
```

| Parameter    | Default | Description                                                                                                                                                                                                              |
| ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `type`       |         | Must be `custom:advanced-camera-card-status-bar-image`.                                                                                                                                                                  |
| `actions`    |         | Actions to performs when the status bar item is interacted with. See [actions](../../actions/README.md).                                                                                                                 |
| `enabled`    | `true`  | `true` to enable this status bar item, `false` to disable.                                                                                                                                                               |
| `exclusive`  | `false` | Whether or not this item should evict non-exclusive items from the status bar.                                                                                                                                           |
| `expand`     | `false` | If `false` this status bar item will consume the minimum possible space, if `true` will expand to the available space.                                                                                                   |
| `image`      |         | The image to show in the status bar, e.g. `https://my.site.com/status.png`.                                                                                                                                              |
| `priority`   | `50`    | The item priority. Higher priority items are ordered closer to the start of the status bar (i.e. an item with priority `70` will order further to the left than an item with priority `60`). Minimum `0`, maximum `100`. |
| `sufficient` | `false` | Whether or not this item is sufficient to display the status bar if it's otherwise hidden (e.g. with the `popup` [status bar style](../../status-bar.md)).                                                               |

## `status-bar-string`

Add an arbitrary string to the status bar.

```yaml
elements:
  - type: custom:advanced-camera-card-status-bar-string
    # [...]
```

| Parameter    | Default | Description                                                                                                                                                                                                              |
| ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `type`       |         | Must be `custom:advanced-camera-card-status-bar-string`.                                                                                                                                                                 |
| `actions`    |         | Actions to performs when the status bar item is interacted with. See [actions](../../actions/README.md).                                                                                                                 |
| `enabled`    | `true`  | `true` to enable this status bar item, `false` to disable.                                                                                                                                                               |
| `exclusive`  | `false` | Whether or not this item should evict non-exclusive items from the status bar.                                                                                                                                           |
| `expand`     | `false` | If `false` this status bar item will consume the minimum possible space, if `true` will expand to the available space.                                                                                                   |
| `string`     |         | The string to show in the status bar, e.g. `Intruder detected!`                                                                                                                                                          |
| `priority`   | `50`    | The item priority. Higher priority items are ordered closer to the start of the status bar (i.e. an item with priority `70` will order further to the left than an item with priority `60`). Minimum `0`, maximum `100`. |
| `sufficient` | `false` | Whether or not this item is sufficient to display the status bar if it's otherwise hidden (e.g. with the `popup` [status bar style](../../status-bar.md)).                                                               |

## Fully expanded reference

?> [Actions](../../actions/README.md) are omitted for simplicity.

[](../../common/expanded-warning.md ':include')

```yaml
elements:
  - type: custom:advanced-camera-card-menu-icon
    alignment: matching
    enabled: true
    entity: light.office_main_lights
    icon: mdi:car
    permanent: false
    priority: 50
    style:
      color: white
    title: Vroom
  - type: custom:advanced-camera-card-menu-state-icon
    alignment: matching
    enabled: true
    entity: light.office_main_lights
    icon: mdi:chair-rolling
    permanent: false
    priority: 50
    state_color: true
    style:
      color: white
    title: Office lights
  - type: custom:advanced-camera-card-menu-submenu
    alignment: matching
    enabled: true
    entity: light.office_main_lights
    icon: mdi:menu
    items:
      - enabled: true
        entity: light.office_main_lights
        icon: mdi:lightbulb
        selected: false
        state_color: true
        style:
          color: white
        tap_action:
          action: toggle
        title: Lights
      - enabled: true
        icon: mdi:google
        selected: false
        state_color: false
        style:
          color: white
        tap_action:
          action: url
          url_path: https://www.google.com
        title: Google
    permanent: false
    priority: 50
    style:
      color: white
    title: Office lights
  - type: custom:advanced-camera-card-menu-submenu-select
    alignment: matching
    enabled: true
    entity: input_select.kitchen_scene
    icon: mdi:lamps
    options:
    items:
      scene.kitchen_cooking_scene:
        enabled: true
        icon: mdi:chef-hat
        selected: false
        state_color: true
        style:
          color: white
        title: Cooking time!
      scene.kitchen_tv_scene:
        icon: mdi:television
        title: TV!
    permanent: false
    priority: 50
    style:
      color: white
    title: 'Kitchen Scene'
    # Show a pig icon if a variety of conditions are met.
  - type: custom:advanced-camera-card-conditional
    elements:
      - type: icon
        icon: mdi:pig
        title: Oink
        style:
          left: 300px
          top: 100px
    conditions:
      - condition: view
        views:
          - live
      - condition: fullscreen
        fullscreen: true
      - condition: expand
        expand: true
      - condition: camera
        cameras: camera.front_door
      - condition: media_loaded
        media_loaded: true
      - condition: display_mode
        display_mode: single
      - condition: triggered
        triggered:
          - camera.front_door
      - condition: interaction
        interaction: true
      - condition: microphone
        muted: true
        connected: true
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
  - type: custom:advanced-camera-card-status-bar-string
    enabled: true
    exclusive: false
    expand: false
    string: 'Intruder alert!'
    priority: 50
    sufficient: false
  - type: custom:advanced-camera-card-status-bar-icon
    enabled: true
    exclusive: false
    expand: false
    icon: 'mdi:cow'
    priority: 50
    sufficient: false
  - type: custom:advanced-camera-card-status-bar-image
    enabled: true
    exclusive: false
    expand: false
    image: https://my.site.com/status.png
    priority: 50
    sufficient: false
```
