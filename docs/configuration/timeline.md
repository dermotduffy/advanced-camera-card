# `timeline`

Configures a `timeline` view used to show the timing sequence of events and
recordings across multiple cameras.

```yaml
timeline:
  # [...]
```

You can interact with the timeline in a number of ways:

- Clicking on an event/review will take you to the media viewer for that event/review.
- Clicking on the "background", or a camera title, will take you to the recordings for that camera (seeking to the clicked time).
- Clicking on the time axis will take you to recordings for all cameras (seeking to the clicked time).

| Option                 | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clustering_threshold` | `3`     | The minimum number of overlapping events to allow prior to clustering/grouping them. Higher numbers cause clustering to happen less frequently. Depending on the timescale/zoom of the timeline, the underlying timeline library may still allow overlaps for low values of this parameter -- for a fully "flat" timeline use the `ribbon` style. `0` disables clustering entirely. Only used in the `stack` style of timeline. |
| `controls`             |         | Configuration for the timeline controls. See [`controls`](#controls).                                                                                                                                                                                                                                                                                                                                                           |
| `format`               |         | Configuration for the timeline time & date format. See [`format`](#format).                                                                                                                                                                                                                                                                                                                                                     |
| `show_recordings`      | `true`  | Whether to show recordings on the timeline (specifically: which hours have any recorded content).                                                                                                                                                                                                                                                                                                                               |
| `style`                | `stack` | Whether the timeline should show events as a single flat `ribbon` or a `stack` of events that are clustered using the `clustering_threshold`.                                                                                                                                                                                                                                                                                   |
| `window_seconds`       | `3600`  | The length of the default timeline in seconds. By default, 1 hour (`3600` seconds) is shown in the timeline.                                                                                                                                                                                                                                                                                                                    |

## `controls`

Configure the controls for the `timeline` view.

```yaml
timeline:
  controls:
    # [...]
```

| Option       | Default | Description                                                                                  |
| ------------ | ------- | -------------------------------------------------------------------------------------------- |
| `thumbnails` |         | Configures how thumbnails are shown on the `timeline` view. See [`thumbnails`](#thumbnails). |

## `format`

Configure the date and time format for the `timeline` view.

```yaml
timeline:
  format:
    # [...]
```

| Option | Default | Description                                                                     |
| ------ | ------- | ------------------------------------------------------------------------------- |
| `24h`  | `true`  | If `true` shows time in 24-hour clock. If `false` otherwise uses 12-hour clock. |

### `thumbnails`

Configures how thumbnails are shown on the timeline.

```yaml
timeline:
  controls:
    thumbnails:
      # [...]
```

| Option                  | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `style`                 | `auto`  | How details are presented for each thumbnail. `auto` chooses from the configuration and the available width. `none` shows just the thumbnail without details. `overlay` shows the details over the thumbnail, `hover` shows those same details only while the pointer is over the thumbnail, and `panel` shows a details panel beside the thumbnail. `hover` is rendered as `overlay` when there is no pointer, and for items whose pictures are insufficient to uniquely identify them (e.g. a folder, or media with no picture). |
| `mode`                  | `right` | Whether to show the thumbnail carousel `below` the media, `above` the media, in a drawer to the `left` or `right` of the media or to hide it entirely (`none`). With `style: auto`, a `left` or `right` drawer shows a details panel beside each thumbnail, while `above` and `below` show the details on hover instead, or as a permanent overlay on touch devices without a pointer.                                                                                                                                             |
| `show_download_control` | `false` | Whether to show the download control on each thumbnail.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `show_favorite_control` | `true`  | Whether to show the favorite ('star') control on each thumbnail.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `show_info_control`     | `true`  | Whether to show the info ('i') control on each thumbnail. Ignored when `style` is `panel` as the panel shows the information.                                                                                                                                                                                                                                                                                                                                                                                                      |
| `show_review_control`   | `true`  | Whether to show the review ('check') control on each thumbnail.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `show_timeline_control` | `false` | Whether to show the timeline ('target') control on each thumbnail.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `size`                  | `100`   | The size of the thumbnails in the thumbnail carousel in pixels. Must be &gt;= `75` and &lt;= `300`.                                                                                                                                                                                                                                                                                                                                                                                                                                |

> [!NOTE]
> The `show_*_control` options are advisory. A `false` always hides that control,
> but a `true` is only honored where there is sufficient space to usefully show
> the control.

> [!TIP]
> Holding a thumbnail shows the same information the info ('i') control does.

## Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
timeline:
  style: stack
  clustering_threshold: 3
  show_recordings: true
  window_seconds: 3600
  format:
    24h: true
  controls:
    thumbnails:
      mode: right
      size: 100
      style: auto
      show_download_control: false
      show_favorite_control: true
      show_info_control: true
      show_review_control: true
      show_timeline_control: false
```
