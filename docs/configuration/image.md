# `image`

Configure the `image` view.

```yaml
image:
  # [...]
```

| Option              | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actions`           |         | [Actions](actions/README.md) to use for the `image` view.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `entity`            |         | The entity to use when `mode` is set to `entity`. This entity is expected to have an `entity_picture` attribute that specifies the image URL.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `entity_parameters` |         | Optional URL parameters to add to the URL generated for entity-based modes (i.e. when `mode` is `camera` or `entity`).                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `mode`              | `auto`  | Value must be one of `url` (to fetch an arbitrary image URL), `camera` (to show a still of the currently selected camera entity using either `camera_entity` or `webrtc_card.entity` in that order of precedence), `entity` to show an image associated with a named entity (see the `entity` parameter below), or `screensaver` (to show an [embedded image](https://github.com/dermotduffy/advanced-camera-card/blob/main/src/images/iris-screensaver.jpg)). If `auto`, the mode is chosen automatically based on whether `url` or `entity` parameters have been specified. |
| `refresh_seconds`   | 1       | The image will be refreshed at least every `refresh_seconds` (it may refresh more frequently, e.g. whenever Home Assistant updates its camera security token). `0` implies no refreshing.                                                                                                                                                                                                                                                                                                                                                                                     |
| `url`               |         | A static image URL to be used when the `mode` is set to `url` or when a temporary image is required (e.g. may appear momentarily prior to load of a camera snapshot in the `camera` mode). Note that a `_t=[timestsamp]` query parameter will be automatically added to all URLs such that the image will not be cached by the browser.                                                                                                                                                                                                                                       |

> [!NOTE]
> When `mode` is set to `camera` this is effectively providing the same image as the `image` [live provider](cameras/live-provider.md) would show in the live camera carousel.

## Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
image:
  mode: auto
  refresh_seconds: 1
  url: 'https://path/to/image.png'
  entity: image.office_person
  entity_parameters: 'width=400&height=200'
  actions:
    entity: light.office_main_lights
    tap_action:
      action: none
    hold_action:
      action: none
    double_tap_action:
      action: none
    start_tap_action:
      action: none
    end_tap_action:
      action: none
```
