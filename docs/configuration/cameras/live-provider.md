# `live_provider`

## Overview

The `live_provider` parameter determines what provides the live stream for a camera. Each provider offers different capabilities:

| Live Provider                      | Latency | Frame Rate | Loading Time | Installation                   | Supports [Proxying](./README.md?id=proxy) | Description                                                                                                                                                                                                                           |
| ---------------------------------- | ------- | ---------- | ------------ | ------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `go2rtc`                           | Best    | High       | Better       | Builtin                        | :white_check_mark:                        | Uses [go2rtc](https://github.com/AlexxIT/go2rtc) to stream live feeds and supports 2-way audio.                                                                                                                                       |
| `go2rtc-experimental`              | Best    | High       | Better       | Builtin                        | :white_check_mark:                        | **Experimental** re-implementation of the `go2rtc` provider (MSE/WebRTC/MP4/MJPEG) that is expected to eventually replace `go2rtc`. Uses the same configuration as `go2rtc`. See [`go2rtc (experimental)`](#go2rtc-experimental).     |
| `ha` (Native WebRTC)               | Best    | High       | Better       | Builtin                        | :heavy_multiplication_x:                  | Use the built-in Home Assistant camera streams -- will offer a very low-latency feed direct to your browser.                                                                                                                          |
| `ha` (HLS)                         | Poor    | High       | Better       | Builtin                        | :heavy_multiplication_x:                  | Use the built-in Home Assistant camera streams -- HLS fallback when a WebRTC connection cannot be established.                                                                                                                        |
| `ha` (when configured with LL-HLS) | Better  | High       | Better       | Builtin                        | :heavy_multiplication_x:                  | Use the built-in Home Assistant camera streams -- can be configured to use an [LL-HLS](https://www.home-assistant.io/integrations/stream/#ll-hls) feed for lower latency.                                                             |
| `image`                            | Poor    | Poor       | Best         | Builtin                        | :heavy_multiplication_x:                  | Use refreshing snapshots of the built-in Home Assistant camera streams.                                                                                                                                                               |
| `jsmpeg`                           | Better  | Low        | Poor         | Builtin                        | :heavy_multiplication_x:                  | Use a the JSMPEG stream.                                                                                                                                                                                                              |
| `webrtc-card`                      | Best    | High       | Better       | Separate installation required | :heavy_multiplication_x:                  | Embed's [AlexxIT's WebRTC Card](https://github.com/AlexxIT/WebRTC) to stream live feed, requires manual extra setup. See [`webrtc_card`](#webrtc_card). Not to be confused with native Home Assistant WebRTC (use the `ha` provider). |

## `go2rtc`

The `go2rtc` block configures use of the `go2rtc` live provider. This configuration is included as part of a camera entry in the `cameras` list.

```yaml
cameras:
  - camera_entity: camera.office
    live_provider: go2rtc
    go2rtc:
      # [...]
```

| Option                           | Default                                                                                                                                              | Description                                                                                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `metadata_fetch_timeout_seconds` | `2`                                                                                                                                                  | Timeout for the go2rtc stream metadata fetch (this is used to detect stream capabilities such as `2-way-audio`).                                                                 |
| `modes`                          | go2rtc default: `[webrtc, mse, mp4, mjpeg]`                                                                                                          | An ordered list of `go2rtc` modes to use. Valid values are `webrtc`, `mse`, `mp4` or `mjpeg` values.                                                                             |
| `stream`                         | Determined by camera engine (e.g. `frigate` camera name).                                                                                            | A valid `go2rtc` stream name.                                                                                                                                                    |
| `url`                            | Determined by camera engine (e.g. the `frigate` engine will automatically generate a URL for the go2rtc backend that runs in the Frigate container). | The root `go2rtc` URL the card should stream the video from. This is only needed for non-Frigate usecases, or advanced Frigate usecases. Example: `http://my-custom-go2rtc:1984` |

> [!NOTE]
> If `url` is manually set and `proxy.live` is set to `auto` on the camera (the default), the video stream will automatically be proxied via the Home Assistant process if the [hass-web-proxy-integration](https://github.com/dermotduffy/hass-web-proxy-integration) is detected. See [proxying](./README.md?id=proxy).

> [!TIP]
> If you are certain your camera hardware supports 2-way audio but the
> microphone button is intermittently missing on load, try increasing
> `metadata_fetch_timeout_seconds` or use
> [`capabilities.force`](./README.md?id=capabilities) to skip metadata
> detection entirely.

## `go2rtc (experimental)`

> [!WARNING] `go2rtc-experimental` is a from-scratch re-implementation of the [`go2rtc`](#go2rtc) live provider (MSE, WebRTC, MP4 and MJPEG). It is under active development and is expected to eventually replace `go2rtc`. Please try it and [report any issues you encounter](https://github.com/dermotduffy/advanced-camera-card/issues).

It uses the exact same configuration as [`go2rtc`](#go2rtc): select it with `live_provider: go2rtc-experimental` and configure the same [`go2rtc`](#go2rtc) block.

```yaml
cameras:
  - camera_entity: camera.office
    live_provider: go2rtc-experimental
    go2rtc:
      # [...]
```

## `ha`

The `ha` block configures use of the default Home Assistant (`ha`) live provider. It has no configuration options.

```yaml
cameras:
  - camera_entity: camera.office
    live_provider: ha
```

The native stream provider in Home Assistant dynamically chooses between HLS and
WebRTC streams. It prefers the lowest-latency stream (WebRTC) and only falls
back to HLS when that is the only way to get audio.

| WebRTC stream | HLS Stream   | Muted?   | Resulting Stream Selection |
| ------------- | ------------ | -------- | -------------------------- |
| Has audio     | _Either_     | _Either_ | WebRTC (lowest latency)    |
| Has no audio  | Has audio    | Yes      | WebRTC (lowest latency)    |
| Has no audio  | Has audio    | No       | HLS (for audio)            |
| Has no audio  | Has no audio | _Either_ | WebRTC (lowest latency)    |

> [!NOTE]
> When using the `ha` provider through Advanced Camera Card, streams are chosen
> by the same logic as the table above (the logic Home Assistant uses). The one
> difference is **when the choice is made**: the card re-runs the selection
> whenever you unmute (whether from the card's mute button or the video's own
> controls), whereas Home Assistant effectively fixes "muted" per dashboard card
> and never re-selects after that. So for a camera whose low-latency stream has
> **no audio**, unmuting in the card switches you to the audio-enabled stream,
> which may take a moment to load and run with a little more latency That
> audio-enabled stream will remain loaded thereafter.

## `image`

All configuration is under:

```yaml
cameras:
  - camera_entity: camera.office
    live_provider: image
    image:
      # [...]
```

| Option              | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entity`            |         | The entity to use when `mode` is set to `entity`. This entity is expected to have an `entity_picture` attribute that specifies the image URL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `entity_parameters` |         | Optional URL parameters to add to the URL generated for entity-based modes (i.e. when `mode` is `camera` or `entity`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `mode`              | `auto`  | Value must be one of `url` (to fetch an arbitrary image URL), `camera` (to show a still of the currently selected camera entity using either `camera_entity` or `webrtc_card.entity` in that order of precedence), `entity` (to show an image associated with a named entity, see the `entity` parameter below), `default` (to show the [default embedded image](https://github.com/dermotduffy/advanced-camera-card/blob/main/src/images/iris-screensaver.jpg)), or `screensaver` (to show a random image from [picsum.photos](https://picsum.photos/), refreshing every 60s by default). If `auto`, the mode is chosen automatically based on whether `url` or `entity` parameters have been specified. |
| `refresh_seconds`   | `auto`  | The image will be refreshed at least every `refresh_seconds` (it may refresh more frequently, e.g. whenever Home Assistant updates its camera security token). `0` implies no refreshing. When set to `auto`, uses `1` for all modes except `screensaver` which uses `60`.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `url`               |         | A static image URL to be used when the `mode` is set to `url` or when a temporary image is required (e.g. may appear momentarily prior to load of a camera snapshot in the `camera` mode). Note that a `_t=[timestamp]` cache-busting value will be added automatically.                                                                                                                                                                                                                                                                                                                                                                                                                                  |

[](../common/screensaver-warning.md ':include')

[](../common/proxy-warning.md ':include')

## `jsmpeg`

All configuration is under:

```yaml
cameras:
  - camera_entity: camera.office
    live_provider: jsmpeg
    jsmpeg:
      # [...]
```

| Option    | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `options` |         | **Advanced users only**: Control the underlying [JSMPEG library options](https://github.com/phoboslab/jsmpeg#usage). Supports setting these JSMPEG options `{audio, video, pauseWhenHidden, disableGl, disableWebAssembly, preserveDrawingBuffer, progressive, throttled, chunkSize, maxAudioLag, videoBufferSize, audioBufferSize}`. This is not necessary for the vast majority of users: only set these flags if you know what you're doing, as you may entirely break video rendering in the card. |

## `webrtc_card`

WebRTC Card support blends the use of the ultra-realtime [WebRTC card live
view](https://github.com/AlexxIT/WebRTC) with convenient access to Frigate
events/snapshots/UI. AlexxIT's WebRTC Integration/Card must be installed and configured separately (see [details](https://github.com/AlexxIT/WebRTC)) before it can be used with this card.

> [!NOTE]
> The `webrtc_card` default configuration disables the WebRTC card's `intersection` parameter (which auto-stops the media when a certain fraction of the video is no longer visible), since it interferes with the card pan & zoom. Instead, see the [`auto_pause`](../live.md) parameter.

```yaml
cameras:
  - camera_entity: camera.office
    live_provider: webrtc-card
    webrtc_card:
      # [...]
```

| Option   | Default                                                                                                                                                                                  | Description                                                                                                                                                                                                                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entity` |                                                                                                                                                                                          | The RTSP camera entity to pass to the WebRTC Card for this camera.                                                                                                                                                                                                                              |
| `url`    | Depends on the camera engine (e.g. Frigate cameras will automatically use the camera name since this is the [recommended setup](https://docs.frigate.video/guides/configuring_go2rtc/)). | The RTSP url to pass to the WebRTC Card, e.g. `rtsp://USERNAME:PASSWORD@CAMERA:554/RTSP_PATH`                                                                                                                                                                                                   |
| `*`      |                                                                                                                                                                                          | Any options specified in the `webrtc_card:` YAML dictionary are silently passed through to the AlexxIT's WebRTC Card. See [WebRTC Configuration](https://github.com/AlexxIT/WebRTC#configuration) for full details this external card provides, e.g. `ui: true` will enable the WebRTC Card UI. |

## Fully expanded reference

[](../common/expanded-warning.md ':include')

```yaml
cameras:
  - camera_entity: camera.office_ha
    live_provider: ha
  - camera_entity: camera.office_webrtc_card
    live_provider: webrtc-card
    webrtc_card:
      entity: camera.office_rtsp
      url: 'rtsp://username:password@camera:554/av_stream/ch0'
      # Arbitrary WebRTC Card options, see https://github.com/AlexxIT/WebRTC#configuration .
      ui: true
  - camera_entity: camera.office_go2rtc
    live_provider: go2rtc
    go2rtc:
      modes:
        - webrtc
        - mse
        - mp4
        - mjpeg
      stream: sitting_room
      url: 'https://my.custom.go2rtc.backend'
      metadata_fetch_timeout_seconds: 2
  - camera_entity: camera.office_go2rtc_experimental
    live_provider: go2rtc-experimental
    go2rtc:
      modes:
        - webrtc
        - mse
        - mp4
        - mjpeg
      stream: sitting_room
      url: 'https://my.custom.go2rtc.backend'
      metadata_fetch_timeout_seconds: 2
  - camera_entity: camera.office_jsmpeg
    live_provider: jsmpeg
    jsmpeg:
      options:
        audio: false
        video: true
        pauseWhenHidden: false
        disableGl: false
        disableWebAssembly: false
        preserveDrawingBuffer: false
        progressive: true
        throttled: true
        chunkSize: 1048576
        maxAudioLag: 10
        videoBufferSize: 524288
        audioBufferSize: 131072
  - camera_entity: camera.office_image
    live_provider: image
    image:
      mode: auto
      refresh_seconds: auto
      url: 'https://path/to/image.png'
      entity: image.office_person
      entity_parameters: 'width=400&height=200'
cameras_global:
  live_provider: go2rtc
```
