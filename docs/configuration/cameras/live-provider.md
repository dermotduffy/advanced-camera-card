# `live_provider`

## Overview

The `live_provider` parameter determines what provides the live stream for a camera. Each provider offers different capabilities:

| Live Provider                      | Latency | Frame Rate | Loading Time | Installation                   | Supports [Proxying](./README.md?id=proxy) | Description                                                                                                                                                                                                   |
| ---------------------------------- | ------- | ---------- | ------------ | ------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `go2rtc`                           | Best    | High       | Better       | Builtin                        | :white_check_mark:                        | Uses [go2rtc](https://github.com/AlexxIT/go2rtc) to stream live feeds and supports 2-way audio.                                                                                                               |
| `ha` (Native WebRTC)               | Best    | High       | Better       | Builtin                        | :heavy_multiplication_x:                  | Use the built-in Home Assistant camera streams -- will offer a very low-latency feed direct to your browser.                                                                                                  |
| `ha` (HLS)                         | Poor    | High       | Better       | Builtin                        | :heavy_multiplication_x:                  | Use the built-in Home Assistant camera streams -- HLS fallback when a WebRTC connection cannot be established.                                                                                                |
| `ha` (when configured with LL-HLS) | Better  | High       | Better       | Builtin                        | :heavy_multiplication_x:                  | Use the built-in Home Assistant camera streams -- can be configured to use an [LL-HLS](https://www.home-assistant.io/integrations/stream/#ll-hls) feed for lower latency.                                     |
| `image`                            | Poor    | Poor       | Best         | Builtin                        | :heavy_multiplication_x:                  | Use refreshing snapshots of the built-in Home Assistant camera streams.                                                                                                                                       |
| `jsmpeg`                           | Better  | Low        | Poor         | Builtin                        | :heavy_multiplication_x:                  | Use a the JSMPEG stream.                                                                                                                                                                                      |
| `webrtc-card`                      | Best    | High       | Better       | Separate installation required | :heavy_multiplication_x:                  | Embed's [AlexxIT's WebRTC Card](https://github.com/AlexxIT/WebRTC) to stream live feed, requires manual extra setup. See below. Not to be confused with native Home Assistant WebRTC (use the `ha` provider). |

## `go2rtc`

The `go2rtc` block configures use of the `go2rtc` live provider. This configuration is included as part of a camera entry in the `cameras` list.

```yaml
cameras:
  - camera_entity: camera.office
    live_provider: go2rtc
    go2rtc:
      # [...]
```

| Option   | Default                                                                                                                                              | Description                                                                                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modes`  | `[webrtc, mse, mp4, mjpeg]`                                                                                                                          | An ordered list of `go2rtc` modes to use. Valid values are `webrtc`, `mse`, `mp4` or `mjpeg` values.                                                                             |
| `stream` | Determined by camera engine (e.g. `frigate` camera name).                                                                                            | A valid `go2rtc` stream name.                                                                                                                                                    |
| `url`    | Determined by camera engine (e.g. the `frigate` engine will automatically generate a URL for the go2rtc backend that runs in the Frigate container). | The root `go2rtc` URL the card should stream the video from. This is only needed for non-Frigate usecases, or advanced Frigate usecases. Example: `http://my-custom-go2rtc:1984` |

> [!NOTE]
> If `url` is manually set and `proxy.live` is set to `auto` on the camera (the default), the video stream will automatically be proxied via the Home Assistant process if the [hass-web-proxy-integration](https://github.com/dermotduffy/hass-web-proxy-integration) is detected. See [proxying](./README.md?id=proxy).

## `image`

All configuration is under:

```yaml
cameras:
  - camera_entity: camera.office
    live_provider: image
    image:
      # [...]
```

| Option              | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entity`            |         | The entity to use when `mode` is set to `entity`. This entity is expected to have an `entity_picture` attribute that specifies the image URL.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `entity_parameters` |         | Optional URL parameters to add to the URL generated for entity-based modes (i.e. when `mode` is `camera` or `entity`).                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `mode`              | `auto`  | Value must be one of `url` (to fetch an arbitrary image URL), `camera` (to show a still of the currently selected camera entity using either `camera_entity` or `webrtc_card.entity` in that order of precedence), `entity` to show an image associated with a named entity (see the `entity` parameter below), or `screensaver` (to show an [embedded image](https://github.com/dermotduffy/advanced-camera-card/blob/main/src/images/iris-screensaver.jpg)). If `auto`, the mode is chosen automatically based on whether `url` or `entity` parameters have been specified. |
| `refresh_seconds`   | 1       | The image will be refreshed at least every `refresh_seconds` (it may refresh more frequently, e.g. whenever Home Assistant updates its camera security token). `0` implies no refreshing.                                                                                                                                                                                                                                                                                                                                                                                     |
| `url`               |         | A static image URL to be used when the `mode` is set to `url` or when a temporary image is required (e.g. may appear momentarily prior to load of a camera snapshot in the `camera` mode). Note that a `_t=[timestsamp]` query parameter will be automatically added to all URLs such that the image will not be cached by the browser.                                                                                                                                                                                                                                       |

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

| Option   | Default                                                                                                                                                                                                             | Description                                                                                                                                                                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entity` |                                                                                                                                                                                                                     | The RTSP camera entity to pass to the WebRTC Card for this camera.                                                                                                                                                                                                                              |
| `url`    | Depends on the camera engine (e.g. Frigate cameras will automatically use the camera name since this is the [recommended setup](https://deploy-preview-4055--frigate-docs.netlify.app/guides/configuring_go2rtc/)). | The RTSP url to pass to the WebRTC Card, e.g. `rtsp://USERNAME:PASSWORD@CAMERA:554/RTSP_PATH`                                                                                                                                                                                                   |
| `*`      |                                                                                                                                                                                                                     | Any options specified in the `webrtc_card:` YAML dictionary are silently passed through to the AlexxIT's WebRTC Card. See [WebRTC Configuration](https://github.com/AlexxIT/WebRTC#configuration) for full details this external card provides, e.g. `ui: true` will enable the WebRTC Card UI. |

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
      refresh_seconds: 1
      url: 'https://path/to/image.png'
      entity: image.office_person
      entity_parameters: 'width=400&height=200'
cameras_global:
  live_provider: go2rtc
```
