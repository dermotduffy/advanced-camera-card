# Cameras

The `cameras` block configures a list of cameras the card should support. The first listed camera is the default.

```yaml
cameras:
  - [...camera 0 (default camera)...]
  - [...camera 1...]
  - [...camera 2...]
```

The `cameras_global` block can be used to set defaults across multiple cameras.

```yaml
cameras_global:
  # [...]
```

| Option                               | Default                                                                                           | Description                                                                                                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `always_error_if_entity_unavailable` | `false`                                                                                           | When `true` and when `camera_entity` is specified, attempting to live stream this camera will always error out if the entity state is `unavailable`, even if the `live_provider` does not actually need the `camera_entity`.                                     |
| `camera_entity`                      |                                                                                                   | The Home Assistant camera entity to use with the `frigate` live provider view. Also used to automatically detect the name of the underlying Frigate camera, and the title/icon of the camera.                                                                    |
| `capabilities`                       |                                                                                                   | Allows selective disabling of camera capabilities. See below.                                                                                                                                                                                                    |
| `cast`                               |                                                                                                   | Configuration that controls how this camera is "casted" / sent to media players. See below.                                                                                                                                                                      |
| `dependencies`                       |                                                                                                   | Other cameras that this camera should depend upon. See below.                                                                                                                                                                                                    |
| `dimensions`                         |                                                                                                   | Controls the dimensions and layout for media from this camera. See below.                                                                                                                                                                                        |
| `engine`                             | `auto`                                                                                            | The camera engine to use. If `auto` the card will attempt to choose the correct engine from the specified options. See [Engine](engine.md).                                                                                                                      |
| `frigate`                            |                                                                                                   | Options for Frigate cameras. See [Frigate camera engine configuration](engine.md?id=frigate).                                                                                                                                                                    |
| `icon`                               | Autodetected from `camera_entity` if that is specified.                                           | The icon to use for this camera in the camera menu and in the next & previous controls when using the `icon` style.                                                                                                                                              |
| `id`                                 | `camera_entity`, `webrtc_card.entity` or `frigate.camera_name` if set (in that preference order). | An optional identifier to use throughout the card configuration to refer unambiguously to this camera. This `id` may be used in [conditions](../conditions.md), dependencies or custom [actions](../actions/README.md) to refer to a given camera unambiguously. |
| `live_provider`                      | `auto`                                                                                            | The choice of live stream provider. See [Live Provider](live-provider.md).                                                                                                                                                                                       |
| `proxy`                              |                                                                                                   | Controls whether/how content is proxied via [hass-web-proxy-integration](https://github.com/dermotduffy/hass-web-proxy-integration) (must be installed separately). See below.                                                                                   |
| `title`                              | Autodetected from `camera_entity` if that is specified.                                           | A friendly name for this camera to use in the card.                                                                                                                                                                                                              |
| `triggers`                           |                                                                                                   | Define what should cause this camera to update/trigger. See below.                                                                                                                                                                                               |
| `webrtc_card`                        |                                                                                                   | The WebRTC entity/URL to use for this camera with the `webrtc-card` live provider. See below.                                                                                                                                                                    |

## `capabilities`

The `capabilities` block allows selected disabling of auto-detected camera capabilities. This is rarely used, with substreams being a notable exception.

```yaml
cameras:
  - camera_entity: camera.office
    capabilities:
      # [...]
```

| Option           | Default | Description                                                                                                |
| ---------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `disable`        |         | A list of camera capabilities to disable. By default all capabilities supported by the camera are enabled. |
| `disable_except` |         | A list of camera capabilities to leave enabled if supported. Everything else will be disabled.             |

### Capabilities

| Capability              | Purpose                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `clips`                 | Clips can be fetched from the camera.                                                             |
| `remote-control-entity` | The camera can be selected by a [Camera Remote Control Entity](../remote-control.md?id=entities). |
| `favorite-events`       | Events can be favorited.                                                                          |
| `favorite-recordings`   | Recordings can be favorited.                                                                      |
| `live`                  | Live video can be received from the camera.                                                       |
| `menu`                  | The camera should show up in the card camera menu.                                                |
| `ptz`                   | The camera can be PTZ controlled.                                                                 |
| `recordings`            | Recordings can be fetched from the camera.                                                        |
| `seek`                  | Clips can be seeked / scrubbed by the timeline.                                                   |
| `snapshots`             | Snapshots can be fetched from the camera.                                                         |
| `substream`             | The camera can be used as a substream on another camera.                                          |
| `trigger`               | The camera can be triggered.                                                                      |

?> If using a camera only as a `substream`, don't forget to keep both the
`substream` and `ptz` capabilities enabled if you wish to use PTZ controls for
the substream.

## `cast`

The `cast` block configures how a camera is cast / sent to media players.

```yaml
cameras:
  - camera_entity: camera.office
    cast:
      # [...]
```

| Option      | Default    | Description                                                                                                                                                                                                                                                                                                                  |
| ----------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dashboard` |            | Configuration for the dashboard to cast. See below.                                                                                                                                                                                                                                                                          |
| `method`    | `standard` | Whether to use `standard` media casting to send the live view to your media player, or to instead cast a `dashboard` you have manually setup. Casting a dashboard supports a much wider variety of video media, including low latency video providers (e.g. `go2rtc`). This setting has no effect on casting non-live media. |

See the [dashboard method cast example](../../examples.md?id=cast-a-dashboard).

### Dashboard Configuration

```yaml
cameras:
  - camera_entity: camera.office
    cast:
      dashboard:
        # [...]
```

| Option           | Default | Description                                                                                                                                                               |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dashboard_path` |         | A required field that specifies the name of the dashboard to cast. You can see this name in your HA URL when you visit the dashboard.                                     |
| `view_path`      |         | A required field that specifies view/"tab" on that dashboard to cast. This is the value you have specified in the `url` field of the view configuration on the dashboard. |

## `dependencies`

The `dependencies` block configures other cameras as dependents of this camera. Dependent cameras have their media fetched and merged with this camera by default, and offer their respective live views as 'substreams' of the main (depended upon) camera. Configuration is under:

```yaml
cameras:
  - camera_entity: camera.office
    dependencies:
      # [...]
```

| Option        | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `all_cameras` | `false` | Shortcut to specify all other cameras as dependent cameras.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `cameras`     |         | An optional list of other camera identifiers (see `id` parameter). If specified the card will fetch media for this camera and _also_ recursively for the named cameras by default. Live views for the involved cameras will be available as 'substreams' of the main (depended upon) camera. All dependent cameras must themselves be a configured camera in the card. This can be useful to group events for cameras that are close together, to show multiple related live views, to always have clips/snapshots show fully merged events across all cameras or to show events for the `birdseye` camera that otherwise would not have events itself. |

## `dimensions`

The `dimensions` block configures the dimensions and layout of media of a given camera (see [Card Dimensions](../dimensions.md) to set the dimensions of the whole card and not just a single camera).

```yaml
cameras:
  - camera_entity: camera.office
    dimensions:
      # [...]
```

| Option         | Default | Description                                                                                                                                                                                                                                                                                                                  |
| -------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aspect_ratio` |         | An optional aspect ratio for media from this camera which will be used in `live` or media viewer related views (e.g. `clip`, `snapshot` and `recording`). Format is the same as the parameter of the same name under the [dimensions block](../dimensions.md) (which controls dimensions for the whole card), e.g. `16 / 9`. |
| `layout`       |         | How the media should be laid out _within_ the camera dimensions. See below.                                                                                                                                                                                                                                                  |
| `rotation`     | `0`     | Rotates the camera clockwise by `0`, `90`, `180` or `270` degrees.                                                                                                                                                                                                                                                           |

?> Use of `rotation` causes the browser to rotate the video player, unavoidably _including_ rotating the builtin video controls on the player, which may be distracting or confusing (e.g. upside down controls). Builtin controls can be disabled using the [`live.controls.builtin` parameter](../live.md?id=controls). Rotation is not available in iOS fullscreen, due to the limited fullscreen support offered by that OS.

!> Rotating the camera incurs a rendering performance penalty. Always rotate "upstream" if possible (e.g. in your camera settings).

### Layout Configuration

The `layout` block configures the fit and position of the media _within_ the camera dimensions (in order to control the dimensions for the whole card see [the card dimensions configuration](../dimensions.md) ).

```yaml
cameras:
  - camera_entity: camera.office
    dimensions:
      layout:
        # [...]
```

| Option     | Default   | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fit`      | `contain` | If `contain`, the media is contained within the camera container/card and letterboxed if necessary. If `cover`, the media is expanded proportionally (i.e. maintaining the media aspect ratio) until the camera/card dimensions are fully covered. If `fill`, the media is stretched to fill the camera/card dimensions (i.e. ignoring the media aspect ratio). See [CSS object-fit](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit) for technical details and a visualization. Note that if `aspect_ratio` is also set, this is controlling the behavior "within" that aspect-ratio, otherwise it's within the container for the camera (which is effectively the whole card for single card configurations).                                                                                                    |
| `pan`      |           | A dictionary that may contain an `x` and `y` percentage (`0` - `100`) to control the position of the media when "digitally zoomed in" (see `zoom` parameter). This can be effectively used to "pan"/cut the media shown. A value of `0` means maximally to the left or top of the media, a value of `100` means maximally to the right or bottom of the media. See visualizations below.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `position` |           | A dictionary that may contain an `x` and `y` percentage (`0` - `100`) to control the position of the media when the fit is `cover` (for other values of `fit` this option has no effect). This can be effectively used to "pan"/cut the media shown. At any given time, only one of `x` and `y` will have an effect, depending on whether media width is larger than the camera/card dimensions (in which case `x` controls the position) or the media height is larger than the camera/card dimensions (in which case `y` controls the position). A value of `0` means maximally to the left or top of the media, a value of `100` means maximally to the right or bottom of the media. See [CSS object-position](https://developer.mozilla.org/en-US/docs/Web/CSS/object-position) for technicals. See visualizations below. |
| `view_box` |           | A dictionary that may contain a `top`, `bottom`, `left` and `right` percentage (`0` - `100`) to precisely crop what part of the media to show by specifying a % inset value from each side. Browsers apply this cropping after `position` and `fit` have been applied. Unlike `zoom`, the user cannot dynamically zoom back out -- however the builtin media controls will work as normal. See visualizations below. Limited [browser support](https://caniuse.com/mdn-css_properties_object-view-box): ![](../../images/browsers/chrome_16x16.png 'Google Chrome :no-zoom') ![](../../images/browsers/chromium_16x16.png 'Chromium :no-zoom') ![](../../images/browsers/edge_16x16.png 'Microsoft Edge :no-zoom')                                                                                                             |
| `zoom`     | `1.0`     | A value between `1.0` and `10.0` inclusive that defines how much additional "digital zoom" to apply to this camera by default. Unlike with `view_box` the user can easily "zoom back out". Often used in conjuction with `pan`. When zoomed in the [builtin browser media controls](../live.md?id=controls) will automatically be disabled (as otherwise they would be enlarged also).                                                                                                                                                                                                                                                                                                                                                                                                                                         |

?> Layout operations are effectively applied in this order: `fit`, `position`, `view_box`, `zoom` then `pan`.

See [media layout examples](../../examples.md?id=media-layout).

#### Layout **Visualizations**

##### `fit`

![](../../images/media_layout/fit.png 'Media Layout Fit :size=400')

##### `position`: When media is shorter than dimensions height

![](../../images/media_layout/position-shorter-than-height.png 'Media Layout Position: Wider than taller :size=400')

##### `position`: When media is thinner than dimensions width

![](../../images/media_layout/position-thinner-than-width.png 'Media Layout Position: Taller than wider :size=400')

#### `view_box`: Precise media cropping

![](../../images/media_layout/view-box.png 'Media Layout Position: Taller than wider :size=400')

#### `pan` and `zoom`: Predefined panning and zooming

![](../../images/media_layout/pan-zoom.png 'Panning and zooming :size=400')

### Order of Operations

Camera `dimensions` settings are applied in this order:

- `aspect_ratio` defines the aspect ratio of the video player ...
- ... then `fit`, `position` and `view_box` defines how the media is laid out within that ratio ...
- ... then `rotation` defines whether the video is rotated ...
- ... then `zoom` and `pan` define the zoom and pan settings respectively.

## `ptz`

Configure the PTZ actions taken for a camera (not to be confused with configuration of the PTZ _controls_, see [Live PTZ Controls](../live.md?id=ptz) or [Media Viewer PTZ Controls](../media-viewer.md?id=ptz)). Manually configured actions override any auto-detected actions.

```yaml
cameras:
  - camera_entity: camera.office
    ptz:
      # [...]
```

### Movement types

Generally PTZ cameras/integrations may support two kinds of PTZ actions:

- `relative`: Single relative steps, e.g. "Pan to the left one step".
- `continuous`: Separate start and stop, e.g. "Start panning to the left", following by a later command "Stop panning".

The card supports both, and with the help of the
`r2c_delay_between_calls_seconds` and `c2r_delay_between_calls_seconds` can
translate between them where necessary. See the [ONVIF
specification](https://www.onvif.org/specs/srv/ptz/ONVIF-PTZ-Service-Spec.pdf)
for more details on the distinction between `relative` and `continuous`.

The card UI (e.g. PTZ controls) will always try to call the `continuous` variety
to allow for precise/smooth controls, and if unavailable will translate multiple
`relative` steps with optional delays between each step. Manually configured
[actions](../actions/README.md) may be configured to call either variety.

When PTZ actions are manually set in the config, they will replace the
auto-detected actions. For example if `actions_left` is set for a Frigate
camera, it will be used for all `left` PTZ actions even though Frigate cameras
natively support continuous actions (`actions_left_start`, `actions_left_stop`).

?> Frigate auto-detected PTZ actions will always be `continuous` as this is what
the integration currently offers.

### Parameters

| Option                                                                                                                                                                                                                                                                   | Default                                                    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actions_left`, `actions_right`, `actions_up`, `actions_down`, `actions_zoom_in`, `actions_zoom_out`, `actions_home`                                                                                                                                                     | Set by camera [engine](./engine.md) of the selected camera | The [perform-action](../actions/stock/README.md?id=perform-action) action that will be called for each PTZ action for relative movements.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `actions_left_start`, `actions_left_stop`, `actions_right_start`, `actions_right_stop`,`actions_up_start`, `actions_up_stop`,`actions_down_start`, `actions_down_stop`,`actions_zoom_in_start`, `actions_zoom_in_stop`,`actions_zoom_out_start`, `actions_zoom_out_stop` | Set by camera [engine](./engine.md) of the selected camera | The [perform-action](../actions/stock/README.md?id=perform-action) action that will be called for each PTZ action for continous movements. Both a `_start` and `_stop` variety must be provided for an action to be usable.                                                                                                                                                                                                                                                                                                                                                                                             |
| `c2r_delay_between_calls_seconds`                                                                                                                                                                                                                                        | `0.2`                                                      | When the camera is configured with continuous actions only (e.g. `left_start` and `left_stop`, but not `left`), if something requests a relative action (e.g. a manually configured [action](../actions/README.md)), then `start` will be called, followed by a delay of this number of seconds and finally `stop` will be called. Cameras / integrations that are slower to respond to continuous steps may need to increase this value to avoid the continuous motion being too small. Cameras / integrations that are rapid to respond may need to decrease this value to avoid the "relative step" being too large. |
| `data_left`, `data_right`, `data_up`, `data_down`, `data_zoom_in`, `data_zoom_out`, `data_home`                                                                                                                                                                          |                                                            | Shorthand for relative actions that call the service defined by the `service` parameter, with the data provided in this argument. Internally, this is just translated into the longer-form `actions_[action]`. If both `actions_X` and `data_X` are specified, `actions_X` takes priority. This is compatible with [AlexxIT's WebRTC Card PTZ configuration](https://github.com/AlexxIT/WebRTC/wiki/PTZ-Config-Examples).                                                                                                                                                                                               |
| `data_left_start`, `data_left_stop`, `data_right_start`, `data_right_stop`, `data_up_start`, `data_up_stop`, `data_down_start`, `data_down_stop`, `data_zoom_in_start`, `data_zoom_in_stop`, `data_zoom_out_start`, `data_zoom_out_stop`                                 |                                                            | Shorthand for continuous actions that call the service defined by the `service` parameter, with the data provided in this argument. Internally, this is just translated into the longer-form `actions_[action]_start` and `actions_[action]_stop`. If both `actions_X_*` and `data_X_*` are specified, `actions_X_*` takes priority. This is compatible with [AlexxIT's WebRTC Card PTZ configuration](https://github.com/AlexxIT/WebRTC/wiki/PTZ-Config-Examples). Both a `_start` and `_stop` variety must be provided for an action to be usable.                                                                    |
| `presets`                                                                                                                                                                                                                                                                |                                                            | PTZ preset actions. See below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `r2c_delay_between_calls_seconds`                                                                                                                                                                                                                                        | `0.5`                                                      | When the camera is configured with relative actions only (e.g. `left` but not `left_start` and `left_stop`), if something requests a continuous action (e.g. the card PTZ controls have a button held down), then a delay of this number of seconds will be inserted between each call of the relative action. Cameras / integrations that are slower to respond to relative steps may need to increase this value to avoid multiple simultaneous actions being sent. Cameras / integrations that are rapid to respond may need to decrease this value to increase the appearance of one single continuous motion.      |
| `service`                                                                                                                                                                                                                                                                |                                                            | An optional Home Assistant service to call when the `data_` parameters are used.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

### `presets`

Configures named PTZ presets. If a preset of this name is auto-detected, these configured actions will take precedence.

```yaml
cameras:
  - camera_entity: camera.office
    ptz:
      presets:
        [preset_name]:
          ? [action]
```

`[action]` is any [perform-action](../actions/stock/README.md?id=perform-action) action.

## `proxy`

Configures whether and how the content is proxied via
[hass-web-proxy-integration](https://github.com/dermotduffy/hass-web-proxy-integration)
(this must be installed separately). This allows fetching media **through** the
Home Assistant process itself, allowing the card to access resources it
otherwise would not be able to directly access. There are [security and
performance
implications](https://github.com/dermotduffy/hass-web-proxy-integration?tab=readme-ov-file#considerations)
to consider before installing
[hass-web-proxy-integration](https://github.com/dermotduffy/hass-web-proxy-integration)
and using this functionality.

```yaml
cameras:
  - camera_entity: camera.office
    proxy:
      # [...]
```

![Camera Proxying](../../images/proxy.png 'Camera Proxying :size=400')

Not all [engines](./engine.md) benefit from proxying:

| Engine                 | Purpose of proxying                                                                                                                                                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frigate`              | The Frigate integration already comes with a built-in proxy, so this functionality does not serve any purpose for `frigate`.                                                                                                                                                                   |
| `reolink`, `motioneye` | May be used to fetch videos in cases where the browser may not be able to access the camera/NVR, or the camera/NVR may use a self-signed SSL certificate that your browser would otherwise reject due to [mixed content](https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content). |
| `generic`              | `generic` cameras do not have media, so proxying currently would serve no purpose.                                                                                                                                                                                                             |

Regardless of the parameters, the integration will never attempt to proxy
content if the
[hass-web-proxy-integration](https://github.com/dermotduffy/hass-web-proxy-integration)
is not detected.

Proxying parameters:

| Option             | Default | Description                                                                                                                                                                                                                                                                                                                      |
| ------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `media`            | `auto`  | Whether or not to proxy media items. `true` to proxy, `false` to not proxy, or `auto` to allow the camera engine to decide whether to proxy or not.                                                                                                                                                                              |
| `dynamic`          | `true`  | Whether to dynamically (at the time) request proxying of the required media item, or rely on statically user-configured pre-existing proxying. See the [hass-web-proxy-integration documentation](https://github.com/dermotduffy/hass-web-proxy-integration).                                                                    |
| `ssl_verification` | `auto`  | Whether to verify the validity of SSL certificates. If `true` always verifies, if `false` never verifies and if `auto` the [engine](./engine.md) decides the best setting for that camera ecosystem.                                                                                                                             |
| `ssl_ciphers`      | `auto`  | Whether to use `default`, `intermediate`, `insecure` or `modern` SSL ciphers. See the [Home Assistant code](https://github.com/home-assistant/core/blob/dev/homeassistant/util/ssl.py) for the precise list of SSL ciphers each implies. If `auto` the [engine](./engine.md) decides the best setting for that camera ecosystem. |

## `triggers`

The `triggers` block configures what triggers a camera. Triggering can be used
to activate an action (e.g. view a camera in live, reset the card to the default
view). See [`view.triggers`](../view.md?id=triggers) to control what happens when a
camera is triggered.

```yaml
cameras:
  - camera_entity: camera.office
    triggers:
      # [...]
```

| Option      | Default                      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entities`  |                              | Whether to not to trigger the camera when the state of any Home Assistant entity becomes active (i.e. state becomes `on` or `open`). This works for Frigate or non-Frigate cameras.                                                                                                                                                                                                                                                                                                                                                                                                       |
| `events`    | `[events, clips, snapshots]` | Whether to trigger the camera when `events` occur (whether or not media is available) or whenever updated `clips` or `snapshots` are detected. Detection support varies by camera [engine](engine.md).                                                                                                                                                                                                                                                                                                                                                                                    |
| `motion`    | `false`                      | Whether to not to trigger the camera by automatically detecting and using the motion `binary_sensor` for this camera. This autodetection only works for Frigate cameras, and only when the motion `binary_sensor` entity has been enabled in Home Assistant.                                                                                                                                                                                                                                                                                                                              |
| `occupancy` | `false`                      | Whether to not to trigger the camera by automatically detecting and using the occupancy `binary_sensor` for this camera and its configured zones and labels. This autodetection only works for Frigate cameras, and only when the occupancy `binary_sensor` entity has been enabled in Home Assistant. If this camera has configured zones, only occupancy sensors for those zones are used -- if the overall _camera_ occupancy sensor is also required, it can be manually added to `entities`. If this camera has configured labels, only occupancy sensors for those labels are used. |

## Fully expanded reference

[](../common/expanded-warning.md ':include')

See [Engines](engine.md) and [Live Providers](live-provider.md) for other options nested under `cameras`.

```yaml
cameras:
  - camera_entity: camera.front_Door
    # Show events for camera-2 when this camera is viewed.
    dependencies:
      all_cameras: false
      cameras:
        - camera-2
    triggers:
      motion: false
      occupancy: true
      entities:
        - binary_sensor.front_door_sensor
    cast:
      method: standard
    dimensions:
      aspect_ratio: 16:9
      layout:
        fit: contain
        position:
          x: 50
          y: 50
    always_error_if_entity_unavailable: false
  - camera_entity: camera.entrance
    icon: 'mdi:car'
    title: 'Front entrance'
    # Custom identifier for the camera to refer to it above.
    id: 'camera-2'
    triggers:
      motion: false
      occupancy: true
      entities:
        - binary_sensor.entrance_sensor
    dependencies:
      all_cameras: false
  - camera_entity: camera.zoomed
    dimensions:
      layout:
        zoom: 2.0
        pan:
          x: 50
          y: 50
  - camera_entity: camera.manual-ptz
    ptz:
      c2r_delay_between_calls_seconds: 0.2
      r2c_delay_between_calls_seconds: 0.5
      # Relative action (only `left` shown)
      actions_left:
        action: perform-action
        perform_action: service.of_your_choice
        data:
          device: '048123'
          cmd: left
      # Continuous action (only `right` shown)
      actions_right_start:
        action: perform-action
        perform_action: service.of_your_choice
        data:
          device: '048123'
          cmd: right
          phase: start
      actions_right_stop:
        action: perform-action
        perform_action: service.of_your_choice
        data:
          device: '048123'
          phase: stop
      # Equivalent relative short form (only `up` shown)
      service: service.send_command
      data_up:
        device: '048123'
        cmd: up
      # Equivalent continuous short form (only `down` shown)
      service: service.send_command
      data_up_start:
        device: '048123'
        cmd: down
        phase: start
      data_up_stop:
        device: '048123'
        cmd: down
        phase: stop
      presets:
        # Preset using long form.
        armchair:
        action: perform-action
        perform_action: service.of_your_choice
          data:
            device: '048123'
            cmd: preset
            preset: armchair
        # Preset using short form.
        service: service.of_your_choice
        window:
          device: '048123'
          cmd: preset
          preset: window
  - camera_entity: camera.needs_proxy
    proxy:
      media: auto
      dynamic: true
      ssl_verification: auto
      ssl_ciphers: auto
  - camera_entity: camera.capabilities_reference
    capabilities:
      disable_except:
        - clips
        - favorite-events
        - favorite-recordings
        - live
        - menu
        - ptz
        - recordings
        - seek
        - snapshots
        - substream
        - trigger
      disable:
        # Capabilities to selectively disable.
  - camera_entity: camera.rotated
    dimensions:
      rotation: 90
cameras_global:
  triggers:
    motion: false
```
