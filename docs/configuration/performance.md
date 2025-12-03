# `performance`

Configure the card performance settings to enable the card to run (more) smoothly on lower end devices.

```yaml
performance:
  # [...]
```

| Option     | Default | Description                                         |
| ---------- | ------- | --------------------------------------------------- |
| `features` |         | Configure feature settings that impact performance. |
| `style`    |         | Configure style settings that impact performance.   |

### `features`

Controls card-wide functionality that may impact performance.

```yaml
performance:
  features:
    # [...]
```

| Option                             | Default    | Description                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `animated_progress_indicator`      | `true`     | Will show the animated progress indicator 'spinners' when `true`.                                                                                                                                                                                                                                                                                                                                                   |
| `card_loading_effects`             | `true`     | Will occasionally show (silly) visual effects during card loading (e.g. fireworks on New Year's Day).                                                                                                                                                                                                                                                                                                               |
| `card_loading_indicator`           | `true`     | Will show the card loading indicator (spinner & version number) and effects (see `card_loading_effects` below) when `true`.                                                                                                                                                                                                                                                                                         |
| `media_chunk_size`                 | `50`       | How many media items to fetch and render at a time (e.g. thumbnails under a live view, or number of snapshots to load in the media viewer). This may only make partial sense in some contexts (e.g. the 'infinite gallery' is still infinite, it just loads thumbnails this many items at a time) or not at all (e.g. the timeline will show the number of events dictated by the time span the user navigates to). |
| `max_simultaneous_engine_requests` | _Infinity_ | How many camera engine requests to allow occur in parallel. Setting lower values will slow the card down since more requests will run in sequence, but it will increase the chances of positive cache hit rates and reduce the chances of overwhelming the backend.                                                                                                                                                 |

### `style`

Style performance options request the card minimize certain expensive CSS
stylings. This does not necessarily disable these stylings _entirely_ since that
may break the basic expected visuals of the card (e.g. menu icons need curves),
but rather avoids use of them in high item-count situations (e.g. avoiding
shadows on timeline items, or curves in the media gallery items).

```yaml
performance:
  style:
    # [...]
```

| Option          | Default | Description                                        |
| --------------- | ------- | -------------------------------------------------- |
| `border_radius` | `true`  | If `false` minimizes the usage of rounded corners. |
| `box_shadow`    | `true`  | If `false` minimizes the usage of shadows.         |

### The `low-performance` profile

For low end devices, the `low-performance` profile will adjust card defaults to attempt to improve performance. See the [profiles](profiles.md) configuration option for details on how to select profiles.

## Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
performance:
  features:
    animated_progress_indicator: true
    card_loading_effects: true
    card_loading_indicator: true
    media_chunk_size: 50
    max_simultaneous_engine_requests: 100
  style:
    border_radius: true
    box_shadow: true
```
