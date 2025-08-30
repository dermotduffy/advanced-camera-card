# `menu`

Configures how the card menu behaves.

```yaml
menu:
  # [...]
```

| Option        | Default  | Description                                                                                                                                                                                                                                                  |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `alignment`   | `left`   | Whether to align the menu buttons to the `left`, `right`, `top` or `bottom` of the menu. Some selections may have no effect depending on the value of `position` (e.g. it doesn't make sense to `left` align icons on a menu with `position` to the `left`). |
| `button_size` | `40`     | The size of the menu buttons in pixels. Must be &gt;= `20`.                                                                                                                                                                                                  |
| `buttons`     |          | Whether to show or hide built-in buttons. See below.                                                                                                                                                                                                         |
| `position`    | `top`    | Whether to show the menu on the `left`, `right`, `top` or `bottom` side of the card. Note that for the `outside` style only the `top` and `bottom` positions have an effect.                                                                                 |
| `style`       | `hidden` | The menu style to show by default, one of `none`, `hidden`, `hover`, `hover-card`, `overlay`, or `outside`. See below.                                                                                                                                       |

## `buttons`

```yaml
menu:
  buttons:
    [button]:
      # [...]
```

### Available Buttons

| Button name    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `camera_ui`    | The `camera_ui` menu button: brings the user to a context-appropriate page on the UI of their camera engine (e.g. the Frigate camera homepage). Will only appear if the camera engine supports a camera UI (e.g. if `frigate.url` option is set for `frigate` engine users).                                                                                                                                                                                                                          |
| `cameras`      | The camera selection submenu. Will only appear if multiple cameras are configured.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `clips`        | The `clips` view menu button: brings the user to the `clips` view on tap and the most-recent `clip` view on hold.                                                                                                                                                                                                                                                                                                                                                                                     |
| `display_mode` | The `display_mode` button allows changing between single and grid views.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `download`     | The `download` menu button: allow direct download of the media being displayed.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `expand`       | The `expand` menu button: expand the card into a popup/dialog.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `folders`      | The `folders` menu button: brings the user to a [gallery](./media-gallery.md) of folders on tap and to the media viewer with media from the folder on hold. Will only appear if [`folders`](./folders.md) are configured.                                                                                                                                                                                                                                                                             |
| `fullscreen`   | The `fullscreen` menu button: expand the card to consume the fullscreen. Please note that fullscreen behavior on iPhone is limited, see [troubleshooting](../troubleshooting.md?id=fullscreen-doesn39t-work-on-iphone).                                                                                                                                                                                                                                                                               |
| `image`        | The `image` view menu button: brings the user to the static `image` view.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `iris`         | The main Advanced Camera Card `iris` menu button: brings the user to the default configured view (`view.default`), or collapses/expands the menu if the `menu.style` is `hidden` .                                                                                                                                                                                                                                                                                                                    |
| `live`         | The `live` view menu button: brings the user to the `live` view.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `media_player` | The `media_player` menu button: sends the visible media to a remote media player. Supports Frigate clips, snapshots and live camera (only for cameras that specify a `camera_entity` and only using the default HA stream (equivalent to the `ha` live provider)). `jsmpeg` or `webrtc-card` are not supported, although live can still be played as long as `camera_entity` is specified. In the player list, a `tap` will send the media to the player, a `hold` will stop the media on the player. |
| `microphone`   | The `microphone` button allows usage of 2-way audio in certain configurations. See [Using 2-way audio](../usage/2-way-audio.md).                                                                                                                                                                                                                                                                                                                                                                      |
| `ptz_controls` | The `ptz_controls` button shows or hides the PTZ controls.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `ptz_home`     | The `ptz_home` button allows easily returning the camera to default home position.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `recordings`   | The `recordings` view menu button: brings the user to the `recordings` view on tap and the most-recent `recording` view on hold.                                                                                                                                                                                                                                                                                                                                                                      |
| `screenshot`   | The `screenshot` menu button: take a screenshot of the loaded media (e.g. a still from a video).                                                                                                                                                                                                                                                                                                                                                                                                      |
| `snapshots`    | The `snapshots` view menu button: brings the user to the `clips` view on tap and the most-recent `snapshot` view on hold.                                                                                                                                                                                                                                                                                                                                                                             |
| `timeline`     | The `timeline` menu button: show the event timeline.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### Options for each button

| Option      | Default                                                                                                                                                                                                                                                                             | Description                                                                                                                                                                                                                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alignment` | `matching`                                                                                                                                                                                                                                                                          | Whether this menu item should have an alignment that is `matching` the menu alignment or `opposing` the menu alignment. Can be used to create two separate groups of buttons on the menu. The `priority` option orders buttons within a given `alignment`.                                                                   |
| `enabled`   | `true` for `iris`, `cameras`, `substreams`, `live`, `clips`, `snapshots`, `timeline`, `download`, `camera_ui`, `fullscreen`, `media_player`, `display_mode` and `ptz_home`. `false` for `image`, `expand`, `microphone`, `mute`, `play`, `recordings`, `screenshot`, `ptz_controls` | Whether or not to show the button.                                                                                                                                                                                                                                                                                           |
| `icon`      |                                                                                                                                                                                                                                                                                     | An icon to overriding the default for that button, e.g. `mdi:camera-front`. See also [custom icons](../usage/custom-icons.md).                                                                                                                                                                                               |
| `permanent` | `false`                                                                                                                                                                                                                                                                             | If `false` the menu item is hidden when the menu has the `hidden` style and the menu is closed, otherwise it is shown (and sorted to the front).                                                                                                                                                                             |
| `priority`  | `50`                                                                                                                                                                                                                                                                                | The menu item priority. Higher priority items are ordered closer to the start of the menu alignment (i.e. a button with priority `70` will order further to the left than a button with priority `60`). Priority applies separately to `matching` and `opposing` groups (see `alignment` above). Minimum `0`, maximum `100`. |

### Additional options: `microphone`

```yaml
menu:
  buttons:
    microphone:
      # [...]
```

| Option | Default     | Description                                                                                                                                                                 |
| ------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type` | `momentary` | When `momentary` the button must be continually held down to talk, when `toggle` pressing the button will enable the microphone and it must be pressed again to disable it. |

## `style`

This card supports several menu styles.

| Key          | Description                                                                                                                                               | Screenshot                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `hidden`     | Hide the menu by default. It may be toggled open as needed with the `iris` button.                                                                        | ![](../images/menu-mode-hidden.png 'Menu hidden :size=400')      |
| `hover-card` | Overlay the menu over the card contents when the mouse is over the **card**, otherwise it is not shown. The `iris` button shows the default view.         | ![](../images/menu-mode-overlay.png 'Menu hover-card :size=400') |
| `hover`      | Overlay the menu over the card contents when the mouse is over the **menu**, otherwise it is not shown. The `iris` button shows the default view.         | ![](../images/menu-mode-overlay.png 'Menu hover :size=400')      |
| `none`       | No menu is shown.                                                                                                                                         | ![](../images/menu-mode-none.png 'No menu :size=400')            |
| `outside`    | Render the menu outside the card (i.e. above it if `position` is `top`, or below it if `position` is `bottom`). The `iris` button shows the default view. | ![](../images/menu-mode-above.png 'Menu outside :size=400')      |
| `overlay`    | Overlay the menu over the card contents. The `iris` button shows the default view.                                                                        | ![](../images/menu-mode-overlay.png 'Menu hidden :size=400')     |

## Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
menu:
  alignment: left
  buttons:
    camera_ui:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:web
    cameras:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:video-switch
    clips:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:filmstrip
    download:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:download
    expand:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:arrow-expand-all
    folders:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:folder-multiple
    fullscreen:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:fullscreen
    image:
      priority: 50
      enabled: false
      alignment: matching
      icon: mdi:image
    iris:
      priority: 50
      enabled: true
      alignment: matching
      icon: iris
    live:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:cctv
    media_player:
      priority: 50
      enabled: false
      alignment: matching
      icon: mdi:cast
    microphone:
      priority: 50
      enabled: false
      alignment: matching
      icon: mdi:microphone
      type: momentary
    mute:
      priority: 50
      enabled: false
      alignment: matching
      icon: mdi:volume-off
    play:
      priority: 50
      enabled: false
      alignment: matching
      icon: mdi:play
    ptz_controls:
      priority: 50
      enabled: false
      alignment: matching
      icon: mdi:pan
    ptz_home:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:home
    snapshots:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:camera
    substreams:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:video-input-component
    timeline:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:chart-gantt
  button_size: 40
  position: top
  style: hidden
```
