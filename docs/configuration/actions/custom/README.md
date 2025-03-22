# `custom:advanced-camera-card-action`

Execute an Advanced Camera Card action.

```yaml
action: custom:advanced-camera-card-action
# [...]
```

| Parameter                     | Description                                         |
| ----------------------------- | --------------------------------------------------- |
| `action`                      | Must be `custom:advanced-camera-card-action`.       |
| `advanced_camera_card_action` | A supported Advanced Camera Card action. See below. |

## `camera_select`

Select a given camera.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: camera_select
# [...]
```

| Parameter                     | Description                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `action`                      | Must be `custom:advanced-camera-card-action`.                                                       |
| `advanced_camera_card_action` | Must be `camera_select`.                                                                            |
| `camera`                      | The [camera ID](../../cameras/README.md?id=cameras) of the camera to select.                        |
| `triggered`                   | If `true` instead of `camera` being specified then a triggered camera (if any) is selected instead. |

This action will respect the value of the `view.camera_select` to choose the appropriate view on the new camera. See [`view` configuration](../../view.md).

## `camera_ui`

Download the displayed media.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: camera_ui
```

Open the UI for the selected camera engine (e.g. the Frigate UI).

## `clip`

Change to the `clip` view.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: clip
```

## `clips`

Change to the `clips` view.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: clips
```

## `default`

Change to the default view.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: default
```

## `diagnostics`

Show the card diagnostics.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: diagnostics
```

## `display_mode_select`

Select a display mode (e.g. view a `single` camera or a `grid` of cameras).

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: display_mode_select
# [...]
```

| Parameter                     | Description                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `action`                      | Must be `custom:advanced-camera-card-action`.                                                  |
| `advanced_camera_card_action` | Must be `display_mode_select`.                                                                 |
| `display_mode`                | `single` to show a single camera at a time in a carousel, or `grid` to show a grid of cameras. |

## `download`

Download the displayed media.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: download
```

## `expand`

Expand the card into a dialog/popup.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: expand
```

## `fullscreen`

Toggle fullscreen.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: fullscreen
```

## `image`

Change to the `image` view.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: image
```

## `live`

Change to the `live` view.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: live
```

## `live_substream_off`

Turn off the substream (if on).

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: live_substream_on
```

| Parameter                     | Description                                   |
| ----------------------------- | --------------------------------------------- |
| `action`                      | Must be `custom:advanced-camera-card-action`. |
| `advanced_camera_card_action` | Must be `live_substream_on`.                  |

## `live_substream_on`

Turn on the first available substream. Use [Camera dependency configuration](../../cameras/README.md?id=dependencies) to configure substreams.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: live_substream_on
```

| Parameter                     | Description                                   |
| ----------------------------- | --------------------------------------------- |
| `action`                      | Must be `custom:advanced-camera-card-action`. |
| `advanced_camera_card_action` | Must be `live_substream_on`.                  |

## `live_substream_select`

Select a substream. Use [Camera dependency configuration](../../cameras/README.md?id=dependencies) to configure substreams.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: live_substream_select
# [...]
```

| Parameter                     | Description                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `action`                      | Must be `custom:advanced-camera-card-action`.                                   |
| `advanced_camera_card_action` | Must be `live_substream_select`.                                                |
| `camera`                      | The [camera ID](../../cameras/README.md?id=cameras) of the substream to select. |

## `log`

Log a message to the Javascript console.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: log
# [...]
```

| Parameter                     | Default | Description                                                                    |
| ----------------------------- | ------- | ------------------------------------------------------------------------------ |
| `action`                      |         | Must be `custom:advanced-camera-card-action`.                                  |
| `advanced_camera_card_action` |         | Must be `log`.                                                                 |
| `message`                     |         | The message to log.                                                            |
| `level`                       | `info`  | The console logging level to use. One of `['debug', 'info', 'warn', 'error']`. |

## `media_player`

Perform a media player action.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: media_player
# [...]
```

| Parameter                     | Description                                                       |
| ----------------------------- | ----------------------------------------------------------------- |
| `action`                      | Must be `custom:advanced-camera-card-action`.                     |
| `advanced_camera_card_action` | Must be `media_player`.                                           |
| `media_player`                | The entity ID of the media_player on which to perform the action. |
| `media_player_action`         | Either `play` or `stop` to play or stop the media in question.    |

## `menu_toggle`

Show/hide the menu (for the `hidden` mode style).

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: menu_toggle
```

## `microphone_connect`

Connect the microphone for [2-way audio](../../../usage/2-way-audio.md).

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: microphone_connect
```

## `microphone_disconnect`

Disconnect the microphone during [2-way audio](../../../usage/2-way-audio.md).

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: microphone_disconnect
```

## `microphone_mute`

Mute the microphone during [2-way audio](../../../usage/2-way-audio.md).

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: microphone_mute
```

## `microphone_unmute`

Unmute the microphone during [2-way audio](../../../usage/2-way-audio.md).

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: microphone_unmute
```

## `mute`

Mute the selected media.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: mute
```

## `pause`

Pause the selected media.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: pause
```

## `play`

Play the selected media.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: play
```

## `ptz`

Execute a real PTZ action, whether configured manually (see [Camera PTZ configuration](../../cameras/README.md?id=ptz)) or auto-detected.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: ptz
# [...]
```

| Parameter                     |                           | Description                                                                                   |
| ----------------------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| `action`                      |                           | Must be `custom:advanced-camera-card-action`.                                                 |
| `advanced_camera_card_action` |                           | Must be `ptz`.                                                                                |
| `camera`                      | Currently selected camera | An optional camera ID to execute the action on.                                               |
| `ptz_action`                  |                           | Optional action that is of `left`, `right`, `up`, `down`, `zoom_in`, `zoom_out` or `preset`.  |
| `ptz_phase`                   |                           | Optional parameter that is one of `start` or `stop` to start or stop the movement separately. |
| `ptz_preset`                  |                           | Optional preset to execute when the `ptz_action` is `preset`.                                 |

?> If no `ptz_action` is specified, the camera returns to its "home" position. For a real PTZ camera, the "home" position is the first available preset. If there are no presets, there is no home position.

## `ptz_controls`

Show or hide the PTZ controls.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: ptz_controls
# [...]
```

| Parameter                     | Description                                              |
| ----------------------------- | -------------------------------------------------------- |
| `action`                      | Must be `custom:advanced-camera-card-action`.            |
| `advanced_camera_card_action` | Must be `ptz_controls`.                                  |
| `show`                        | If `true` shows the PTZ controls, if `false` hides them. |

## `ptz_digital`

Execute a digital PTZ action.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: ptz_digital
# [...]
```

| Parameter                     | Default                                                                                       | Description                                                                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `action`                      |                                                                                               | Must be `custom:advanced-camera-card-action`.                                                                                                              |
| `advanced_camera_card_action` |                                                                                               | Must be `ptz_digital`.                                                                                                                                     |
| `target_id`                   | The currently selected camera or media                                                        | The target (camera or media) to execute a digital PTZ action on. Can be a camera ID, or another media ID (e.g. for Frigate, can specify a media/event ID). |
| `ptz_action`                  | Optional action that is one of `left`, `right`, `up`, `down`, `zoom_in` or `zoom_out`.        |
| `ptz_phase`                   | Optional parameter that is one of `start` or `stop` to start or stop the movement separately. |
| `absolute`                    | Optional parameter to specify exact absolute pan and zoom settings. See below.                |

?> If no `ptz_action` is specified and no `absolute` value is specified, the camera returns to its "home" position. See [Camera layout configuration](../../cameras/README.md?id=layout-configuration) to configure the default "home" position for digital PTZ.

See [example of automatically zoom/panning based on state](../../../examples.md?id=automatically-zoom-based-on-state).

### `absolute`

Set exact digital PTZ pan and zoom parameters.

| Parameter | Description                                                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `pan`     | Control camera digital pan. See the `pan` parameter in [Camera layout configuration](../../cameras/README.md?id=layout-configuration).   |
| `zoom`    | Control camera digital zoom. See the `zoom` parameter in [Camera layout configuration](../../cameras/README.md?id=layout-configuration). |

## `ptz_multi`

Execute a PTZ action that intelligently chooses between a real and digital PTZ
action. If the media in question is a live camera with real PTZ support, a real
PTZ action will execute (equivalent to using the [`ptz`](README.md?id=ptz)
action), otherwise a digital PTZ action will be run (equivalent to using the
[`ptz_digital`](README.md?id=ptz_digital) action).

?> If the camera supports _any_ real PTZ action, _all_ actions will attempt to make real PTZ calls.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: ptz_multi
# [...]
```

| Parameter                     | Description                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `action`                      | Must be `custom:advanced-camera-card-action`.                                                 |
| `advanced_camera_card_action` | Must be `ptz_multi`.                                                                          |
| `ptz_action`                  | Optional action that is one of `left`, `right`, `up`, `down`, `zoom_in` or `zoom_out`.        |
| `ptz_phase`                   | Optional parameter that is one of `start` or `stop` to start or stop the movement separately. |
| `ptz_preset`                  | Optional preset to execute when the `ptz_action` is `preset`.                                 |

?> If no `ptz_action` is specified, the camera returns to its "home" position.

## `recording`

Change to the `recording` view.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: recording
```

## `recordings`

Change to the `recordings` view.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: recordings
```

## `screenshot`

Take a screenshot of the selected media (e.g. a still from a video).

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: screenshot
```

## `sleep`

Take no action for a given duration. Useful to pause between multiple other actions.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: sleep
```

| Parameter                     | Description                                   |
| ----------------------------- | --------------------------------------------- |
| `action`                      | Must be `custom:advanced-camera-card-action`. |
| `advanced_camera_card_action` | Must be `sleep`.                              |
| `duration`                    | A duration object. See below.                 |

### `duration`

The `duration` block configures how long the `sleep` should last.

| Parameter | Description                |
| --------- | -------------------------- |
| `h`       | Hours to sleep for.        |
| `m`       | Minutes to sleep for.      |
| `s`       | Seconds to sleep for.      |
| `ms`      | Milliseconds to sleep for. |

?> Multiple values can be combined, e.g. `{ m: 2, s: 30}` will sleep for `2.5` minutes.

## `snapshot`

Change to the `snapshot` view.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: snapshot
```

## `status_bar`

Add or remove items from the status bar.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: status_bar
# [...]
```

| Parameter           | Default | Description                                                                                                                                             |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status_bar_action` |         | If `add` adds `items` to the status bar, if `remove` removes items and if `reset` resets the status bar entirely (removes all dynamically added items). |
| `items`             |         | The items to `add` or `remove`. See below.                                                                                                              |

### `items`

The items parameter is a list of items to `add` or `remove`. See [`custom:advanced-camera-card-status-bar-icon`](../../elements/custom/README.md?id=status-bar-icon), [`custom:advanced-camera-card-status-bar-image`](../../elements/custom/README.md?id=status-bar-image), [`custom:advanced-camera-card-status-bar-string`](../../elements/custom/README.md?id=status-bar-string) for the allowable items and their parameters. See the [fully expanded reference](./README.md?fully-expanded-reference) below for a complete example.

## `timeline`

Change to the `timeline` view.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: timeline
```

## `unmute`

Unmute the selected media.

```yaml
action: custom:advanced-camera-card-action
advanced_camera_card_action: unmute
```

## Fully expanded reference

[](../../common/expanded-warning.md ':include')

```yaml
elements:
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-a-circle
    title: Select Front Door
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: camera_select
      camera: camera.front_door
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-b-circle
    title: Open Camera UI
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: camera_ui
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-d-circle
    title: Show most recent clip
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: clip
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-e-circle
    title: Show clips
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: clips
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-f-circle
    title: Show default view
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: default
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-g-circle
    title: Show diagnostics
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: diagnostics
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-h-circle
    title: Show  grid
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: display_mode_select
      display_mode: grid
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-i-circle
    title: Download media
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: download
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-j-circle
    title: Expand
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: expand
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-k-circle
    title: Fullscreen
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: fullscreen
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-l-circle
    title: Show image view
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: image
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-m-circle
    title: Show live view
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: live
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-n-circle
    title: Turn off substream
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: live_substream_off
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-o-circle
    title: Turn on substream
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: live_substream_on
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-n-circle
    title: Select HD substream
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: live_substream_select
      camera: camera.front_door_hd
  - type: custom:advanced-camera-card-menu-icon
      icon: mdi:alpha-o-circle
      title: Log to console
      tap_action:
        action: custom:advanced-camera-card-action
        advanced_camera_card_action: log
        message: "Hello, world!"
        level: debug
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-m-circle
    title: Media player play
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: media_player
      media_player: media_player.nesthub50be
      media_player_action: play
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-n-circle
    title: Media player stop
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: media_player
      media_player: media_player.nesthub
      media_player_action: stop
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-o-circle
    title: Toggle hidden menu
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: menu_toggle
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-p-circle
    title: Microphone connect
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: microphone_connect
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-q-circle
    title: Microphone disconnect
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: microphone_disconnect
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-r-circle
    title: Microphone mute
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: microphone_mute
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-s-circle
    title: Microphone unmute
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: microphone_unmute
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-t-circle
    title: Mute
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: mute
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-u-circle
    title: Pause
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: pause
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-v-circle
    title: Play
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: play
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-x-circle
    title: Real PTZ Preset
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: ptz
      ptz_action: preset
      ptz_preset: doorway
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-y-circle
    title: Show PTZ Controls
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: ptz_controls
      enabled: true
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-z-circle
    title: Go to precise digital location
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: ptz_digital
      absolute:
        zoom: 5
        pan:
          x: 58
          y: 14
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-a-circle-outline
    title: Smart select between real and digital PTZ
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: ptz_multi
      ptz_action: left
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-b-circle-outline
    title: Show most recent recording
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: recording
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-c-circle-outline
    title: Show recordings
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: recordings
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-d-circle-outline
    title: Screenshot
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: screenshot
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-e-circle-outline
    title: Sleep
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: sleep
      duration:
        h: 1
        m: 20
        s: 56
        ms: 422
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-f-circle-outline
    title: Show most recent snapshot
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: snapshot
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-g-circle-outline
    title: Show snapshots
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: snapshots
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-h-circle-outline
    title: Show timeline
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: timeline
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-i-circle-outline
    title: Unmute
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: unmute
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-j-circle-outline
    title: Add status bar contents
    tap_action:
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: status_bar
        status_bar_action: add
        items:
          - type: custom:advanced-camera-card-status-bar-string
            enabled: true
            exclusive: false
            expand: false
            string: 'Intruder alert!'
            priority: 50
            sufficient: false
          - type: custom:advanced-camera-card-status-bar-icon
            enabled: true
            exclusive: false
            expand: false
            icon: 'mdi:cow'
            priority: 50
            sufficient: false
          - type: custom:advanced-camera-card-status-bar-image
            enabled: true
            exclusive: false
            expand: false
            image: https://my.site.com/status.png
            priority: 50
            sufficient: false
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-k-circle-outline
    title: Remove status bar contents
    tap_action:
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: status_bar
        status_bar_action: remove
        items:
          - type: custom:advanced-camera-card-status-bar-string
            enabled: true
            exclusive: false
            expand: false
            string: 'Intruder alert!'
            priority: 50
            sufficient: false
          - type: custom:advanced-camera-card-status-bar-icon
            enabled: true
            exclusive: false
            expand: false
            icon: 'mdi:cow'
            priority: 50
            sufficient: false
          - type: custom:advanced-camera-card-status-bar-image
            enabled: true
            exclusive: false
            expand: false
            image: https://my.site.com/status.png
            priority: 50
            sufficient: false
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:alpha-l-circle-outline
    title: Reset status bar contents
    tap_action:
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: status_bar
        status_bar_action: reset
```
