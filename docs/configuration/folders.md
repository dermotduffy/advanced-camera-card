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

| Option     | Default             | Description                                                                                                                                                                                                                                            |
| ---------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `path`     | [`media-source://`] | An array of media source paths for Home Assistant media folder. These are strings starting with `media-source://` followed by a format dictated by the integration that is providing this media source. Multiple paths represent the folder hierarchy. |
| `path_url` |                     | A Home Assistant `Media` browser URL from which the `paths` are parsed. If `path` is also set that takes precedence.                                                                                                                                   |

### Understanding media source paths

Home Assistant media source paths with typically long integration-specific
non-user friendly strings that refer to a media item, or folder of media items.
Media source "folders" do not have an intrinsic parent as with filesystem
folders, rather a trail is built as the user navigates "downwards" -- but
anything could theoretically be the parent of anything.

The `path` parameter is an array of media-source paths representing this
"trail". The folder will open at the last path in the array, and "upwards"
navigation will be allowed to the previous paths in the array.

For example:

```yaml
path:
  - media-source://
  - media-source://frigate
```

... will show the `media-source://frigate` folder upon opening, but also show an
"up" arrow to go up to `media-source://`.

As media-source paths are not typically user-exposed, a simple way to set these
values is simply by navigating in the Home Assistant `Media` browser (in the
sidebar) to the folder you wish to refer to, then copy and paste the whole
browser URL into the `path_url` parameter. The trail of paths will automatically
be extracted out of the URL.

?> `path_url` is never fetched, nor sent over the network. It is only processed
locally in your browser. The host part of the URL can optionally be removed.

## Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
folders:
  - type: ha
    id: optional-folder-id
    title: Folder Title
    icon: mdi:cow
    ha:
      root: media-source://
```
