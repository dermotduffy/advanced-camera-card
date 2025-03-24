# `remote_control`

The `remote_control` configuration options control how a card instance can be remotely controlled.

```yaml
remote_control:
  # [...]
```

## `entities`

Sets entities that are used to control different aspects of the card.

```yaml
remote_control:
  entities:
    # [...]
```

| Option            | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `camera`          |         | An `input_select` entity that the card will use for bidirectional control. When the selected camera on the card changes the entity will be updated to match. Likewise, when the entity state changes, the selected camera on the card will be updated to match. When the card is first started, the `input_select` entity will be updated to only have valid camera IDs from this card and the selected camera on the card will be updated to the existing entity value. Entities used for camera remote control must start with `input_select.`. |
| `camera_priority` | `card`  | Controls whether the `card` or the `entity` has priority on initial card load. If `card`, the entity state is updated to match the camera shown on load. If `entity`, the card will select the camera shown by the entity on load.                                                                                                                                                                                                                                                                                                                |

?> To create an `input_select` entity to use in this manner, in the visual card editor, under `Remote Control -> Remote Control Entities`, choose `Create a new Dropdown helper`. Give the new entity an entity name (e.g. `my_selected_camera`) and an optional icon. You must specify at least one option -- you can use any placeholder value (e.g. `camera`) then choose `Add` (the card will automatically reset the allowable options on start). Finally, click `Create`.

## Related Topics

- [Passing actions to the card in the URL](../usage/url-actions.md).

## Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
remote_control:
  entities:
    camera: input_select.my_selected_camera
    camera_priority: card
```
