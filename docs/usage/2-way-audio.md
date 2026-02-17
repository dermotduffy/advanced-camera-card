# 2-way Audio

This card supports 2-way audio (e.g. transmitting audio from a microphone to a
suitably equipped camera). In general, due to the myriad of different cameras,
security requirements and browser limitations getting 2-way to work may be
challenging.

## Requirements

### Environmental requirements

- Must have a camera that supports audio out (otherwise what's the point!)
- Camera must be supported by `go2rtc` for 2-way audio (see [supported cameras](https://github.com/AlexxIT/go2rtc#two-way-audio)).
- Must be accessing your Home Assistant instance over `https`. The browser will enforce this.

### Card requirements

- Only Frigate cameras are supported.
- Only the `go2rtc` live provider is supported.
- Only the `webrtc` mode supports 2-way audio:
- Must have microphone menu button enabled:

If your setup supports 2-way audio but detection is intermittent on load:

- Increase `cameras[].go2rtc.metadata_fetch_timeout_seconds`.
- Or force the capability with `cameras[].capabilities.force: ['2-way-audio']`.

## Example configuration

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
    live_provider: go2rtc
    go2rtc:
      modes:
        - webrtc
      # Optional: For slower cameras increase timeout (default: 2)
      metadata_fetch_timeout_seconds: 10
menu:
  buttons:
    microphone:
      enabled: true
```

## Usage

- The camera will always load _without_ the microphone connected, unless the
  [`always_connected`](../configuration/live.md?id=microphone) microphone option is
  set to `true`.
- To speak, hold-down the microphone menu button.
  - On first press, this will reset the `webrtc` connection to include 2-way
    audio unless [`always_connected`](../configuration/live.md?id=microphone) has
    been used.
  - Thereafter hold the microphone button down to unmute/speak, let go to
    mute.
- The video will automatically reset to remove the microphone after the number
  of seconds specified by
  [`disconnect_seconds`](../configuration/live.md?id=microphone) configuration have
  elapsed since the last mute/unmute press.
