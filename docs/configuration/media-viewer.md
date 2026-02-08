# `media_viewer`

The `media_viewer` section configures viewing all `clip`, `snapshot`, `recording`, `review`, `folder` or `media` view, in either a media carousel or grid.

```yaml
media_viewer:
  # [...]
```

| Option                      | Default                | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actions`                   |                        | [Actions](actions/README.md) to use for all views that use the `media_viewer` (e.g. `media`, `clip`, `snapshot`, `recording`, `review`, `folder`).                                                                                                                                                                                                                                                                                                                                                                            |
| `auto_mute`                 | `[unselected, hidden]` | A list of conditions in which media items are muted. `unselected` will automatically mute when a media item is unselected in the carousel or grid. `hidden` will automatically mute when the browser/tab becomes hidden. Use an empty list (`[]`) to never automatically mute.                                                                                                                                                                                                                                                |
| `auto_pause`                | `[unselected, hidden]` | A list of conditions in which media items are automatically paused. `unselected` will automatically pause when a media item is unselected in the carousel or grid. `hidden` will automatically pause when the browser/tab becomes hidden. Use an empty list (`[]`) to never automatically pause.                                                                                                                                                                                                                              |
| `auto_play`                 | `[selected, visible]`  | A list of conditions in which media items are automatically played. `selected` will automatically play when a media item is selected in a carousel or grid. `visible` will automatically play when a media item becomes visible (e.g. browser tab change, or visible in a grid but not selected). Use an empty list (`[]`) to never automatically play.                                                                                                                                                                       |
| `auto_unmute`               | `[]`                   | A list of conditions in which media items are unmuted. `selected` will automatically unmute when a media item is selected in a carousel or grid. `visible` will automatically unmute when a media item becomes visible (e.g. a browser/tab change, or visible in a grid but not selected). Use an empty list (`[]`) to never automatically unmute. Some browsers will not allow automated unmute until the user has interacted with the page in some way -- if the user has not then the browser may pause the media instead. |
| `controls`                  |                        | Configuration for the Media viewer controls. See below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `draggable`                 | `true`                 | Whether or not the Media viewer carousel can be dragged left or right, via touch/swipe and mouse dragging.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `lazy_load`                 | `true`                 | Whether or not to lazily load media in the Media viewer carousel. Setting this will false will fetch all media immediately which may make the carousel experience smoother at a cost of (potentially) a substantial number of simultaneous media fetches on load.                                                                                                                                                                                                                                                             |
| `snapshot_click_plays_clip` | `true`                 | Whether clicking on a snapshot in the media viewer should play a related clip.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `transition_effect`         | `slide`                | Effect to apply as a transition between event media. Accepted values: `slide` or `none`.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `zoomable`                  | `true`                 | Whether or not the Media Viewer can be zoomed and panned, via touch/pinch and mouse scroll wheel with `ctrl` held.                                                                                                                                                                                                                                                                                                                                                                                                            |

## `controls`

Configure the controls for the media player views.

```yaml
media_viewer:
  controls:
    # [...]
```

| Option          | Default | Description                                                                             |
| --------------- | ------- | --------------------------------------------------------------------------------------- |
| `builtin`       | `true`  | Whether to show the built in (browser) video controls on media viewer videos.           |
| `next_previous` |         | Configures how the "Next & Previous" controls are shown on the media viewer. See below. |
| `thumbnails`    |         | Configures how thumbnails are shown on the media viewer. See below.                     |
| `timeline`      |         | Configures how the mini-timeline is shown on the media viewer. See below.               |
| `wheel`         | `true`  | Whether to allow mouse wheel to scroll through the carousel.                            |

### `next_previous`

Configures how the "Next & Previous" controls are shown on the media viewer.

```yaml
media_viewer:
  controls:
    next_previous:
      # [...]
```

| Option  | Default      | Description                                                                                                                                      |
| ------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `size`  | `48`         | The size of the next/previous controls in pixels. Must be &gt;= `20`.                                                                            |
| `style` | `thumbnails` | When viewing media, what kind of controls to show to move to the previous/next media item. Acceptable values: `thumbnails`, `chevrons`, `none` . |

### `ptz`

Configures the PTZ (Pan Tilt Zoom) controls. As the media viewer is never
viewing live view, the PTZ controls in this context always refer to digital (vs
real) panning and zooming.

```yaml
media_viewer:
  controls:
    ptz:
      # [...]
```

| Option          | Default        | Description                                                                                                                                                                                                                     |
| --------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hide_home`     | `false`        | When `true` the Home button of the control is hidden                                                                                                                                                                            |
| `hide_pan_tilt` | `false`        | When `true` the Pan & Tilt buttons of the control is hidden                                                                                                                                                                     |
| `hide_zoom`     | `false`        | When `true` the Zoom button of the control is hidden                                                                                                                                                                            |
| `mode`          | `off`          | If `on` or `off` will always or never show PTZ controls respectively.                                                                                                                                                           |
| `orientation`   | `horizontal`   | Whether to show a `vertical` or `horizontal` PTZ control.                                                                                                                                                                       |
| `position`      | `bottom-right` | Whether to position the control on the `top-left`, `top-right`, `bottom-left` or `bottom-right`. This may be overridden by using the `style` parameter to precisely control placement.                                          |
| `style`         |                | Optionally position and style the element using CSS. Similar to [Picture Element styling](https://www.home-assistant.io/dashboards/picture-elements/#how-to-use-the-style-object), except without any default, e.g. `left: 42%` |

### `thumbnails`

Configures how thumbnails are shown on the media viewer.

```yaml
media_viewer:
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
| `size`                  | `100`   | The size of the thumbnails in the thumbnail carousel pixels. Must be &gt;= `75` and &lt;= `300`.                                                                |

### `timeline`

Configures how the mini-timeline is shown on the media viewer.

```yaml
media_viewer:
  controls:
    timeline:
      # [...]
```

| Option                 | Default  | Description                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clustering_threshold` | `3`      | The minimum number of overlapping events to allow prior to clustering/grouping them. Higher numbers cause clustering to happen less frequently. Depending on the timescale/zoom of the timeline, the underlying timeline library may still allow overlaps for low values of this parameter -- for a fully "flat" timeline use the `ribbon` style. `0` disables clustering entirely. Only used in the `stack` style of timeline. |
| `format`               |          | Configuration for the timeline time & date format. See below.                                                                                                                                                                                                                                                                                                                                                                   |
| `mode`                 | `none`   | Whether to show the thumbnail carousel `below` the media, `above` the media, in a drawer to the `left` or `right` of the media or to hide it entirely (`none`).                                                                                                                                                                                                                                                                 |
| `pan_mode`             | `pan`    | See [timeline pan mode](timeline-pan-mode.md).                                                                                                                                                                                                                                                                                                                                                                                  |
| `show_recordings`      | `true`   | Whether to show recordings on the timeline (specifically: which hours have any recorded content).                                                                                                                                                                                                                                                                                                                               |
| `style`                | `ribbon` | Whether the timeline should show events as a single flat `ribbon` or a `stack` of events that are clustered using the `clustering_threshold`.                                                                                                                                                                                                                                                                                   |
| `window_seconds`       | `3600`   | The length of the default timeline in seconds. By default, 1 hour (`3600` seconds) is shown in the timeline.                                                                                                                                                                                                                                                                                                                    |

[](common/timeline-seek-info.md ':include')

#### `format`

Configure the date and time format for the `timeline` view.

```yaml
media_viewer:
  controls:
    timeline:
      format:
        # [...]
```

| Option | Default | Description                                                                     |
| ------ | ------- | ------------------------------------------------------------------------------- |
| `24h`  | `true`  | If `true` shows time in 24-hour clock. If `false` otherwise uses 12-hour clock. |

## `display`

Controls whether to show a single media item or grid in the media viewer.

```yaml
media_viewer:
  display:
    # [...]
```

| Option                       | Default   | Description                                                                                                                                                                                                                                                                                                                      |
| ---------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grid_columns`               |           | If specified the grid will always have exactly this number of columns.                                                                                                                                                                                                                                                           |
| `grid_max_columns`           | `4`       | If specified, and `grid_columns` is not specified, the grid will not render more than this number of columns.                                                                                                                                                                                                                    |
| `grid_selected_position`     | `default` | Controls where the selected item should be laid out in the grid. If `default`, the cameras are laid out in the order they are specified in the configuration and selecting a camera does not change this order. If `first`, the selected camera is moved to the start of the grid, if `last` it is moved to the end of the grid. |
| `grid_selected_width_factor` | `2`       | How much to scale up the selected media item in a grid. A value of `1` will not scale the selected item at all, the default value of `2` will scale the media item width to twice what it would otherwise be, etc.                                                                                                               |
| `mode`                       | `single`  | Whether to display a `single` media item at a time, or a media item for all cameras in a `grid` configuration.                                                                                                                                                                                                                   |

See the [grid layout algorithm](grid-layout-algorithm.md) for more details on how the grid lays elements out.

## Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
media_viewer:
  auto_play:
    - selected
    - visible
  auto_pause:
    - unselected
    - hidden
  auto_mute:
    - unselected
    - hidden
  auto_unmute: []
  lazy_load: true
  draggable: true
  zoomable: true
  snapshot_click_plays_clip: true
  transition_effect: slide
  controls:
    builtin: true
    next_previous:
      size: 48
      style: thumbnails
    wheel: true
    ptz:
      mode: off
      position: bottom-right
      orientation: horizontal
      hide_pan_tilt: false
      hide_zoom: false
      hide_home: false
      style:
        # Optionally override the default style.
        right: 5%
    thumbnails:
      size: 100
      mode: none
      show_details: false
      show_download_control: false
      show_favorite_control: true
      show_info_control: true
      show_review_control: true
      show_timeline_control: false
    timeline:
      style: ribbon
      mode: none
      pan_mode: pan
      clustering_threshold: 3
      show_recordings: true
      window_seconds: 3600
      format:
        24h: true
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
