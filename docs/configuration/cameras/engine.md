# `engine`

## Overview

A "Camera Engine" defines what "type" of camera is being configured (e.g. `frigate`), each engine offers different capabilities:

| Engine      | Live               | Supports clips           | Supports Snapshots       | Supports Recordings      | Supports Timeline        | Supports PTZ out of the box | Supports manually configured PTZ | Favorite events          | Favorite recordings      | Detect new events        | Detect new snapshots     | Detect new clips         | May requiring [proxying](./README.md?id=proxy) | Thumbnails               |
| ----------- | ------------------ | ------------------------ | ------------------------ | ------------------------ | ------------------------ | --------------------------- | -------------------------------- | ------------------------ | ------------------------ | ------------------------ | ------------------------ | ------------------------ | ---------------------------------------------- | ------------------------ |
| `frigate`   | :white_check_mark: | :white_check_mark:       | :white_check_mark:       | :white_check_mark:       | :white_check_mark:       | :white_check_mark:          | :white_check_mark:               | :white_check_mark:       | :heavy_multiplication_x: | :white_check_mark:       | :white_check_mark:       | :white_check_mark:       | :heavy_multiplication_x:                       | :white_check_mark:       |
| `generic`   | :white_check_mark: | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_multiplication_x:    | :white_check_mark:               | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_multiplication_x:                       | :heavy_multiplication_x: |
| `motioneye` | :white_check_mark: | :white_check_mark:       | :white_check_mark:       | :heavy_multiplication_x: | :white_check_mark:       | :heavy_multiplication_x:    | :white_check_mark:               | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_multiplication_x: | :white_check_mark:                             | :white_check_mark:       |
| `reolink`   | :white_check_mark: | :white_check_mark:       | :heavy_multiplication_x: | :heavy_multiplication_x: | :white_check_mark:       | :eight_spoked_asterisk:     | :white_check_mark:               | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_multiplication_x: | :white_check_mark:                             | :heavy_multiplication_x: |

### Live providers supported per Engine

| Engine / Live Provider | `ha`               | `image`            | `jsmpeg`                 | `go2rtc`           | `webrtc-card`            |
| ---------------------- | ------------------ | ------------------ | ------------------------ | ------------------ | ------------------------ |
| `frigate`              | :white_check_mark: | :white_check_mark: | :white_check_mark:       | :white_check_mark: | :white_check_mark:       |
| `generic`              | :white_check_mark: | :white_check_mark: | :heavy_multiplication_x: | :white_check_mark: | :white_check_mark:       |
| `motioneye`            | :white_check_mark: | :white_check_mark: | :heavy_multiplication_x: | :white_check_mark: | :heavy_multiplication_x: |
| `reolink`              | :white_check_mark: | :white_check_mark: | :heavy_multiplication_x: | :white_check_mark: | :heavy_multiplication_x: |

See [Live Provider Configuration](live-provider.md) for more details on live providers.

## `frigate`

The `frigate` block configures options for a Frigate camera.

```yaml
cameras:
  - camera_entity: camera.office
    frigate:
      # [...]
```

| Option        | Default                                                 | Description                                                                                                                                                                                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `camera_name` | Autodetected from `camera_entity` if that is specified. | The Frigate camera name to use when communicating with the Frigate server, e.g. for viewing clips/snapshots or the JSMPEG live view.                                                                                                                                                                                                                              |
| `client_id`   | `frigate`                                               | The Frigate client id to use. If this Home Assistant server has multiple Frigate server backends configured, this selects which server should be used. It should be set to the MQTT client id configured for this server, see [Frigate Integration Multiple Instance Support](https://docs.frigate.video/integrations/home-assistant/#multiple-instance-support). |
| `labels`      |                                                         | A list of Frigate labels used to filter events (clips & snapshots), e.g. [`person`, `car`].                                                                                                                                                                                                                                                                       |
| `url`         |                                                         | The URL of the frigate server. If set, this value will be (exclusively) used for a `Camera UI` menu button. All other communication with Frigate goes via Home Assistant.                                                                                                                                                                                         |
| `zones`       |                                                         | A list of Frigates zones used to filter events (clips & snapshots), e.g. [`front_door`, `front_steps`].                                                                                                                                                                                                                                                           |

## `motioneye`

The `motioneye` block configures options for a MotionEye camera.

```yaml
cameras:
  - camera_entity: camera.office
    motioneye:
      # [...]
```

| Option   | Default | Description                                                                                                   |
| -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `images` |         | Configure how MotionEye images are consumed. See below.                                                       |
| `movies` |         | Configure how MotionEye movies are consumed. See below.                                                       |
| `url`    |         | The URL of the MotionEye server. If set, this value will be (exclusively) used for a `Camera UI` menu button. |

### `images` / `movies`

The `images` and `movies` block configures how images and movies respectively are fetched from motionEye. The options for both blocks are the same.

```yaml
cameras:
  - camera_entity: camera.office
    motioneye:
      images:
        # [...]
```

```yaml
cameras:
  - camera_entity: camera.office
    motioneye:
      movies:
        # [...]
```

| Option              | Default    | Description                                                                                                                                                                                                                                                                                                                               |
| ------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `directory_pattern` | `%Y-%m-%d` | The directory that motionEye is configured to store media into. May contain multiple sub-directories separated by `/`. Path must encode the date of the media using MotionEye patterns such as `%Y`, `%m`, `%d`, `%H`, `%M`, `%S` (at least one pattern is required). Consult MotionEye help text for information on these substitutions. |
| `file_pattern`      | `%H-%M-%S` | Within a directory (as matched by `directory_pattern`) the media items must exist and match this pattern. `file_pattern` must encode the time of the media using MotionEye patterns such as `%Y`, `%m`, `%d`, `%H`, `%M`, `%S` (at least one pattern is required). Consult MotionEye help text for information on these substitutions.    |

## `reolink`

[](../common/experimental-warning.md ':include')

The `reolink` block configures options for a Reolink camera.

```yaml
cameras:
  - camera_entity: camera.office
    reolink:
      # [...]
```

| Option             | Default                                     | Description                                                                                                                                                                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `channel`          | autodetected (direct), or `0` (via NVR/Hub) | The channel number for the Reolink camera, used by the Reolink integration to identify different cameras. For cameras directly connected to Home Assistant (w/o an NVR), this value will be autodetected and need not be set. For cameras connected via a Hub/NVR, this value cannot currently be autodetected -- a default value of `0` will be used in this case. |
| `media_resolution` | `low`                                       | Whether to retrieve `high` or `low` resolution media items.                                                                                                                                                                                                                                                                                                         |
| `url`              |                                             | The URL of the Reolink camera/NVR UI. If set, this value will be (exclusively) used for a `Camera UI` menu button.                                                                                                                                                                                                                                                  |

?> If media for the "wrong" Reolink camera is showing up and you have an NVR connected camera, your `channel` value is likely incorrect. Try increasing it until you find the correct camera.

### PTZ Support

Zero-configuration PTZ support is available for Reolink if your camera supports it.

!> For Home Assistant control of Reolink camera PTZ functions, the relevent `button` entities must be enabled. To verify, navigate to `Settings -> Devices & services -> Reolink -> [Choose Device]`, and ensure the `PTZ` entities are enabled. Disabled entities are shown under the `+X disabled entities` label. :eight_spoked_asterisk:

## Fully expanded reference

[](../common/expanded-warning.md ':include')

```yaml
cameras:
  - camera_entity: camera.office_auto
    engine: auto
  - camera_entity: camera.office_frigate
    frigate:
      url: http://my.frigate.local
      client_id: frigate
      camera_name: front_door
      labels:
        - person
      zones:
        - steps
  - camera_entity: camera.office_motioneye
    motioneye:
      images:
        directory_pattern: '%Y-%m-%d'
        file_pattern: '%H-%M-%S'
      movies:
        directory_pattern: '%Y-%m-%d'
        file_pattern: '%H-%M-%S'
  - camera_entity: camera.office_generic
    engine: generic
  - camera_entity: camera.office_reolink
    reolink:
      url: http://my.reolink.local
      media_resolution: low
```
