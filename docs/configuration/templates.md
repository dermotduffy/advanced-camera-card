# Templates

Templates may be used in a certain places to allow template values (if present)
to be dynamically replaced. This allows a variety of Home Assistant data, and
Advanced Camera Card data, to be accessible. Templates may be used in:

- [Actions / Automations](./actions/README.md)
- [Folder Media Matchers](./folders.md?id=matchers)

## Stock Templates

The Advanced Camera Card uses
[ha-nunjucks](https://github.com/Nerwyn/ha-nunjucks) to process templates.
Consult its documentation for the wide variety of different template values
supported.

See [an example](../examples.md?id=accessing-home-assistant-state) that
accesses Home Assistant state.

## Custom Templates

Custom template values must be proceeded by `advanced_camera_card` (or `acc` for
short).

| Template | Replaced with                                     |
| -------- | ------------------------------------------------- |
| `camera` | The currently selected camera.                    |
| `view`   | The current [view](./view.md?id=supported-views). |

See [an example](../examples.md?id=accessing-advanced-camera-card-state) that
accesses Advanced Camera Card state.

### Media Matching

If templates are used for [Folder Media Matching](./folders.md?id=matchers) an
additional `media` variable is available with these properties:

Media template values must be proceeded by `advanced_camera_card.media` (or
`acc.media` for short).

| Template    | Replaced with                                                                     |
| ----------- | --------------------------------------------------------------------------------- |
| `title`     | The media title being matched.                                                    |
| `is_folder` | Whether the media item is a folder that may be expanded (vs a single media item). |

### Triggers

If the action is called by an [Advanced Camera Card
Automation](./automations.md), additional data is available representing the
current and prior state of whatever triggered the action.

Trigger template values must be proceeded by `advanced_camera_card.trigger` (or
`acc.trigger` for short).

| Template       | Replaced with                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------ |
| `camera.to`    | For [camera conditions](./conditions.md?id=camera), the currently selected camera.               |
| `camera.from`  | For [camera conditions](./conditions.md?id=camera), the previously selected camera.              |
| `view.to`      | For [view conditions](./conditions.md?id=view), the currently selected view.                     |
| `view.from`    | For [view conditions](./conditions.md?id=view), the previously selected view.                    |
| `state.entity` | For [state conditions](./conditions.md?id=state), the entity state that triggered the condition. |
| `state.to`     | For [state conditions](./conditions.md?id=state), the current state of the entity.               |
| `state.from`   | For [state conditions](./conditions.md?id=state), the previous state of the entity.              |

> [!NOTE]
> If an action is triggered with multiple [state
> conditions](./conditions.md?id=state), only data from the last listed state
> condition is available.

> [!NOTE]
> If you use an [`or`](./conditions.md?id=or) condition, only the trigger data
> for the first matching trigger will be included.

Please [request](https://github.com/dermotduffy/advanced-camera-card/issues) if
you need data from additional conditions.

See [an example](../examples.md?id=accessing-trigger-state) that accesses
trigger state.
