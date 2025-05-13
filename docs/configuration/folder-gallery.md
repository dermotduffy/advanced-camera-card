# `folder_gallery`

The `folder_gallery` shows media and subfolders present in a folder. The `folder_gallery` stanza configures the UI behavior of the gallery. To configure individual folders to show in the gallery, see the [`folders`](./folders.md) configuration.

?> Media from configured cameras (not from configured folders) is presented in the [`media_gallery`](./media-gallery.md) not the `folder_gallery`.

```yaml
folder_gallery:
  # [...]
```

| Option     | Default | Description                                                 |
| ---------- | ------- | ----------------------------------------------------------- |
| `actions`  |         | [Actions](actions/README.md) to use for the `folder` view . |
| `controls` |         | Configuration for the Folder Gallery controls. See below.   |

## `controls`

### `thumbnails`

Configure the folder gallery thumbnails.

```yaml
folder_gallery:
  controls:
    thumbnails:
      # [...]
```

| Option                  | Default | Description                                                                    |
| ----------------------- | ------- | ------------------------------------------------------------------------------ |
| `show_details`          | `false` | Whether to show media details (e.g. media/folder name).                        |
| `show_download_control` | `true`  | Whether to show the download control on each thumbnail.                        |
| `show_favorite_control` | `true`  | Whether to show the favorite ('star') control on each thumbnail.               |
| `show_timeline_control` | `true`  | Whether to show the timeline ('target') control on each thumbnail.             |
| `size`                  | `100`   | The size of the thumbnails in the gallery. Must be &gt;= `75` and &lt;= `300`. |

## Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
folder_gallery:
  controls:
    thumbnails:
      size: 100
      show_details: false
      show_download_control: true
      show_favorite_control: true
      show_timeline_control: true
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
