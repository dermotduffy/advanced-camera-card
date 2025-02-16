# `conditions`

`conditions` is not a top-level configuration block, but can be used as part of
multiple other blocks.

Conditions are used to conditionally take action (in `automations`), to apply
certain configurations (in `overrides`) or to display "picture elements" (in
`elements`) depending on runtime evaluation.

```yaml
[used as part of other configuration]
  conditions:
    - [condition_1]
    - [condition_2]
```

## `camera`

Matches based on the selected camera. Does not match other cameras (whether
visible or not).

```yaml
conditions:
  - condition: camera
    # [...]
```

| Parameter   | Description                                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `condition` | Must be `camera`.                                                                                                                                                                     |
| `cameras`   | An optional list of camera IDs in which this condition is satisfied. If not specified, any camera change will satisy the condition. See the camera [id](cameras/README.md) parameter. |

## `config`

Matches when card configuration changes (e.g. on startup, or when [Configuration Overrides](./overrides.md) are applied).

```yaml
conditions:
  - condition: config
    # [...]
```

| Parameter   | Description                                                                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `condition` | Must be `config`.                                                                                                                                     |
| `paths`     | An optional array of configuration paths (e.g. `menu.style`). If provided condition matches if _ANY_ of the provided configuration paths has changed. |

## `expand`

Matches based on whether the card is in "expanded" mode.

```yaml
conditions:
  - condition: expand
    # [...]
```

| Parameter   | Description                                                                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `condition` | Must be `expand`.                                                                                                                                                                            |
| `expand`    | If `true` the condition is satisfied if the card is in expanded mode (in a dialog/popup). If `false` the condition is satisfied if the card is **NOT** in expanded mode (in a dialog/popup). |

## `fullscreen`

Matches based on whether the card is in fullscreen.

```yaml
conditions:
  - condition: fullscreen
    # [...]
```

| Parameter    | Description                                                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `condition`  | Must be `fullscreen`.                                                                                                                                    |
| `fullscreen` | If `true` the condition is satisfied if the card is in fullscreen mode. If `false` the condition is satisfied if the card is **NOT** in fullscreen mode. |

## `initialized`

Matches when the card is first initialized.

```yaml
conditions:
  - condition: initialized
```

| Parameter   | Description            |
| ----------- | ---------------------- |
| `condition` | Must be `initialized`. |

?> This is exclusively useful for running [automations](./automations.md) on card start.

## `interaction`

Matches based on whether the card has been interacted with.

```yaml
conditions:
  - condition: interaction
    # [...]
```

| Parameter     | Description                                                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `condition`   | Must be `interaction`.                                                                                                                                                                                                          |
| `interaction` | If `true` the condition is satisfied if the card has had human interaction within `view.interaction_seconds` elapsed seconds. If `false` the condition is satisfied if the card has **NOT** had human interaction in that time. |

## `key`

Matches based on key state.

```yaml
conditions:
  - condition: key
    # [...]
```

| Parameter   | Default | Description                                                                                                                       |
| ----------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `condition` | -       | Must be `key`.                                                                                                                    |
| `alt`       | `false` | An optional value to match whether the `alt` key is being held.                                                                   |
| `ctrl`      | `false` | An optional value to match whether the `ctrl` key is being held.                                                                  |
| `key`       |         | Any [keyboard key value](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values), e.g. `ArrowLeft`. |
| `meta`      | `false` | An optional value to match whether the `meta` key is being held.                                                                  |
| `shift`     | `false` | An optional value to match whether the `shift` key is being held.                                                                 |
| `state`     | `down`  | An optional value to match the state of the. Must be one of `down` or `up`.                                                       |

## `media_loaded`

Matches based on whether the selected live or media stream has loaded.

```yaml
conditions:
  - condition: media_loaded
    # [...]
```

| Parameter      | Description                                                                                                                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `condition`    | Must be `media_loaded`.                                                                                                                                                                                                                        |
| `media_loaded` | If `true` the condition is satisfied if there is media load**ED** (not load**ING**) in the card (e.g. a clip, snapshot or live view). This may be used to hide controls during media loading or when a message (not media) is being displayed. |

## `microphone`

Matches based on microphone state.

```yaml
conditions:
  - condition: microphone
    # [...]
```

| Parameter   | Description                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| `condition` | Must be `microphone`.                                                                                                  |
| `connected` | Optional: If `true` or `false` the condition is satisfied if the microphone is connected or disconnected respectively. |
| `muted`     | Optional: If `true` or `false` the condition is satisfied if the microphone is muted or unmuted respectively.          |

When multiple parameters are specified they must all match for the condition to
match.

## `numeric_state`

Matches based on numeric Home Assistant state.

```yaml
conditions:
  - condition: numeric_state
    # [...]
```

See [Home Assistant conditions documentation](https://www.home-assistant.io/dashboards/conditional/#numeric-state).

## `screen`

Matches based on [media queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Media_Queries/Using_media_queries).

```yaml
conditions:
  - condition: screen
    # [...]
```

| Parameter     | Description                                                                                                                                                                                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `condition`   | Must be `screen`.                                                                                                                                                                                                                                                                                                                                                              |
| `media_query` | Any valid [media query](https://developer.mozilla.org/en-US/docs/Web/CSS/Media_Queries/Using_media_queries) string. Media queries must start and end with parentheses. This may be used to alter card configuration based on device/media properties (e.g. viewport width, orientation). Please note that `width` and `height` refer to the entire viewport not just the card. |

See the [screen conditions examples](../examples.md?id=screen-conditions).

## `state`

Matches based on Home Assistant state.

```yaml
conditions:
  - condition: state
    # [...]
```

| Parameter   | Description                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| `condition` | Must be `state`.                                                                                       |
| `entity`    | The entity to check the state of.                                                                      |
| `state`     | A single entity state, or list of entity states, against which the entity state is compared.           |
| `state_not` | A single entity state, or list of entity states, against which the entity state is inversely compared. |

!> If multiple state conditions are used together with neither `state` nor
`state_not` specified, this effectively means the state for multiple entities
needs to _change_ simultaneously. This is unlikely to happen in reality, and
almost certainly not useful / reliable as a condition.

See [Home Assistant conditions documentation](https://www.home-assistant.io/dashboards/conditional/#state).

## `triggered`

Matches based on whether the selected camera has been triggered.

```yaml
conditions:
  - condition: triggered
    # [...]
```

| Parameter   | Description                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------- |
| `condition` | Must be `triggered`.                                                                              |
| `triggered` | A list of camera IDs which, if [triggered](cameras/README.md?id=triggers), satisfy the condition. |

## `user`

Matches based on the Home Assistant user that is logged in. See [Home Assistant conditions documentation](https://www.home-assistant.io/dashboards/conditional/#user).

```yaml
conditions:
  - condition: user
    # [...]
```

## `user_agent`

Matches based on the [User-Agent](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent).

```yaml
conditions:
  - condition: user_agent
    # [...]
```

| Parameter       | Description                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `condition`     | Must be `user_agent`.                                                                                                                                    |
| `user_agent`    | Exactly matches a user-agent, e.g. `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36`               |
| `user_agent_re` | Matches a user-agent based on a regular expression, e.g. `Chrome/`.                                                                                      |
| `companion`     | If `true` matches if the user-agent is the Home Assistant companion app, if `false` matches if the user-agent is _NOT_ the Home Assistant companion app. |

When multiple parameters are specified they must all match for the condition to
match.

See the [user-agent overrides example](../examples.md?id=disable-ptz-controls-in-the-home-assistant-companion-app).

## `view`

Matches based on the selected view.

```yaml
conditions:
  - condition: view
    # [...]
```

| Parameter   | Description                                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `condition` | Must be `view`.                                                                                                                                                          |
| `views`     | An optional list of [views](view.md?id=supported-views) in which this condition is satified (e.g. `clips`). If not specified, any view change will satisy the condition. |

?> Internally, views associated with the media viewer (e.g. `clip`, `snapshot`,
`recording`) are translated to a special view called `media` after the relevant
media is fetched. When including views as part of a [condition](conditions.md),
you may need to refer to this special `media` view.

## Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
conditions:
 - condition: camera
   cameras:
     - camera.office
  - condition: config
    paths:
      - "menu.style"
  - condition: expand
    expand: true
  - condition: fullscreen
    fullscreen: true
  - condition: initialized
  - condition: interaction
    interaction: true
  - condition: key
    alt: false
    ctrl: false
    key: F
    meta: false
    shift: false
    state: down
  - condition: media_loaded
    media_loaded: true
  - condition: microphone
    connected: true
    muted: true
  - condition: numeric_state
    entity: sensor.office_temperature
    above: 10
    below: 20
  - condition: screen
    media_query: '(orientation: landscape)'
  - condition: state
    entity: climate.office
    state: heat
    state_not: off
  - condition: triggered
    triggered:
      - camera.office
  - condition: user
    users:
      - 581fca7fdc014b8b894519cc531f9a04
  - condition: user_agent
    user_agent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    user_agent_re: "Chrome/"
    companion: true
  - condition: view
    views:
      - live
```
