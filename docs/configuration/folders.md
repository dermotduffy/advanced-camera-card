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

| Option | Default           | Description                                                                                                                                                                                    |
| ------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `root` | `media-source://` | The root identifier of the Home Assistant media folder. This is a string starting with `media-source://` followed by a format dictated by the integration that is providing this media source. |

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
