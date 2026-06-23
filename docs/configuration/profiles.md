# `profiles`

Apply pre-configured sets of defaults to ease card configuration.

```yaml
profiles:
  - [profile_1]
  - [profile_2]
```

> [!NOTE]
> Since the profiles change the _default_ value of options, setting a profile
> on a pre-existing card could have limited effect if there are options already set by
> the user.

> [!NOTE]
> Profiles are applied top to bottom. If multiple profiles change a configuration default, then the last one "wins"

| Profile name      | Purpose                                                      |
| ----------------- | ------------------------------------------------------------ |
| `casting`         | Configure the card to be casted.                             |
| `doorbell`        | Configure the card to ring like a phone on a doorbell press. |
| `low-performance` | Configure the card for lower end devices.                    |
| `scrubbing`       | Configure the card to allow "video scrubbing".               |

## `casting`

To aid casting the card to Chromecast devices, the `casting` profile will adjust card defaults to better suit casting. You may wish to combine this the `low-performance` profile below, since Chromecast devices tend to lower performance. To combine, list `low-performance` first, to allow `casting` to take precedence:

```yaml
profiles:
  - low-performance
  - casting
```

## `doorbell`

Turns the card into a phone-style ringer that answers a [two-way audio
call](../usage/2-way-audio.md) when somebody presses a doorbell. Intended for a
wall-mounted tablet sitting on a dashboard with a doorbell camera.

Minimal configuration -- just point it at a doorbell-capable camera:

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.front_door
profiles:
  - doorbell
```

> [!NOTE]
> For inbound audio to actually work the camera still needs a live provider that supports two-way audio (e.g. `go2rtc` with `webrtc` mode). The profile does not change `live_provider` since that's setup-specific.

See the [source code](https://github.com/dermotduffy/advanced-camera-card/blob/main/src/config/profiles/doorbell.ts) for an exhaustive list of options set by this profile.

## `low-performance`

For low end devices, the `low-performance` profile will adjust card defaults to attempt to increase performance.

Principles used in the selection of options set by `low-performance` profile mode:

- Get 'out of the box' performance similar to the basic "Home Assistant Picture Glance" card.
- Do not break the visual aesthetic of the card.

See the [source code](https://github.com/dermotduffy/advanced-camera-card/blob/main/src/config/profiles/low-performance.ts) for an exhaustive list of defaults set by this profile.

## `scrubbing`

Configures the `live` view and media viewer to allow media "scrubbing" as the timeline is dragged back and forth.

See the [source code](https://github.com/dermotduffy/advanced-camera-card/blob/main/src/config/profiles/scrubbing.ts) for an exhaustive list of options set by this profile.

## Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
profiles:
  - casting
  - doorbell
  - low-performance
  - scrubbing
```
