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
- Only the `webrtc` mode supports 2-way audio.

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
```

## Usage

Two-way audio is driven by the **call** menu button (a phone icon). It is
enabled by default and appears in the `live` view whenever the selected camera
-- or one of its [dependencies](../configuration/cameras/README.md?id=dependencies)
-- supports 2-way audio.

- Tap the call button to start a call. An on-screen overlay appears with
  controls to mute/unmute the microphone, mute/unmute the inbound audio, and end
  the call. When more than one 2-way-audio camera is available the button
  becomes a submenu with one entry per camera.
- When a call starts the inbound audio is unmuted automatically, so the caller
  can be heard immediately. The microphone stays muted by default
  (push-to-talk) -- tap the microphone button in the overlay to speak. This is
  configurable via [`live.microphone.auto_unmute`](../configuration/live.md?id=microphone)
  and [`live.auto_unmute`](../configuration/live.md).
- The camera will always load _without_ the microphone connected, unless the
  [`always_connected`](../configuration/live.md?id=microphone) microphone option
  is set to `true`. On the first call there may be a brief `webrtc` connection
  reset to include 2-way audio.
- While a call is in progress the card locks disruptive actions (camera and
  substream changes, casting, reload, etc.) so an accidental tap, swipe, or
  button press doesn't cut the call off. Set
  [`live.controls.call.lock`](../configuration/live.md?id=call) to `false` to
  disable this.
- End the call with the overlay's end-call button. When the call ends the
  microphone and inbound audio are muted again.
- The video automatically resets to remove the microphone after the number of
  seconds specified by [`disconnect_seconds`](../configuration/live.md?id=microphone)
  have elapsed since the call ended.

Calls can also be started and ended programmatically with the
[`call_start`](../configuration/actions/custom/README.md?id=call_start) and
[`call_end`](../configuration/actions/custom/README.md?id=call_end) actions --
for example, from an [automation](../configuration/automations.md) that fires
when a doorbell sensor triggers. The [`call` condition](../configuration/conditions.md?id=call)
can be used to show or hide elements while a call is in progress.

## Talking with a single tap

By default, two taps are needed to speak: the call button starts the call (so
you can hear), then the microphone button in the call overlay unmutes your
microphone (so you can be heard). This push-to-talk default keeps the microphone
closed until you explicitly choose to speak.

To collapse that to a single tap, unmute the microphone automatically when a
call starts:

```yaml
live:
  microphone:
    auto_unmute: ['call']
```

The call button then behaves as a toggle -- one tap starts the call and opens
the microphone, a second tap ends the call and closes it again. Note this also
opens the microphone for calls started by an
[automation](../configuration/automations.md); leave
[`auto_unmute`](../configuration/live.md?id=microphone) empty (the default) to
always start muted.
