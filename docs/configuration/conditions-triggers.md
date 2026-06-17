# Conditions & triggers

Conditions and triggers are designed to mirror Home Assistant's own
[conditions](https://www.home-assistant.io/docs/scripts/conditions/) and
[triggers](https://www.home-assistant.io/docs/automation/trigger/) as closely as
possible: for the standard types Home Assistant's own documentation applies, and
you can copy conditions and triggers straight out of an existing Home Assistant
automation. The card adds a number of card-specific types, and is a little more
permissive in places; any differences are noted per type below.

A **trigger** is what wakes an [automation](automations.md) up. The moment a
trigger fires, the card checks any **conditions** you have set, and if they all
pass it runs the [actions](actions/README.md). The two therefore play different
roles:

- A **trigger** is a _momentary_ occurrence. Used only under `triggers:`, and
  only in automations.
- A **condition** is an _ongoing_ predicate, true or false at a point in time.
  Besides gating automations (checked the instant a trigger fires), conditions
  also drive [overrides](overrides.md) and [picture elements](elements/README.md).

The same type can usually be used either way, but the meaning differs: as a
**condition** it asks _"is this true right now?"_; as a **trigger** it fires
_"when this becomes true"_. A few types are restricted to one role (`config` is
trigger-only; the composites and `user` / `user_agent` are condition-only), as
noted at the top of each type below.

For the card-state types (`camera`, `view`, `fullscreen`, `expand`, `call`,
`display_mode`, `media_loaded`, `microphone`, `interaction`, `triggered`) a
trigger's value is **optional**: give it a value to fire only when the state
changes _to_ that value, or **omit it to fire on any change**. (The stock `state`
trigger behaves the same way when `from`/`to` are omitted). As a condition the
value keeps its usual per-type meaning, as described below.

```yaml
# A trigger initiates an automation; conditions are then checked.
triggers:
  - [trigger_1]
conditions:
  - [condition_1]
```

> [!TIP]
> Automation `triggers` are not the same as a camera's
> [`triggers`](cameras/README.md?id=triggers). Automation triggers _initiate
> [automations](automations.md)_; camera triggers take action on per-camera
> events such as motion. They share only the word "trigger".

## Universal fields <!-- {docsify-ignore} -->

Every condition and trigger accepts an optional `enabled` field, mirroring Home
Assistant.

| Parameter | Description                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| `enabled` | `true` (the default) keeps it active; `false`, or a [template](templates.md) that renders falsey, skips it. |

> [!NOTE]
> An `enabled` template can turn a condition or trigger on or off at runtime:
> point it at an `input_boolean` (or any live value) and the change takes effect
> immediately. This is because the card re-evaluates `enabled` every time the
> condition or trigger is checked, rather than once when the automation loads (as
> Home Assistant does).

## `and`

_Condition only._

Evaluates to `true` if _all_ embedded conditions evaluate to `true`. At least one condition is required.

```yaml
conditions:
  - condition: and
    # [...]
```

| Parameter    | Description                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| `condition`  | Must be `and`.                                                                                                 |
| `conditions` | A list of other conditions _all_ of which must evaluate `true` in order for this condition to evaluate `true`. |

## `call`

Matches whether a [two-way audio](../usage/2-way-audio.md) call is in progress.
As a **condition**, true while the call state matches; as a **trigger**, fires
when it becomes a match (e.g. `call: true` fires when a call starts).

```yaml
# As a condition:
conditions:
  - condition: call
    call: true
# As a trigger:
triggers:
  - trigger: call
    call: true
```

| Parameter               | Description                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `condition` / `trigger` | Must be `call`.                                                                                |
| `call`                  | If `true` or `false`, matches when a two-way audio call is or is not in progress respectively. |

## `camera`

Matches the selected camera. As a **condition**, true while the selection
matches; as a **trigger**, fires when the selection changes to a match. Does not
match other cameras (whether visible or not).

```yaml
# As a condition:
conditions:
  - condition: camera
    cameras: [front_door]
# As a trigger:
triggers:
  - trigger: camera
    cameras: [front_door]
```

| Parameter               | Description                                                                                                                                                                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `condition` / `trigger` | Must be `camera`.                                                                                                                                                                                                                                                           |
| `cameras`               | An optional list of camera IDs. **A list** matches one of those cameras; **omitted** matches the presence of any selected camera (as a trigger: any selected camera change); **`[]`** matches when no camera is selected. See the camera [id](cameras/README.md) parameter. |

## `config`

_Trigger only._

Fires when the card configuration changes (e.g. on startup, or when [overrides](./overrides.md) are applied).

```yaml
triggers:
  - trigger: config
    # [...]
```

| Parameter | Description                                                                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trigger` | Must be `config`.                                                                                                                                                    |
| `paths`   | An optional list of configuration paths (e.g. `menu.style`). If provided, fires only when _any_ of those paths changes; otherwise fires on any configuration change. |

## `display_mode`

Matches the card display mode (`single` or `grid`). As a **condition**, true
while in that mode; as a **trigger**, fires when the display mode changes to it.
See the display settings for [`live`](live.md?id=display) or
[`media_viewer`](media-viewer.md?id=display).

```yaml
# As a condition:
conditions:
  - condition: display_mode
    display_mode: single
# As a trigger:
triggers:
  - trigger: display_mode
    display_mode: single
```

| Parameter               | Description                 |
| ----------------------- | --------------------------- |
| `condition` / `trigger` | Must be `display_mode`.     |
| `display_mode`          | Must be `single` or `grid`. |

## `expand`

Matches whether the card is in "expanded" mode (in a dialog/popup). As a
**condition**, true while the mode matches; as a **trigger**, fires when it
becomes a match.

```yaml
# As a condition:
conditions:
  - condition: expand
    expand: true
# As a trigger:
triggers:
  - trigger: expand
    expand: true
```

| Parameter               | Description                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `condition` / `trigger` | Must be `expand`.                                                                                           |
| `expand`                | If `true` or `false`, matches when the card is or is not in expanded mode (in a dialog/popup) respectively. |

## `fullscreen`

Matches whether the card (or media within it) is in fullscreen mode. As a
**condition**, true while the mode matches; as a **trigger**, fires when it
becomes a match.

> [!WARNING]
> When fullscreen is entered via a video player's built-in controls (rather than
> the card's own fullscreen [action](actions/custom/README.md) or menu button),
> the browser fullscreens the video element itself rather than the card. Any
> automation action that replaces that video element (e.g. switching substreams)
> will immediately exit fullscreen. A partial workaround may be to use the
> card's fullscreen action instead. See [Fullscreen with HD substream
> switching](../examples.md?id=fullscreen-with-hd-substream-switching) for an
> approach that combines substream switching with the card's fullscreen.

```yaml
# As a condition:
conditions:
  - condition: fullscreen
    fullscreen: true
# As a trigger, on entering fullscreen:
triggers:
  - trigger: fullscreen
    fullscreen: true
# As a trigger, on any fullscreen change:
triggers:
  - trigger: fullscreen
```

| Parameter               | Description                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `condition` / `trigger` | Must be `fullscreen`.                                                                     |
| `fullscreen`            | If `true` or `false`, matches when the card is or is not in fullscreen mode respectively. |

## `initialized`

Matches whether the card has finished initializing. As a **condition**, true
once the card is initialized; as a **trigger**, fires when the card initializes
(useful for running an [automation](./automations.md) on card start).

```yaml
# As a condition:
conditions:
  - condition: initialized
# As a trigger:
triggers:
  - trigger: initialized
```

| Parameter               | Description            |
| ----------------------- | ---------------------- |
| `condition` / `trigger` | Must be `initialized`. |

## `interaction`

Matches whether the card has recently been interacted with. As a **condition**,
true while the interaction state matches; as a **trigger**, fires when it becomes
a match.

```yaml
# As a condition:
conditions:
  - condition: interaction
    interaction: true
# As a trigger:
triggers:
  - trigger: interaction
    interaction: true
```

| Parameter               | Description                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `condition` / `trigger` | Must be `interaction`.                                                                                                                           |
| `interaction`           | If `true` or `false`, matches when the card has or has not had human interaction within `view.interaction_seconds` elapsed seconds respectively. |

## `key`

Matches a keyboard key. As a **condition**, true while the key matches the given
state; as a **trigger**, fires on the matching key event.

```yaml
# As a condition:
conditions:
  - condition: key
    key: ArrowLeft
# As a trigger:
triggers:
  - trigger: key
    key: ArrowLeft
```

| Parameter               | Default | Description                                                                                                                       |
| ----------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `condition` / `trigger` | -       | Must be `key`.                                                                                                                    |
| `alt`                   | `false` | An optional value to match whether the `alt` key is being held.                                                                   |
| `ctrl`                  | `false` | An optional value to match whether the `ctrl` key is being held.                                                                  |
| `key`                   |         | Any [keyboard key value](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values), e.g. `ArrowLeft`. |
| `meta`                  | `false` | An optional value to match whether the `meta` key is being held.                                                                  |
| `shift`                 | `false` | An optional value to match whether the `shift` key is being held.                                                                 |
| `state`                 | `down`  | An optional value to match the state of the key. Must be one of `down` or `up`.                                                   |

## `media_loaded`

Matches whether the selected live or media stream has loaded. As a **condition**,
true while the load state matches; as a **trigger**, fires when it becomes a
match.

```yaml
# As a condition:
conditions:
  - condition: media_loaded
    media_loaded: true
# As a trigger:
triggers:
  - trigger: media_loaded
    media_loaded: true
```

| Parameter               | Description                                                                                                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `condition` / `trigger` | Must be `media_loaded`.                                                                                                                                                                                                                             |
| `media_loaded`          | If `true` or `false`, matches when there is or is not media load**ED** (not load**ING**) in the card (e.g. a clip, snapshot or live view). This may be used to hide controls during media loading or when a message (not media) is being displayed. |

> [!NOTE]
> Toggling a substream on or off does not cause this condition to transition.
> Substream is treated as a playback-layer detail of the same logical camera, so
> the condition remains satisfied while any stream of the camera continues to
> render.

## `microphone`

Matches the microphone state. As a **condition**, true while the mute state
matches; as a **trigger**, fires when it becomes a match.

```yaml
# As a condition:
conditions:
  - condition: microphone
    muted: true
# As a trigger:
triggers:
  - trigger: microphone
    muted: true
```

| Parameter               | Description                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `condition` / `trigger` | Must be `microphone`.                                                               |
| `muted`                 | If `true` or `false`, matches when the microphone is muted or unmuted respectively. |

## `not`

_Condition only._

Evaluates to `true` if every embedded condition is `false`. At least one
condition is required.

> [!IMPORTANT] > `not` is a **NOR** operation, not a **NAND**. If _any_ sub-condition is `true`,
> the `not` condition evaluates to `false` -- even if other sub-conditions are
> `false`. To pass, _all_ sub-conditions must be `false`. This behavior matches
> the [Home Assistant equivalent](https://www.home-assistant.io/docs/scripts/conditions/#not-condition).

```yaml
conditions:
  - condition: not
    # [...]
```

| Parameter    | Description                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| `condition`  | Must be `not`.                                                                                                  |
| `conditions` | A list of other conditions _none_ of which must evaluate `true` in order for this condition to evaluate `true`. |

## `numeric_state`

Matches a numeric Home Assistant value (an entity's state or attribute, or a
template). As a **condition**, true while the value is within range; as a
**trigger**, fires when the value crosses into range. At least one of `above` /
`below` is required.

```yaml
# As a condition:
conditions:
  - condition: numeric_state
    entity: sensor.office_temperature
    above: 10
    below: 20
# As a trigger:
triggers:
  - trigger: numeric_state
    entity_id: sensor.office_temperature
    above: 10
    below: 20
```

| Parameter               | Description                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `condition` / `trigger` | Must be `numeric_state`.                                                                          |
| `entity` / `entity_id`  | The entity (or list of entities) to read.                                                         |
| `above`                 | Match when the value is above this: a number, or an entity ID whose state supplies the threshold. |
| `below`                 | Match when the value is below this: a number, or an entity ID whose state supplies the threshold. |
| `value_template`        | A template whose rendered numeric value is compared instead of the entity's state.                |
| `attribute`             | Compare this attribute instead of the entity's state.                                             |
| `for`                   | _Trigger only._ A duration (`hh:mm:ss` or a template) the value must stay in range before firing. |

See the [Home Assistant numeric_state condition](https://www.home-assistant.io/docs/scripts/conditions/#numeric-state-condition) and [numeric_state trigger](https://www.home-assistant.io/docs/automation/trigger/#numeric-state-trigger).

## `or`

_Condition only._

Evaluates to `true` if _any_ embedded condition evaluates to `true`. At least one condition is required.

```yaml
conditions:
  - condition: or
    # [...]
```

| Parameter    | Description                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| `condition`  | Must be `or`.                                                                                            |
| `conditions` | A list of conditions _any_ of which must evaluate `true` in order for this condition to evaluate `true`. |

## `screen`

Matches a CSS [media query](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Using).
As a **condition**, true while the query matches; as a **trigger**, fires when
the match changes (e.g. on a change of orientation or viewport size).

```yaml
# As a condition:
conditions:
  - condition: screen
    media_query: '(orientation: landscape)'
# As a trigger:
triggers:
  - trigger: screen
    media_query: '(orientation: landscape)'
```

| Parameter               | Description                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `condition` / `trigger` | Must be `screen`.                                                                                                                                                                                                                                                                                                                                                       |
| `media_query`           | Any valid [media query](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Using) string. Media queries must start and end with parentheses. This may be used to alter card configuration based on device/media properties (e.g. viewport width, orientation). Please note that `width` and `height` refer to the entire viewport not just the card. |

See the [screen conditions examples](../examples.md?id=screen-conditions).

## `state`

Matches a Home Assistant entity's state. Unlike most types, the **condition** and
**trigger** forms take different fields: a condition compares the _current_ value
(requiring `state` or `state_not`), while a trigger matches the _transition_
(`from` / `to`, both optional).

Both forms accept `entity` (or its `entity_id` alias) as a single entity or a
list.

### As a condition

```yaml
conditions:
  - condition: state
    entity: binary_sensor.door
    state: 'on'
```

| Parameter              | Description                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `condition`            | Must be `state`.                                                                                          |
| `entity` / `entity_id` | The entity (or list of entities) to check.                                                                |
| `state`                | A state, or list of states, the entity must match.                                                        |
| `state_not`            | A state, or list of states, the entity must not match.                                                    |
| `match`                | With a list of entities: `all` (the default) requires every entity to match, `any` requires at least one. |
| `for`                  | A duration (`hh:mm:ss` or a template) the match must have held.                                           |
| `attribute`            | Compare this attribute instead of the entity's state.                                                     |

See the [Home Assistant state condition](https://www.home-assistant.io/docs/scripts/conditions/#state-condition).

### As a trigger

```yaml
triggers:
  - trigger: state
    entity_id: binary_sensor.door
    to: 'on'
```

| Parameter              | Description                                                                  |
| ---------------------- | ---------------------------------------------------------------------------- |
| `trigger`              | Must be `state`.                                                             |
| `entity` / `entity_id` | The entity (or list of entities) to watch.                                   |
| `from` / `not_from`    | Match (or exclude) the prior state. A single value, a list, or `null` (any). |
| `to` / `not_to`        | Match (or exclude) the new state. A single value, a list, or `null` (any).   |
| `for`                  | A duration (`hh:mm:ss` or a template) the new state must hold before firing. |
| `attribute`            | Watch this attribute instead of the entity's state.                          |

See the [Home Assistant state trigger](https://www.home-assistant.io/docs/automation/trigger/#state-trigger).

## `template`

Matches a Home Assistant template. As a **condition**, true while the template
renders truthy; as a **trigger**, fires when it changes from non-true to true.

```yaml
# As a condition:
conditions:
  - condition: template
    value_template: "{{ states('switch.office') == 'on' }}"
# As a trigger:
triggers:
  - trigger: template
    value_template: "{{ states('switch.office') == 'on' }}"
```

| Parameter               | Description                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `condition` / `trigger` | Must be `template`.                                                                              |
| `value_template`        | The Home Assistant template to evaluate, e.g. `{{ states('switch.office') == 'on' }}`.           |
| `for`                   | _Trigger only._ A duration (`hh:mm:ss` or a template) the template must stay true before firing. |

See the [Home Assistant template condition](https://www.home-assistant.io/docs/scripts/conditions/#template-condition) and [template trigger](https://www.home-assistant.io/docs/automation/trigger/#template-trigger).

> [!TIP]
> The Advanced Camera Card uses
> [ha-nunjucks](https://github.com/Nerwyn/ha-nunjucks) to process templates.
> Consult its documentation for the wide variety of different template values
> supported.

## `triggered`

Matches the set of cameras currently [triggered](cameras/README.md?id=triggers).
As a **condition**, true while the set matches; as a **trigger**, fires when it
becomes a match.

```yaml
# As a condition:
conditions:
  - condition: triggered
    triggered: [camera.office]
# As a trigger:
triggers:
  - trigger: triggered
    triggered: [camera.office]
```

| Parameter               | Description                                                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `condition` / `trigger` | Must be `triggered`.                                                                                                                                                       |
| `triggered`             | An optional list of camera IDs. Matches when one of them is triggered. **Omit** to match while _any_ camera is triggered; use an empty list `[]` to match while _none_ is. |

## `user`

_Condition only._

Matches the logged-in Home Assistant user. See the [Home Assistant user condition](https://www.home-assistant.io/dashboards/conditional/#user).

```yaml
conditions:
  - condition: user
    users:
      - 581fca7fdc014b8b894519cc531f9a04
```

| Parameter   | Description                                 |
| ----------- | ------------------------------------------- |
| `condition` | Must be `user`.                             |
| `users`     | A list of Home Assistant user IDs to match. |

## `user_agent`

_Condition only._

Matches the [User-Agent](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/User-Agent).

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
| `casting`       | If `true` matches if the card is being cast to a Chromecast / TV device, if `false` matches if the card is _NOT_ being cast.                             |
| `companion`     | If `true` matches if the user-agent is the Home Assistant companion app, if `false` matches if the user-agent is _NOT_ the Home Assistant companion app. |

At least one of these parameters is required. When multiple are specified they
must all match for the condition to match.

See the [user-agent overrides example](../examples.md?id=disable-ptz-controls-in-the-home-assistant-companion-app).

## `view`

Matches the selected view. As a **condition**, true while a matching view is
selected; as a **trigger**, fires when the selected view changes to a matching
one.

```yaml
# As a condition:
conditions:
  - condition: view
    views: [live]
# As a trigger:
triggers:
  - trigger: view
    views: [live]
```

| Parameter               | Description                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `condition` / `trigger` | Must be `view`.                                                                                                                                              |
| `views`                 | A list of [views](view.md?id=supported-views) to match (e.g. `clips`). **Required** as a condition; optional as a trigger (omit to fire on any view change). |

> [!IMPORTANT]
> Internally, views associated with the media viewer (e.g. `clip`, `snapshot`,
> `review`, `recording`) are translated to the `media` view after the relevant
> media is fetched. When naming views in a condition or trigger, you may need to
> refer to the `media` view.

## Unsupported Home Assistant conditions

Home Assistant's `time`, `zone`, `sun` and `location` conditions are **not**
currently supported. If you need one of them, please [open an
issue](https://github.com/dermotduffy/advanced-camera-card/issues).

## Fully expanded reference

[](common/expanded-warning.md ':include')

### Conditions

```yaml
conditions:
  - condition: call
    call: true
  - condition: camera
    cameras:
      - camera.office
  - condition: display_mode
    display_mode: single
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
    state_not: 'off'
  - condition: template
    value_template: "{{ is_state('switch.office', 'on') }}"
  - condition: triggered
    triggered:
      - camera.office
  - condition: user
    users:
      - 581fca7fdc014b8b894519cc531f9a04
  - condition: user_agent
    user_agent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    user_agent_re: 'Chrome/'
    casting: true
    companion: true
  - condition: view
    views:
      - live
```

### Triggers

```yaml
triggers:
  - trigger: call
    call: true
  - trigger: camera
    cameras:
      - camera.office
  - trigger: config
    paths:
      - 'menu.style'
  - trigger: display_mode
    display_mode: single
  - trigger: expand
    expand: true
  - trigger: fullscreen
    fullscreen: true
  - trigger: initialized
  - trigger: interaction
    interaction: true
  - trigger: key
    alt: false
    ctrl: false
    key: F
    meta: false
    shift: false
    state: down
  - trigger: media_loaded
    media_loaded: true
  - trigger: microphone
    muted: true
  - trigger: numeric_state
    entity_id: sensor.office_temperature
    above: 10
    below: 20
    for: '00:00:05'
  - trigger: screen
    media_query: '(orientation: landscape)'
  - trigger: state
    entity_id: climate.office
    from: 'off'
    to: heat
    for: '00:00:05'
  - trigger: template
    value_template: "{{ is_state('switch.office', 'on') }}"
    for: '00:00:05'
  - trigger: triggered
    triggered:
      - camera.office
  - trigger: view
    views:
      - live
```
