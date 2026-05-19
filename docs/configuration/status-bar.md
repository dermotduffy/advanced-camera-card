# `status_bar`

Configures the card status bar.

```yaml
status_bar:
  # [...]
```

| Option          | Default           | Description                                                                                                                                                                                                                              |
| --------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auto_hide`     | `[call, casting]` | The conditions under which the status bar auto-hides. A list of zero or more of `call` (a [two-way audio](../usage/2-way-audio.md) call is active) and `casting` (the card is being cast, e.g. to a Chromecast). Set to `[]` to disable. |
| `position`      | `bottom`          | Whether to place the status bar at the `top` or `bottom` of the card.                                                                                                                                                                    |
| `popup_seconds` | `3`               | The number of seconds to display the status bar when using the `popup` style.                                                                                                                                                            |
| `height`        | `40`              | The height of the status bar in pixels.                                                                                                                                                                                                  |
| `items`         |                   | Whether to show or hide built-in status bar items. See [`items`](#items).                                                                                                                                                                |
| `style`         | `popup`           | The status bar style to show by default, one of `none`, `hover`, `hover-card`, `overlay`, `outside` or `popup`. See [`style`](#style).                                                                                                   |

## `items`

All configuration is under:

```yaml
status_bar:
  items:
    [item]:
      # [...]
```

### Available Items

| Button name  | Description                                                                                                                                                                                                                                                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine`     | The icon of the camera engine for the relevant camera.                                                                                                                                                                                                                                                                                                                        |
| `issues`     | Indicator icons that appear while any card issue is active — e.g. configuration error, configuration upgrade available, Home Assistant connection lost, camera initialization failed, legacy `frigate-hass-card` resource detected, media (live/recorded/image) not loading, media query failed, or view cannot be resolved. See the warning below about disabling this item. |
| `resolution` | The detected media resolution (if any).                                                                                                                                                                                                                                                                                                                                       |
| `severity`   | The media severity indicator (if any) for review severity (e.g. Frigate alerts/detections).                                                                                                                                                                                                                                                                                   |
| `technology` | The detected media technology (if any).                                                                                                                                                                                                                                                                                                                                       |
| `title`      | The media title.                                                                                                                                                                                                                                                                                                                                                              |

### Options for each item

| Option      | Default                                | Description                                                                                                                                                                                                              |
| ----------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `enabled`   | `true`                                 | Whether or not to show the item.                                                                                                                                                                                         |
| `permanent` | `true` for `issues`, `false` otherwise | When `true`, the status bar stays visible in `popup` mode as long as this item is present (instead of auto-hiding after `popup_seconds`). The `issues` item defaults to `true` so errors remain visible.                 |
| `priority`  | `50`                                   | The item priority. Higher priority items are ordered closer to the start of the status bar (i.e. an item with priority `70` will order further to the left than an item with priority `60`). Minimum `0`, maximum `100`. |

> [!WARNING]
> The status bar is the only UI surface for minor issues (i.e. that don't render
> the card entirely inoperable). If you set `status_bar.style: none` or
> `status_bar.items.issues.enabled: false`, these issues will not be visible to
> you, except through card diagnostics.

## `style`

This card supports several menu styles.

| Key          | Description                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------- |
| `hover-card` | Overlay the status bar over the card contents when the mouse is over the **card**, otherwise it is not shown.         |
| `hover`      | Overlay the status bar over the card contents when the mouse is over the **status bar**, otherwise it is not shown.   |
| `none`       | No status bar is shown.                                                                                               |
| `outside`    | Render the status bar outside the card (i.e. above it if `position` is `top`, or below it if `position` is `bottom`). |
| `overlay`    | Overlay the status bar over the card contents.                                                                        |
| `popup`      | Equivalent to `overlay` except the status bar disappears after `popup_seconds`.                                       |

## Fully expanded reference

> [!TIP]
> To add custom status bar contents, see [status bar custom elements](elements/custom/README.md?id=status-bar-icon).

[](common/expanded-warning.md ':include')

```yaml
status_bar:
  auto_hide:
    - call
    - casting
  position: bottom
  popup_seconds: 3
  height: 40
  style: popup
  items:
    engine:
      enabled: true
      permanent: false
      priority: 50
    issues:
      enabled: true
      permanent: true
      priority: 50
    resolution:
      enabled: true
      permanent: false
      priority: 50
    severity:
      enabled: true
      permanent: false
      priority: 50
    technology:
      enabled: true
      permanent: false
      priority: 50
    title:
      enabled: true
      permanent: false
      priority: 50
```
