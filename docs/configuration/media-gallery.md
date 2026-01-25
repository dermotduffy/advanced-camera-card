# `media_gallery`

The `media_gallery` is used for providing an overview of all `clips`,
`snapshots`, `recordings`, `reviews` and `folder` contents in a thumbnail
gallery.

```yaml
media_gallery:
  # [...]
```

| Option     | Default | Description                                                                                                                         |
| ---------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `actions`  |         | [Actions](actions/README.md) to use for all views that use the `media_gallery` (e.g. `clips`, `folder`, `snapshots`, `recordings`). |
| `controls` |         | Configuration for the Media Gallery controls. See below.                                                                            |

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

| Option                  | Default | Description                                                                                              |
| ----------------------- | ------- | -------------------------------------------------------------------------------------------------------- |
| `show_details`          | `false` | Whether to show media details (e.g. duration, start time, object detected, etc) alongside the thumbnail. |
| `show_download_control` | `false` | Whether to show the download control on each thumbnail.                                                  |
| `show_favorite_control` | `true`  | Whether to show the favorite ('star') control on each thumbnail.                                         |
| `show_info_control`     | `true`  | Whether to show the info ('i') control on each thumbnail.                                                |
| `show_review_control`   | `true`  | Whether to show the review ('check') control on each thumbnail.                                          |
| `show_timeline_control` | `false` | Whether to show the timeline ('target') control on each thumbnail.                                       |
| `size`                  | `100`   | The size of the thumbnails in the gallery. Must be &gt;= `75` and &lt;= `300`.                           |

## Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
media_gallery:
  controls:
    filter:
      mode: 'right'
    thumbnails:
      size: 100
      show_details: false
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
