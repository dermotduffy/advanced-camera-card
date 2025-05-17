# `folders`

The `folders` stanza is used for configuring folders from which media/subfolders may be viewed.

?> To configure the behavior of the gallery in which folders are displayed, see the [`folder_gallery` configuration](./folder-gallery.md).

```yaml
folders:
  # [...]
```

| Option  | Default | Description                                                                                                                                    |
| ------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`    |         | An optional folder `id` which can be used by the [`folder` action](./actions/custom/README.md?id=folder) to show a particular folder contents. |
| `ha`    |         | Options for `ha` folder types. See below.                                                                                                      |
| `icon`  |         | An optional folder icon.                                                                                                                       |
| `title` |         | An optional folder title.                                                                                                                      |
| `type`  | `ha`    | The type of folder, `ha` for Home Assistant media folders (currently the only supported type of folder).                                       |

## `ha`

Used to specify a Home Assistant media folder.

```yaml
folders:
  - type: ha
    ha:
      # [...]
```

| Option | Default                     | Description                                                                                                                                                                             |
| ------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`  |                             | An optional Home Assistant `Media` browser URL to use as the query base. If `path` is also specified, those matchers are applied against folders "below" the folder specified in `url`. |
| `path` | [`{ id: media-source:// }`] | An optional array of matchers to dynamically compare against the Home Assistant media folder hierarchy. See below.                                                                      |

?> `url` is never fetched, nor sent over the network. It is only processed
locally in your browser. The host part of the URL can optionally be removed.

### `path`

An array of matchers to navigate "down" a folder hierarchy. If `url` is also
specified, matchers are applied starting at that folder, otherwise they are
applied at the media source root (i.e. `media-source://`).

```yaml
folders:
  - type: ha
    ha:
      path:
        # [...]
```

| Option     | Default | Description                                            |
| ---------- | ------- | ------------------------------------------------------ |
| `id`       |         | An optional media source `id` to match against.        |
| `title`    |         | An optional title name to match against.               |
| `title_re` |         | An optional title regular expression to match against. |

See [Folders Examples](../examples.md?id=folders).

?> Specifying multiple `path` matchers (other than `id`) requires a query at
each level of the folder hierarchy and is slower than directly specifying the
media source `id` (if known) or the `url` of the folder.

#### Understanding Media Source IDs and "parent folders"

Home Assistant Media Source IDs are typically long integration-specific non-user
friendly strings that refer to a media item, or folder of media items. Media
source "folders" do not have an intrinsic parent as with filesystem folders,
rather a trail is built as the user navigates "downwards" -- but anything could
theoretically be the parent of anything.

## Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
folders:
  - type: ha
    ha:
      url: https://my-ha-instance.local/media-browser/browser/app%2Cmedia-source%3A%2F%2Ffrigate
      path:
        - id: 'media-source://'
        - title: 'Frigate'
        - title_re: 'Clips.*'
        - title_re: 'Person.*'
```
