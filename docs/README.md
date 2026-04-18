# Getting Started

## Installation

- [HACS](https://hacs.xyz/) is **highly** recommended to install the card -- it works for all Home Assistant variants. If you don't have [HACS](https://hacs.xyz/) installed, start there -- then come back to these instructions.

- Find the card in HACS:

```
Home Assistant > HACS > Frontend > "Explore & Add Integrations" > Advanced Camera Card
```

- Click `Download this repository with HACS`.

See [Advanced Installation](advanced-installation.md) for other installation resources, or [Rolling Back](./rolling-back.md) to rollback to prior versions.

## Adding your card

- On a Home Assistant dashboard, choose:

```
[Three dots menu] > Edit dashboard
```

- Click `+ Add Card` shown on the bottom of the screen
- Choose `Custom: Advanced Camera Card` from the list

## Initial configuration

### Minimal camera configuration

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
```

### Minimal folder configuration

```yaml
type: custom:advanced-camera-card
folders:
  - type: ha
```

### Video scrubbing configuration

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
profiles:
  - scrubbing
```

### Multi-camera grid configuration

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
  - camera_entity: camera.kitchen
live:
  display:
    mode: grid
```

See [Configuration](configuration/README.md) for full details on supported configuration options.
