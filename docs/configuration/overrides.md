# `overrides`

The card configuration may [conditionally](conditions.md) be overridden (e.g. to
hide the menu in fullscreen mode).

```yaml
overrides:
  - conditions:
      - [condition]
    # [...]
```

> [!WARNING]
> Whilst all configuration parameters are theoretically overridable, in some instances a configuration variable may only be consulted on startup or changing its value may negatively impact behavior -- override results may vary!

The top-level `overrides` configuration block expects a list, with each list
item containing `conditions` and at least one of `merge`, `delete` or `set` specified.

| Option       | Default | Description                                                                                                  |
| ------------ | ------- | ------------------------------------------------------------------------------------------------------------ |
| `conditions` |         | A list of [conditions](conditions.md) that must evaluate to `true` in order for the overrides to be applied. |
| `delete`     |         | An array of configuration paths to delete. See below.                                                        |
| `merge`      |         | A dictionary of configuration paths to merge. See below.                                                     |
| `set`        |         | A dictionary of configuration paths to set. See below.                                                       |

## Configuration Paths

The `delete`, `merge` and `set` parameters take configuration paths. Paths are dot-separated references to particular configuration parameters. To refer to list elements use `[n]` notation.

For example the path `cameras[1].dimensions.aspect_ratio` refers to the `aspect_ratio` parameter below:

```yaml
cameras:
  - camera_entity: camera.other
  - camera_entity: camera.relevant
    dimensions:
      aspect_ratio: '16:9'
```

## `delete`

An array of configuration paths to delete.

```yaml
overrides:
  - conditions:
      - [condition]
    delete:
      - [path_1]
      - [path_2]
```

### Examples

Delete the 3rd camera (it indexes from 0):

```yaml
overrides:
  - conditions:
      - [condition]
    delete:
      - 'cameras[2]'
```

Delete the menu style parameter, thus falling back to the default:

```yaml
overrides:
  - conditions:
      - [condition]
    delete:
      - 'menu.style'
```

## `merge`

Specifies an object to recursively merge into existing configuration.

| Option               | Default | Description                                                                            |
| -------------------- | ------- | -------------------------------------------------------------------------------------- |
| [configuration path] |         | Arbitrary configuration object to merge. Must be an object (i.e. not a literal value). |

### Examples

Hide the menu when a given condition is met:

```yaml
overrides:
  - conditions:
      - [condition]
    merge:
      menu: { style: 'hidden' }
```

Enable thumbnails below the `live` feed:

```yaml
overrides:
  - conditions:
      - [condition]
    merge:
      'live.controls.thumbnails': { mode: 'below' }
```

Also enables thumbnails below the `live` feed, but without using the dot-separated notation:

```yaml
overrides:
  - conditions:
      - [condition]
    merge:
      live: { controls: { thumbnails: { mode: 'below' } } }
```

## `set`

Specifies a value to set in the configuration. This differs from `merge` in that the existing value is entirely replaced.

| Option               | Default | Description                                           |
| -------------------- | ------- | ----------------------------------------------------- |
| [configuration path] |         | Arbitrary configuration value / object / list to set. |

### Examples

Set the entire menu configuration to defaults with the exception of the `style` which is set to `overlay`.

```yaml
overrides:
  - conditions:
      - [condition]
    set:
      menu: { style: 'overlay' }
```

Set the menu style but without touching the other `menu` parameters:

```yaml
overrides:
  - conditions:
      - [condition]
    set:
      'menu.style': 'overlay'
```

That is equivalent to merging the following:

```yaml
overrides:
  - conditions:
      - [condition]
    merge:
      menu: { style: 'overlay' }
```
