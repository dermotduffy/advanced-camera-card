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
- Must be running at least [Frigate integration `v5.12.0`](https://github.com/blakeblackshear/frigate-hass-integration/releases/tag/v5.12.0).

### Card requirements

- Only Frigate cameras are supported.
- Only the `go2rtc` and `go2rtc-experimental` live providers are supported.
- The browser must be able to reach `go2rtc` over WebRTC. Outbound audio always
  travels on its own WebRTC connection, regardless of what mode is carrying the
  video.

If your setup supports 2-way audio but detection is intermittent on load:

- Increase `cameras[].go2rtc.metadata_fetch_timeout_seconds`.
- Or force the capability with `cameras[].capabilities.force: ['2-way-audio']`.

If detection never succeeds for a camera, the `go2rtc` stream itself may not
offer 2-way audio -- see
[`go2rtc` live provider configuration](../configuration/cameras/live-provider.md?id=go2rtc).

Detection requires `go2rtc` to connect to the camera, so a successful result is
cached by the card for 5 minutes rather than detected again every time the card
loads. Reload your browser after changing the `go2rtc` configuration to have the
card detect changes immediately.

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

- Tap the call button to start an **outbound** call. An on-screen overlay
  appears with controls to mute/unmute the microphone, mute/unmute the inbound
  audio, and end the call. When more than one 2-way-audio camera is available
  the button becomes a submenu with one entry per camera.
- **Inbound** calls (started by a
  [`view.triggers.actions.trigger: call`](../configuration/view.md?id=trigger-action-configuration)
  trigger -- e.g. a doorbell) open the overlay in a ringing state with only
  two buttons: a red **Reject** and a green **Answer**.
- The **call** menu button itself tracks the call state: tap it to start or
  answer a call and to hang up an active one, and while an inbound call is
  ringing **hold** it to reject. This lets you drive the whole call from the
  menu when the standard call controls are hidden with
  [`live.controls.call.enabled: false`](../configuration/live.md?id=call) -- see
  [Driving calls from the menu](../examples.md?id=driving-calls-from-the-menu).
- When a call is answered (outbound calls are answered by definition) the
  inbound audio is unmuted automatically, so the caller can be heard. The
  microphone stays muted by default (push-to-talk) -- tap the microphone button
  in the overlay to speak. Both behaviors are configurable via
  [`live.microphone.auto_unmute`](../configuration/live.md?id=microphone) and
  [`live.auto_unmute`](../configuration/live.md).
- The camera loads _without_ the microphone connected, unless the
  [`always_connected`](../configuration/live.md?id=microphone) microphone option
  is set to `true`. Starting a call opens a separate connection that carries your
  voice to the camera; ending the call closes it. The camera's audio input is
  therefore occupied only while a call is in progress, leaving it free for other
  applications the rest of the time. Expect under half a second between starting
  a call and being audible on a local network, and a little more remotely. The
  video keeps playing throughout.
- The browser asks for microphone permission when a call needs it. How often it
  asks depends on the browser: Chrome remembers the choice for the site, Safari
  asks once per page load, and Firefox asks for every call unless _Remember this
  decision_ is ticked. Set
  [`always_connected`](../configuration/live.md?id=microphone) to `true` to be
  asked once at card load instead.
- While a call is in progress the card locks disruptive actions (camera and
  substream changes, casting, reload, etc.) so an accidental tap, swipe, or
  button press doesn't cut the call off. Set
  [`live.controls.call.lock`](../configuration/live.md?id=call) to `false` to
  disable this.
- End the call with the overlay's end-call button. When the call ends the
  microphone and inbound audio are muted again, and the microphone is
  disconnected. The exception is
  [`always_connected`](../configuration/live.md?id=microphone), which holds the
  microphone connected for as long as the card is running.

Calls can also be controlled programmatically with the
[`call_start`](../configuration/actions/custom/README.md?id=call_start),
[`call_answer`](../configuration/actions/custom/README.md?id=call_answer), and
[`call_end`](../configuration/actions/custom/README.md?id=call_end) actions --
for example, from an [automation](../configuration/automations.md) that fires
when a doorbell sensor triggers. The [`call` condition](../configuration/conditions-triggers.md?id=call)
can be used to show or hide elements while a call is in progress.

### Call lifecycle

The diagram below traces a call from start to finish:

![Call lifecycle sequence diagram](../images/call-sequence.svg ':size=600')

## Talking with a single tap

By default, two taps are needed to speak: start (or answer) the call so you can
hear, then unmute the microphone via the in-call overlay so you can be heard.
This push-to-talk default keeps the microphone muted until you explicitly choose
to speak.

To collapse that to a single tap, unmute the microphone automatically when a
call is answered:

```yaml
live:
  microphone:
    auto_unmute: ['call']
```

For outbound calls the microphone opens the moment the call starts; for inbound
calls it opens the moment you press the green answer button. Leave
[`auto_unmute`](../configuration/live.md?id=microphone) empty (the default) to
always start muted regardless.
