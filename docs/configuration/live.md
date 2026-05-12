# `live`

Configures the behavior of the `live` view.

```yaml
live:
  # [...]
```

| Option                   | Default                            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actions`                |                                    | [Actions](actions/README.md) to use for the `live` view.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `auto_mute`              | `[unselected, hidden, microphone]` | A list of conditions in which live camera feeds are muted. `unselected` will automatically mute when a camera is unselected in the carousel or grid. `hidden` will automatically mute when the camera becomes hidden (e.g. browser tab change) or `microphone` will automatically mute after the microphone is muted as long as the camera stays selected (see the `live.microphone.mute_after_microphone_mute_seconds` to control how long after). Use an empty list (`[]`) to never automatically mute. Note that if `auto_play` is enabled, the stream may mute itself automatically in order to honor the `auto_play` setting, as some browsers will not auto play media that is unmuted -- that is to say, where necessary, the `auto_play` parameter will take priority over the `auto_mute` parameter. |
| `auto_pause`             | `[]`                               | A list of conditions in which live camera feeds are automatically paused. `unselected` will automatically pause when a camera is unselected in the carousel or grid. `hidden` will automatically pause when the browser/tab becomes hidden. Use an empty list (`[]`) to never automatically pause. **Caution**: Some live providers (e.g. `jsmpeg`) may not offer human-accessible means to resume play if it is paused, unless the `auto_play` option is used.                                                                                                                                                                                                                                                                                                                                               |
| `auto_play`              | `[selected, visible]`              | A list of conditions in which live camera feeds are automatically played. `selected` will automatically play when a camera is selected in a carousel or grid. `visible` will automatically play when a camera becomes visible (e.g. browser tab change, or visible in a grid but not selected). Use an empty list (`[]`) to never automatically play. Some live providers (e.g. `webrtc-card`, `jsmpeg`) do not support the prevention of automatic play on initial load, but should still respect the value of this parameter on play-after-pause.                                                                                                                                                                                                                                                           |
| `auto_unmute`            | `[microphone]`                     | A list of conditions in which live camera feeds are unmuted. `selected` will automatically unmute when a camera is selected in a carousel or grid. `visible` will automatically unmute when a camera becomes visible (e.g. a browser/tab change, or visible in a grid but not selected). `microphone` will automatically unmute after the microphone is unmuted. Use an empty list (`[]`) to never automatically unmute. Some browsers will not allow automated unmute until the user has interacted with the page in some way -- if the user has not then the browser may pause the media instead.                                                                                                                                                                                                           |
| `controls`               |                                    | Configuration for the `live` view controls. See [`controls`](#controls).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `display`                |                                    | Controls whether to show a single or grid `live` view. See [`display`](#display).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `draggable`              | `true`                             | Whether or not the live carousel can be dragged left or right, via touch/swipe and mouse dragging.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `lazy_load`              | `true`                             | Whether or not to lazily load cameras in the camera carousel. Setting this to `false` will cause all cameras to load simultaneously when the `live` carousel is opened (or cause all cameras to load continually if `preload` is also `true`). This will result in a smoother carousel experience at a cost of (potentially) a substantial amount of continually streamed data.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `lazy_unload`            | `[]`                               | A list of conditions in which live camera feeds are unloaded. `unselected` will unload a camera when it is not visible in the carousel/grid and `hidden` will unload a camera when the browser itself is minimized or the browser tab changes. An empty list (`[]`, the default) will never automatically unload a stream once loaded unless the user navigates away entirely, so that it's always instantly visible on carousel scroll. Once unloaded, subsequently revisiting the camera will cause a reloading delay. Some live providers (e.g. `webrtc-card`) implement their own lazy unloading independently which may occur regardless of the value of this setting.                                                                                                                                   |
| `microphone`             |                                    | See [`microphone`](#microphone).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `preload`                | `false`                            | Whether or not to preload the live view. Preloading causes the live view to render in the background regardless of what view is actually shown, so it's instantly available when requested. The currently-selected camera's media is loaded in the background; other cameras follow the `lazy_load` setting (set `lazy_load: false` to preload them all). This consumes additional network/CPU resources continually.                                                                                                                                                                                                                                                                                                                                                                                         |
| `show_image_during_load` | `true`                             | If `true`, during the initial stream load, the `image` live provider will be shown instead of the loading video stream. This still image will auto-refresh and is replaced with the live stream once loaded.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `transition_effect`      | `slide`                            | Effect to apply as a transition between live cameras. Accepted values: `slide` or `none`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `zoomable`               | `true`                             | Whether or not the live carousel can be zoomed and panned, via touch/pinch and mouse scroll wheel with `ctrl` held.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## `controls`

Configure the controls for the `live` view.

```yaml
live:
  controls:
    # [...]
```

| Option          | Default | Description                                                                                                        |
| --------------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| `builtin`       | `true`  | Whether to show the built in (browser) video controls on live video.                                               |
| `next_previous` |         | Configures how the "Next & Previous" controls are shown on the `live` view. See [`next_previous`](#next_previous). |
| `thumbnails`    |         | Configures how thumbnails are shown on the `live` view. See [`thumbnails`](#thumbnails).                           |
| `timeline`      |         | Configures how the mini-timeline is shown on the `live` view. See [`timeline`](#timeline).                         |
| `wheel`         | `true`  | Whether to allow mouse wheel to scroll through the carousel.                                                       |

### `next_previous`

Configures how the "Next & Previous" controls are shown on the live view.

```yaml
live:
  controls:
    next_previous:
      # [...]
```

| Option  | Default    | Description                                                                                                                                    |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `size`  | `48`       | The size of the next/previous controls in pixels. Must be &gt;= `20`.                                                                          |
| `style` | `chevrons` | When viewing live cameras, what kind of controls to show to move to the previous/next camera. Acceptable values: `chevrons`, `icons`, `none` . |

### `ptz`

Configures the PTZ (Pan Tilt Zoom) controls.

```yaml
live:
  controls:
    ptz:
      # [...]
```

| Option          | Default        | Description                                                                                                                                                                                                                     |
| --------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hide_home`     | `false`        | When `true` the Home and Presets buttons of the control are hidden                                                                                                                                                              |
| `hide_pan_tilt` | `false`        | When `true` the Pan & Tilt buttons of the control is hidden                                                                                                                                                                     |
| `hide_type`     | `false`        | When `true` the button that switches between `buttons` and `gestures` PTZ control types is hidden. This button is automatically hidden on cameras without physical PTZ support.                                                 |
| `hide_zoom`     | `false`        | When `true` the Zoom button of the control is hidden                                                                                                                                                                            |
| `mode`          | `auto`         | If `on`, PTZ controls are always shown. If `off`, PTZ controls are never shown. If `auto`, PTZ controls are shown only for cameras with physical PTZ support.                                                                   |
| `orientation`   | `horizontal`   | Whether to show a `vertical` or `horizontal` PTZ control.                                                                                                                                                                       |
| `position`      | `bottom-right` | Whether to position the control on the `top-left`, `top-right`, `bottom-left` or `bottom-right`. This may be overridden by using the `style` parameter to precisely control placement.                                          |
| `style`         |                | Optionally position and style the element using CSS. Similar to [Picture Element styling](https://www.home-assistant.io/dashboards/picture-elements/#how-to-use-the-style-object), except without any default, e.g. `left: 42%` |
| `type`          | `buttons`      | The PTZ control type: `buttons` shows directional button controls, `gestures` enables drag, pinch, and scroll wheel to pan, tilt, and zoom. Gesture controls only function on cameras with physical PTZ support.                |

> [!WARNING]
> PTZ control precision is affected by latency at multiple points: the command round-trip to the camera, the camera's own response time, and the delay before movement is visible in the live stream. Additionally, cameras that only support relative movement may move in non-smooth discrete steps, while continuous movement cameras may overshoot the intended position before a stop command arrives.

To configure the PTZ _actions_ taken for a particular camera, see [Camera PTZ Settings](./cameras/README.md?id=ptz).

### `thumbnails`

Configures how thumbnails are shown on the live view.

```yaml
live:
  controls:
    thumbnails:
      # [...]
```

| Option                  | Default | Description                                                                                                                                                     |
| ----------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`                  | `none`  | Whether to show the thumbnail carousel `below` the media, `above` the media, in a drawer to the `left` or `right` of the media or to hide it entirely (`none`). |
| `show_details`          | `false` | Whether to show event details (e.g. duration, start time, object detected, etc) alongside the thumbnail.                                                        |
| `show_download_control` | `false` | Whether to show the download control on each thumbnail.                                                                                                         |
| `show_favorite_control` | `true`  | Whether to show the favorite ('star') control on each thumbnail.                                                                                                |
| `show_info_control`     | `true`  | Whether to show the info ('i') control on each thumbnail.                                                                                                       |
| `show_review_control`   | `true`  | Whether to show the review ('check') control on each thumbnail.                                                                                                 |
| `show_timeline_control` | `false` | Whether to show the timeline ('target') control on each thumbnail.                                                                                              |
| `size`                  | `100`   | The size of the thumbnails in the thumbnail carousel in pixels. Must be &gt;= `75` and &lt;= `300`.                                                             |

### `timeline`

Configures how the mini-timeline is shown on the live view.

```yaml
live:
  controls:
    timeline:
      # [...]
```

| Option                 | Default  | Description                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clustering_threshold` | `3`      | The minimum number of overlapping events to allow prior to clustering/grouping them. Higher numbers cause clustering to happen less frequently. Depending on the timescale/zoom of the timeline, the underlying timeline library may still allow overlaps for low values of this parameter -- for a fully "flat" timeline use the `ribbon` style. `0` disables clustering entirely. Only used in the `stack` style of timeline. |
| `format`               |          | Configuration for the timeline time & date format. See [`format`](#format).                                                                                                                                                                                                                                                                                                                                                     |
| `mode`                 | `none`   | Whether to show the thumbnail carousel `below` the media, `above` the media, in a drawer to the `left` or `right` of the media or to hide it entirely (`none`).                                                                                                                                                                                                                                                                 |
| `pan_mode`             | `pan`    | See [timeline pan mode](timeline-pan-mode.md).                                                                                                                                                                                                                                                                                                                                                                                  |
| `show_recordings`      | `true`   | Whether to show recordings on the timeline (specifically: which hours have any recorded content).                                                                                                                                                                                                                                                                                                                               |
| `style`                | `ribbon` | Whether the timeline should show events as a single flat `ribbon` or a `stack` of events that are clustered using the `clustering_threshold`.                                                                                                                                                                                                                                                                                   |
| `window_seconds`       | `3600`   | The length of the default timeline in seconds. By default, 1 hour (`3600` seconds) is shown in the timeline.                                                                                                                                                                                                                                                                                                                    |

[](common/timeline-seek-info.md ':include')

#### `format`

Configure the date and time format for the `timeline` view.

```yaml
live:
  controls:
    timeline:
      format:
        # [...]
```

| Option | Default | Description                                                                     |
| ------ | ------- | ------------------------------------------------------------------------------- |
| `24h`  | `true`  | If `true` shows time in 24-hour clock. If `false` otherwise uses 12-hour clock. |

## `display`

Controls whether to show a single or grid `live` view.

```yaml
live:
  display:
    # [...]
```

| Option                       | Default   | Description                                                                                                                                                                                                                                                                                                                      |
| ---------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grid_columns`               |           | If specified the grid will always have exactly this number of columns.                                                                                                                                                                                                                                                           |
| `grid_max_columns`           | `4`       | If specified, and `grid_columns` is not specified, the grid will not render more than this number of columns.                                                                                                                                                                                                                    |
| `grid_selected_position`     | `default` | Controls where the selected item should be laid out in the grid. If `default`, the cameras are laid out in the order they are specified in the configuration and selecting a camera does not change this order. If `first`, the selected camera is moved to the start of the grid, if `last` it is moved to the end of the grid. |
| `grid_selected_width_factor` | `2`       | How much to scale up the selected media item in a grid. A value of `1` will not scale the selected item at all, the default value of `2` will scale the media item width to twice what it would otherwise be, etc.                                                                                                               |
| `mode`                       | `single`  | Whether to display a `single` live camera in a carousel, or all cameras in a `grid` configuration.                                                                                                                                                                                                                               |

See the [grid layout algorithm](grid-layout-algorithm.md) for more details on how the grid lays elements out.

## `microphone`

Controls the behavior of the microphone in the `live` view.

```yaml
live:
  microphone:
```

| Option                               | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `always_connected`                   | `false` | Whether or not to keep the microphone stream continually connected while the card is running, or only when microphone is used (default). In the latter case there'll be a connection reset when the microphone is first used -- using this option can avoid that reset.                                                                                                                                                                                                              |
| `auto_mute`                          | `[]`    | A list of conditions in which the microphone is muted. `unselected` will automatically mute the microphone when a camera is unselected in the carousel or grid. `hidden` will automatically mute the microphone when the card becomes hidden (e.g. browser/tab change). Use an empty list (`[]`, the default) to never automatically mute the microphone via these conditions.                                                                                                       |
| `auto_unmute`                        | `[]`    | A list of conditions in which the microphone is unmuted. `selected` will automatically unmute the microphone when a camera is selected in the carousel or grid (useful for an always-hot mic on the currently selected camera). `visible` will automatically unmute when the card becomes visible. Use an empty list (`[]`, the default) to never automatically unmute the microphone via these conditions. The browser will still prompt for microphone permission on first unmute. |
| `disconnect_seconds`                 | `90`    | The number of seconds after microphone usage to disconnect the microphone from the stream. `0` implies never. Not relevant if `always_connected` is `true`.                                                                                                                                                                                                                                                                                                                          |
| `lock`                               | `true`  | Whether to lock disruptive actions (view/camera/substream changes, pause, reload, casting) while the microphone is unmuted. Prevents an accidental tap, swipe, or button press from cutting off the session mid-sentence during 2-way audio. Set to `false` to allow all actions regardless of microphone state.                                                                                                                                                                     |
| `mute_after_microphone_mute_seconds` | `60`    | The number of seconds after the microphone mutes to automatically mute the inbound audio when `live.auto_mute` includes `microphone`.                                                                                                                                                                                                                                                                                                                                                |

See [Using 2-way audio](../usage/2-way-audio.md) for more information about the very particular requirements that must be followed for 2-way audio to work.

## Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
live:
  auto_play:
    - selected
    - visible
  auto_pause: []
  auto_mute:
    - unselected
    - hidden
  auto_unmute:
    - microphone
  preload: false
  lazy_load: true
  lazy_unload: []
  draggable: true
  zoomable: true
  transition_effect: slide
  controls:
    builtin: true
    next_previous:
      style: chevrons
      size: 48
    wheel: true
    ptz:
      mode: auto
      position: bottom-right
      orientation: horizontal
      hide_pan_tilt: false
      hide_zoom: false
      hide_home: false
      hide_type: false
      type: buttons
      style:
        # Optionally override the default style.
        right: 5%
    thumbnails:
      size: 100
      show_details: false
      show_download_control: false
      show_favorite_control: true
      show_info_control: true
      show_review_control: true
      show_timeline_control: false
      mode: none
    timeline:
      style: ribbon
      mode: none
      pan_mode: pan
      clustering_threshold: 3
      show_recordings: true
      window_seconds: 3600
      format:
        24h: true
  microphone:
    always_connected: false
    auto_mute: []
    auto_unmute: []
    disconnect_seconds: 90
    lock: true
    mute_after_microphone_mute_seconds: 60
  display:
    mode: single
    grid_selected_position: default
    grid_selected_width_factor: 2
    grid_max_columns: 4
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
