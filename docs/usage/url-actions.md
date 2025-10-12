# URL Actions

It is possible to pass the Advanced Camera Card one or more
[actions](../configuration/actions/README.md) from the URL (e.g. select a particular
camera, open the live view in expanded mode, etc).

### When actions are executed

The Advanced Camera Card will execute these actions in the following circumstances:

- On initial card load.
- On 'tab' change in a dashboard.
- When a `navigate` [action](https://www.home-assistant.io/dashboards/actions/)
  is called on the dashboard (e.g. a button click requests navigation).
- When the user uses the `back` / `forward` browser buttons whilst viewing a
  dashboard.

## Instructions

To send an action to _all_ Advanced Camera Cards on a dashboard:

```
[PATH_TO_YOUR_HA_DASHBOARD]?advanced-camera-card-action.[ACTION]=[VALUE]
```

To send an action to a specific named Advanced Camera Card:

```
[PATH_TO_YOUR_HA_DASHBOARD]?advanced-camera-card-action.[CARD_ID].[ACTION]=[VALUE]
```

> [!NOTE]
> For backwards compatibility, the card will also respond to `frigate-card-action` as a query-parameter with the same syntax.

| Parameter | Description                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------- |
| `ACTION`  | One of the supported Advanced Camera Card custom actions. See below.                              |
| `CARD_ID` | When specified only cards that have a [`card_id`](../configuration/README.md) parameter will act. |
| `VALUE`   | An optional value to use with the `camera_select` and `live_substream_select` actions.            |

> [!TIP]
> Both `.` and `:` may be used as the delimiter. If you use `:` some
> browsers may require it be escaped to `%3A`.

> [!NOTE]
> If a dashboard has multiple Advanced Camera Cards on it, even if they are on
> different 'tabs' within that dashboard, they will all respond to the actions
> unless the action is targeted with a `CARD_ID` as shown above.

## Supported Actions

Only a subset of all [actions](../configuration/actions/README.md) are supported in URL form.

| Action                                                                                | Supported in URL         | Explanation                                                                                                         |
| ------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `camera_select`                                                                       | :white_check_mark:       |                                                                                                                     |
| `camera_ui`                                                                           | :white_check_mark:       |                                                                                                                     |
| `clip`                                                                                | :white_check_mark:       |                                                                                                                     |
| `clips`                                                                               | :white_check_mark:       |                                                                                                                     |
| `default`                                                                             | :white_check_mark:       |                                                                                                                     |
| `download`                                                                            | :heavy_multiplication_x: | Latest media information is not available on initial render.                                                        |
| `expand`                                                                              | :white_check_mark:       |                                                                                                                     |
| `fullscreen`                                                                          | :heavy_multiplication_x: | Javascript does not support activating fullscreen without direct human interaction. Use `expand` as an alternative. |
| `image`                                                                               | :white_check_mark:       |                                                                                                                     |
| `live_substream_select`                                                               | :white_check_mark:       |                                                                                                                     |
| `live`                                                                                | :white_check_mark:       |                                                                                                                     |
| `media_player`                                                                        | :heavy_multiplication_x: | Please [request](https://github.com/dermotduffy/advanced-camera-card/issues) if you need this.                      |
| `menu_toggle`                                                                         | :white_check_mark:       |                                                                                                                     |
| `microphone_connect`, `microphone_disconnect`, `microphone_mute`, `microphone_unmute` | :heavy_multiplication_x: |                                                                                                                     |
| `mute`, `unmute`                                                                      | :heavy_multiplication_x: |                                                                                                                     |
| `play`, `pause`                                                                       | :heavy_multiplication_x: |                                                                                                                     |
| `ptz`                                                                                 | :heavy_multiplication_x: | Please [request](https://github.com/dermotduffy/advanced-camera-card/issues) if you need this.                      |
| `recording`                                                                           | :white_check_mark:       |                                                                                                                     |
| `recordings`                                                                          | :white_check_mark:       |                                                                                                                     |
| `screenshot`                                                                          | :heavy_multiplication_x: | Latest media information is not available on initial render.                                                        |
| `ptz_controls`                                                                        | :heavy_multiplication_x: | Please [request](https://github.com/dermotduffy/advanced-camera-card/issues) if you need this.                      |
| `snapshot`                                                                            | :white_check_mark:       |                                                                                                                     |
| `snapshots`                                                                           | :white_check_mark:       |                                                                                                                     |

## Examples

See [URL actions examples](../examples.md?id=url-actions).
