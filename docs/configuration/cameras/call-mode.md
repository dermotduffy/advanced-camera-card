# `call_mode`

The `call_mode` block configures doorbell-style calling for a camera by temporarily switching the active live view to a dedicated stream.

This configuration is included as part of a camera entry in the `cameras` list.

> [!NOTE]
> The current implementation requires the camera to use the `go2rtc` [live provider](live-provider.md). Starting a call from a substream override is not currently supported.

```yaml
cameras:
  - camera_entity: camera.front_door
    live_provider: go2rtc
    call_mode:
      # [...]
```

| Option                        | Default | Description                                                                                                                                                                                                                                                                    |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `enabled`                     | `false` | Whether call mode is enabled for this camera.                                                                                                                                                                                                                                  |
| `stream`                      |         | The dedicated `go2rtc` stream name to use while the call is active. This is required when `enabled` is `true`.                                                                                                                                                                 |
| `auto_enable_microphone`      | `true`  | Whether the microphone should automatically be unmuted when the call stream finishes loading.                                                                                                                                                                                  |
| `auto_enable_speaker`         | `true`  | Whether inbound audio should automatically be unmuted when the call stream finishes loading.                                                                                                                                                                                   |
| `hide_menu_during_call`       | `true`  | Whether the regular built-in buttons menu should be suppressed while the call is active. This prevents taps on the live view from expanding the menu during a call session.                                                                                                   |
| `lock_navigation`             | `true`  | Whether normal navigation should be blocked while the call is active.                                                                                                                                                                                                          |
| `show_in_menu`                | `true`  | Whether the built-in `call` menu button should be shown for this camera. The button only appears in the live view when `call_mode.enabled` is `true`, no call is already active, and the active live view is not currently using a substream override. See [Menu](../menu.md). |
| `resume_normal_stream_on_end` | `true`  | Whether ending the call should immediately restore the camera's normal live stream. If `false`, the card stays on the dedicated call stream and only exits the in-call state.                                                                                                  |
| `end_call_on_view_change`     | `false` | Whether attempting a major view change while a call is active should automatically end the call and proceed to the requested destination instead of blocking navigation.                                                                                                       |

## Choosing end-of-call behavior

The two most important options are `resume_normal_stream_on_end` and `end_call_on_view_change`.

- Use `resume_normal_stream_on_end: true` if you want hanging up to behave like a temporary mode change that cleanly returns to the camera's usual live stream.
- Use `resume_normal_stream_on_end: false` if the dedicated call stream should remain visible after the conversation ends, for example if you want the operator to keep monitoring the same low-latency feed.
- Use `end_call_on_view_change: false` together with `lock_navigation: true` if you want the operator to stay anchored in the call until they explicitly hang up.
- Use `end_call_on_view_change: true` if navigation attempts should act like an implicit hangup and immediately move to the requested destination.

## Example

```yaml
cameras:
  - camera_entity: camera.front_door
    live_provider: go2rtc
    go2rtc:
      stream: front_door_main
    call_mode:
      enabled: true
      stream: front_door_intercom
      auto_enable_microphone: true
      auto_enable_speaker: true
      hide_menu_during_call: true
      lock_navigation: true
      show_in_menu: true
      resume_normal_stream_on_end: true
      end_call_on_view_change: false
```

In this example, tapping the `call` button switches the camera from its normal `front_door_main` stream to the dedicated `front_door_intercom` stream. Hanging up returns the user to the normal stream, and navigation remains locked until the call is explicitly ended.
