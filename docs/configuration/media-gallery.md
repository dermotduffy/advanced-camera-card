# `media_gallery`

The `media_gallery` is used for providing an overview of all `clips`,
`snapshots`, `recordings`, `reviews` and `folders`.

```yaml
media_gallery:
  # [...]
```

| Option     | Default | Description                                                                                                                                                |
| ---------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actions`  |         | [Actions](actions/README.md) to use for all views that use the `media_gallery` (e.g. `clips`, `snapshots`, `recordings`, `reviews`, `folders`, `gallery`). |
| `controls` |         | Configuration for the Media Gallery controls. See [`controls`](#controls).                                                                                 |

## `controls`

### `filter`

Configure the media gallery filter.

```yaml
media_gallery:
  controls:
    filter:
      # [...]
```

| Option | Default | Description                                                                                                                                               |
| ------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode` | `right` | Whether to show the gallery media filter to the `left`, to the `right` or `none` for no media filter. The `folder` view does not support media filtering. |

### `thumbnails`

Configure the media gallery thumbnails.

```yaml
media_gallery:
  controls:
    thumbnails:
      # [...]
```

| Option                  | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `style`                 | `auto`  | How details are presented for each thumbnail. `auto` chooses from the configuration and the available width. `plain` shows just the thumbnail without details. `overlay` shows the details over the thumbnail, `hover` shows those same details only while the pointer is over the thumbnail, and `panel` shows a details panel beside the thumbnail. `hover` is rendered as `overlay` when there is no pointer. |
| `show_download_control` | `false` | Whether to show the download control on each thumbnail.                                                                                                                                                                                                                                                                                                                                                          |
| `show_favorite_control` | `true`  | Whether to show the favorite ('star') control on each thumbnail.                                                                                                                                                                                                                                                                                                                                                 |
| `show_info_control`     | `true`  | Whether to show the info ('i') control on each thumbnail. Ignored when `style` is `panel` as the panel shows the information.                                                                                                                                                                                                                                                                                    |
| `show_review_control`   | `true`  | Whether to show the review ('check') control on each thumbnail.                                                                                                                                                                                                                                                                                                                                                  |
| `show_timeline_control` | `false` | Whether to show the timeline ('target') control on each thumbnail.                                                                                                                                                                                                                                                                                                                                               |
| `size`                  | `100`   | The largest size the thumbnails in the gallery are drawn at. Must be &gt;= `75` and &lt;= `300`. The gallery fits whole columns across the width available to it, so thumbnails are usually drawn smaller than this. How much a thumbnail shows, and how big its controls are, follows the size it is drawn at rather than this value.                                                                           |

> [!NOTE]
> The `show_*_control` options are advisory. A `false` always hides that control,
> but a `true` is only honored where there is sufficient space to usefully show
> the control.

> [!TIP]
> Holding a thumbnail shows the same information the info ('i') control does.

## Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
media_gallery:
  controls:
    filter:
      mode: 'right'
    thumbnails:
      size: 100
      style: auto
      show_download_control: false
      show_favorite_control: true
      show_info_control: true
      show_review_control: true
      show_timeline_control: false
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
