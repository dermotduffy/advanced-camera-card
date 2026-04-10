# `status_bar`

Configures the card status bar.

```yaml
status_bar:
  # [...]
```

| Option          | Default  | Description                                                                                                                            |
| --------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `position`      | `bottom` | Whether to place the status bar at the `top` or `bottom` of the card.                                                                  |
| `popup_seconds` | `3`      | The number of seconds to display the status bar when using the `popup` style.                                                          |
| `height`        | `40`     | The height of the status bar in pixels.                                                                                                |
| `items`         |          | Whether to show or hide built-in status bar items. See [`items`](#items).                                                              |
| `style`         | `popup`  | The status bar style to show by default, one of `none`, `hover`, `hover-card`, `overlay`, `outside` or `popup`. See [`style`](#style). |

## `items`

All configuration is under:

```yaml
status_bar:
  items:
    [item]:
      # [...]
```

### Available Items

| Button name               | Description                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `engine`                  | The icon of the camera engine for the relevant camera.                                                         |
| `problem_config_error`    | An indicator that appears when the card configuration has an error.                                            |
| `problem_config_upgrade`  | An indicator that appears when a configuration upgrade is available.                                           |
| `problem_connection`      | An indicator that appears when the Home Assistant connection is lost.                                          |
| `problem_initialization`  | An indicator that appears when camera initialization fails.                                                    |
| `problem_legacy_resource` | An indicator that appears when a legacy `frigate-hass-card` resource is still registered.                      |
| `problem_media_load`      | An indicator that appears when media (live stream, recorded media, or image) has not loaded within 10 seconds. |
| `problem_media_query`     | An indicator that appears when a media query (e.g. fetching thumbnails or clips) fails.                        |
| `resolution`              | The detected media resolution (if any).                                                                        |
| `severity`                | The media severity indicator (if any) for review severity (e.g. Frigate alerts/detections).                    |
| `technology`              | The detected media technology (if any).                                                                        |
| `title`                   | The media title.                                                                                               |

### Options for each item

| Option      | Default                                | Description                                                                                                                                                                                                              |
| ----------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `enabled`   | `true`                                 | Whether or not to show the item.                                                                                                                                                                                         |
| `permanent` | `true` for problems, `false` otherwise | When `true`, the status bar stays visible in `popup` mode as long as this item is present (instead of auto-hiding after `popup_seconds`). All problem items default to `true` so errors remain visible.                  |
| `priority`  | `50`                                   | The item priority. Higher priority items are ordered closer to the start of the status bar (i.e. an item with priority `70` will order further to the left than an item with priority `60`). Minimum `0`, maximum `100`. |

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
  position: bottom
  popup_seconds: 3
  height: 40
  style: popup
  items:
    engine:
      enabled: true
      priority: 50
    problem_config_error:
      enabled: true
      priority: 50
    problem_config_upgrade:
      enabled: true
      priority: 50
    problem_connection:
      enabled: true
      priority: 50
    problem_initialization:
      enabled: true
      priority: 50
    problem_legacy_resource:
      enabled: true
      priority: 50
    problem_media_load:
      enabled: true
      priority: 50
    problem_media_query:
      enabled: true
      priority: 50
    resolution:
      enabled: true
      priority: 50
    severity:
      enabled: true
      priority: 50
    technology:
      enabled: true
      priority: 50
    title:
      enabled: true
      priority: 50
```
