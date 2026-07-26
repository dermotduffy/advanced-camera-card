# Examples

## Actions on tap

You can add actions to the card to be trigger on `tap`, `double_tap`, `hold`, `start_tap` or `end_tap`.

In this example double clicking the card in any view will cause the card to go
into fullscreen mode, **except** when the view is `live` in which case the
office lights are toggled.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
view:
  actions:
    double_tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: fullscreen
live:
  actions:
    entity: light.office_main_lights
    double_tap_action:
      action: toggle
```

## Aspect ratios

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
dimensions:
  aspect_ratio_mode: static
  aspect_ratio: '4:3'
```

## Automation

### Responding to fullscreen

This example will automatically turn on the first configured substream when the
card is put in fullscreen mode, and turn off the substream when exiting
fullscreen mode.

> [!WARNING]
> When fullscreen is entered via a video player's built-in controls (rather than
> the card's fullscreen menu button), automation actions that replace _that_ video
> element (e.g. switching substreams from one video to another) will immediately exit fullscreen (as the browser sees the video the user clicked on be destroyed). See the
> [fullscreen condition](configuration/conditions-triggers.md?id=fullscreen) for details.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
    live_provider: image
    dependencies:
      cameras:
        - office_hd
  - camera_entity: camera.office
    title: Office HD
    live_provider: go2rtc
    id: office_hd
    capabilities:
      disable_except:
        - substream
        # Optionally allow media on this substream.
        - clips
        - recordings
        - reviews
        - snapshots
        # Optionally allow PTZ controls on the substream.
        - ptz
automations:
  # Entering fullscreen: turn the substream on.
  - triggers:
      - trigger: fullscreen
        fullscreen: true
    actions:
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: substream_on
  # Exiting fullscreen: turn it off again.
  - triggers:
      - trigger: fullscreen
        fullscreen: false
    actions:
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: substream_off
```

### Fullscreen with display mode and substream switching

This example adds a custom menu button that switches to single display mode,
activates the HD substream, and enters card fullscreen -- all in a single tap.
An automation restores the grid layout and substream when fullscreen is exited.
This is useful in [grid](configuration/live.md) layouts where the card's
standard fullscreen button would show all cameras rather than a single HD
stream.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
    dependencies:
      cameras:
        - office_hd
  - camera_entity: camera.office_hd
    title: Office HD
    id: office_hd
    capabilities:
      disable_except:
        - substream
live:
  display:
    mode: grid
elements:
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:fullscreen
    title: Fullscreen HD
    tap_action:
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: display_mode_select
        display_mode: single
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: substream_on
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: fullscreen
automations:
  - triggers:
      - trigger: fullscreen
        fullscreen: false
    actions:
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: substream_off
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: display_mode_select
        display_mode: grid
```

### Responding to key input

In addition to a handful of reconfigurable [built-in keyboard shortcuts](./usage/keyboard-shortcuts.md), `automations` can be used to take any action based on any keyboard input. These examples use [`key` conditions](./configuration/conditions-triggers.md?id=key) to assess keyboard state before taking action.

#### Change to `live` temporarily

In this example, the view will change to `live`, when `Alt+Z` is pressed, and change to the `clips` view `5` seconds later.

```yaml
automations:
  - triggers:
      - trigger: key
        key: z
        alt: true
    actions:
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: live
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: sleep
        duration:
          s: 5
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: clips
```

#### Change to `live` while key _held_ down

In this example, the view will change to `live`, when `Alt+Z` is _held_ down, and immediately change to `clips` when _released_.

```yaml
automations:
  # Held down: switch to live.
  - triggers:
      - trigger: key
        key: z
        alt: true
        state: down
    actions:
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: live
  # Released: switch back to clips.
  - triggers:
      - trigger: key
        key: z
        alt: true
        state: up
    actions:
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: clips
```

## Cameras

### Frigate camera without a `camera_entity`

In this example, there is no Home Assistant entity linked to the camera, just a `frigate` camera name:

```yaml
type: custom:advanced-camera-card
cameras:
  - frigate:
      camera_name: office
    live_provider: go2rtc
```

### A go2rtc stream without a `camera_entity`

In this example, there is no Home Assistant entity linked to the camera, just a `go2rtc` stream.

```yaml
type: custom:advanced-camera-card
cameras:
  - live_provider: go2rtc
    go2rtc:
      stream: office
      url: https://my.go2rtc.url:1984
```

> [!WARNING]
> Browsers will reject [mixed content](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content): if you access Home Assistant over `https`, you must also put `go2rtc` behind `https` and use that in the `url` parameter. Check [go2rtc proxying](#go2rtc) as an alternative.

## Card Mod

This card allows the use of
[card-mod](https://github.com/thomasloven/lovelace-card-mod) to style arbitrary
card contents.

> [!WARNING]
> Card mod relies on the underlying internal DOM structure to style elements -- as such, while its use is possible, it's not officially supported and zero attempt is made to preserve backwards compatability of the internal DOM between any versions. It may look good, but you're on your own!

This example changes the color and removes the padding around a [Picture
Elements state
label](https://www.home-assistant.io/dashboards/picture-elements/#state-label).

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
card_mod:
  style:
    advanced-camera-card-elements $:
      hui-state-label-element $: |
        div {
          padding: 0px !important;
          color: blue;
        }
```

## Cast a dashboard

This example will configure an Advanced Camera Card that can cast a dashboard view to a media player, which has a second Advanced Camera Card in panel mode with a low-latency live provider.

### Source card

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
    live_provider: image
    cast:
      method: dashboard
      dashboard:
        dashboard_path: cast
        view_path: office
```

### Dashboard configuration

> [!NOTE]
> This dashboard is configured at the path `/cast/` (path referred to in `dashboard_path` above).

```yaml
title: Advanced Camera Card Casting
views:
  - title: Casting
    # This path is referred to in `view_path` above.
    path: office
    # Ensure the video is "maximized" / dashboard in "panel" mode.
    type: panel
    cards:
      - type: custom:advanced-camera-card
        cameras:
          - camera_entity: camera.office
            live_provider: go2rtc
```

## Conditional elements

You can restrict elements to only show for certain
[views](configuration/view.md?id=supported-views) using a
`custom:advanced-camera-card-conditional` element. This example shows a car icon that
calls a service but only in the `live` view.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
elements:
  - type: custom:advanced-camera-card-conditional
    conditions:
      - condition: view
        views:
          - live
    elements:
      - type: icon
        icon: mdi:car
        style:
          background: rgba(255, 255, 255, 0.25)
          border-radius: 5px
          right: 25px
          bottom: 50px
        tap_action:
          action: perform-action
          service: amcrest.ptz_control
          data:
            entity_id: camera.kitchen
            movement: up
```

## Conditional menu icons

You can have icons conditionally added to the menu based on entity state.

### Show a menu icon based on state

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
elements:
  - type: conditional
    conditions:
      - condition: state
        entity: light.office_main_lights
        state: on
    elements:
      - type: custom:advanced-camera-card-menu-state-icon
        entity: light.office
        tap_action:
          action: toggle
```

### Show a menu icon based on camera triggering

This example adds a menu button to optionally activate a siren when the camera is triggered.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
elements:
  - type: custom:advanced-camera-card-conditional
    elements:
      - type: custom:advanced-camera-card-menu-icon
        icon: mdi:alarm-bell
        title: Activate alarm
        style:
          color: red
        tap_action:
          action: perform-action
          perform_action: homeassistant.toggle
          target:
            entity_id: siren.siren
    conditions:
      - condition: triggered
        triggered:
          - camera.office
```

## Doorbell

[felipecrs/dahua-vto-on-home-assistant](https://github.com/felipecrs/dahua-vto-on-home-assistant#readme) provides an example on how this card can be used to answer a doorbell in Home Assistant.

![Doorbell example](images/doorbell-example.gif 'Doorbell example :size=400')

### Inbound call on doorbell press

The [`doorbell` profile](configuration/profiles.md?id=doorbell) turns a dashboard into a phone-like ringer when somebody presses the doorbell, by setting [`view.triggers.actions.trigger: call`](configuration/view.md?id=triggers) and auto-discovering [HA `event.*` entities](https://www.home-assistant.io/integrations/event/#device-class) with `device_class: doorbell` on the camera's device (Ring, UniFi Protect, Nest, DoorBird, Reolink, etc.). The intended deployment is a wall-mounted tablet sitting on the dashboard.

A doorbell press is instantaneous, so the card synthesises a ring window from [`view.triggers.event_hold_seconds`](configuration/view.md?id=triggers) (default `30`s) -- long enough for a typical phone-style answer window. `untrigger_delay_seconds` then lingers past that, same as for any stateful trigger.

`triggers.motion`, `triggers.occupancy`, and `triggers.media_events` are off by default -- only the explicit doorbell press triggers the call, so casual motion won't make the card ring.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.front_door
    # `go2rtc` + `webrtc` is needed for two-way audio.
    live_provider: go2rtc
    go2rtc:
      modes:
        - webrtc
profiles:
  - doorbell
```

> [!TIP]
> If your doorbell exposes a `binary_sensor.*` or `switch.*` instead of an `event.*` entity, list it under [`triggers.entities`](configuration/cameras/README.md?id=triggers) on the camera manually. Auto-discovery only covers `event.*` based doorbell entities.

#### With a Zigbee (ZHA / deCONZ) doorbell button

Zigbee buttons connected via ZHA or deCONZ typically don't expose a per-device entity -- they fire raw HA bus events (`zha_event`, `deconz_event`) shared across every Zigbee device on the integration. The `doorbell` profile's auto-discovery doesn't cover this case; reuse the profile (it still wires up `trigger: call` / `untrigger: call` and the ring window) but opt out of auto-discovery per camera and add [`triggers.events`](configuration/cameras/README.md?id=events) with an `event_data` filter to pick out the right device.

You can copy the exact `device_ieee` (ZHA) or `id` (deCONZ) and command values straight out of **Developer tools → Events** in Home Assistant -- listen to the event type, press the doorbell, and use whatever appears in the `data` payload.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.front_door
    live_provider: go2rtc
    go2rtc:
      modes:
        - webrtc
    triggers:
      # Opt out of the profile's `event.*` auto-discovery -- this camera
      # uses an HA bus event instead.
      doorbell: false
      events:
        - event_type: zha_event
          event_data:
            device_ieee: '00:11:22:33:44:55:66:77'
            command: press
profiles:
  - doorbell
```

### Alerting the rest of the house

A wall tablet only helps whoever is standing in front of it. This example uses
the [`call` trigger](configuration/conditions-triggers.md?id=call) to drive an
`input_boolean` that a normal Home Assistant automation can watch, so the rest of
the house "rings" too -- and, crucially, **stops** ringing the moment somebody deals
with the caller.

The card knows things Home Assistant cannot see on its own: whether anyone
actually picked the call up, and whether it was answered or dismissed. Each
phase change gets its own automation.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.front_door
    live_provider: go2rtc
    go2rtc:
      modes:
        - webrtc
profiles:
  - doorbell
automations:
  # It started ringing: ring the rest of the house and light the porch so the
  # visitor is actually visible on camera.
  - triggers:
      - trigger: call
        to: ringing
    actions:
      - action: perform-action
        perform_action: input_boolean.turn_on
        target:
          entity_id: input_boolean.doorbell_ringing
      - action: perform-action
        perform_action: light.turn_on
        target:
          entity_id: light.porch

  # Somebody answered on the tablet: silence every other device immediately.
  # `from: ringing` keeps this from firing when *you* start an outbound call.
  - triggers:
      - trigger: call
        from: ringing
        to: answered
    actions:
      - action: perform-action
        perform_action: input_boolean.turn_off
        target:
          entity_id: input_boolean.doorbell_ringing

  # Nobody picked up, or somebody rejected it: stop ringing, and announce that
  # a visitor was missed.
  - triggers:
      - trigger: call
        from: ringing
        to: idle
    actions:
      - action: perform-action
        perform_action: input_boolean.turn_off
        target:
          entity_id: input_boolean.doorbell_ringing
      - action: perform-action
        perform_action: notify.mobile_app_phone
        data:
          message: Somebody was at the front door and nobody answered.

  # The conversation ended. Only fires for calls that were actually answered,
  # so an unanswered ring never turns the porch light off early.
  - triggers:
      - trigger: call
        from: answered
        to: idle
    actions:
      - action: perform-action
        perform_action: light.turn_off
        target:
          entity_id: light.porch
```

### Doorbells that stop ringing when two-way audio connects

> [!WARNING]
> This example is only relevant to those doorbells with a design flaw
> that prevents the doorbell being rung whilst a 2-way channel is enabled. This
> means simply watching the stream, when you might _in future_ hold a 2-way
> conversation on that stream, can disable the actual whole point of a doorbell --
> to ring!

The fix is to split the camera:

- A plain, view-only stream you normally watch (with **no** backchannel)
- A second camera carrying the two-way stream, listed as a
  [dependency](configuration/cameras/README.md?id=dependencies) of the first
  camera. The card only engages the two-way stream -- and therefore the
  backchannel -- when you start a call, and automatically drops it again on
  hang-up. The doorbell keeps ringing until you actually choose to answer.

```yaml
type: custom:advanced-camera-card
cameras:
  # The camera you normally watch: a view-only stream you have configured to
  # not have a backchannel, so opening the card does not disturb the doorbell.
  - camera_entity: camera.front_doorbell
    id: doorbell
    live_provider: go2rtc
    go2rtc:
      modes: [webrtc]
      # Stream with NO backchannel source
      stream: front_doorbell
    dependencies:
      # The two-way dependent camera (below) only used during a call
      cameras: [doorbell_2way]
  # The two-way camera. Never watched on its own: the call button engages it as
  # a substream for the duration of a call, then drops it on hang-up.
  - camera_entity: camera.front_doorbell
    id: doorbell_2way
    live_provider: go2rtc
    go2rtc:
      modes: [webrtc]
      # The two-way go2rtc stream (carries the backchannel)
      stream: front_doorbell_2way
    capabilities:
      # This camera exists only to supply the call's two-way audio. Disabling
      # everything except `2-way-audio` keeps it out of the camera menu and the
      # substream selector, while still letting the call button target it.
      disable_except:
        - 2-way-audio
profiles:
  - doorbell
```

> [!IMPORTANT]
> This only works if the _view-only_ stream genuinely has no backchannel source
> in your `go2rtc` config -- otherwise `go2rtc` may still take over the doorbell
> the moment that stream is opened. Test the view-only camera on its own first:
> if the doorbell stops ringing with just that camera configured, that stream is
> the culprit. If you can't produce a clean one-way `go2rtc` stream, try setting
> the view-only camera to `live_provider: ha` (HLS / receive-only WebRTC, which
> never offers a backchannel) instead.

### Driving calls from the menu

By default on-screen controls will appear mid-card to handle a call. Setting
[`live.controls.call.enabled: false`](configuration/live.md?id=call) hides those
controls so the call can be driven via some other mechanism. In this example,
the card is configured to allow calls to be driven from the menu instead.

This wires up the menu equivalents of every overlay control. The menu `call`
button starts, ends, and (while ringing) rejects calls, but it cannot _answer_
an inbound ring -- so a conditional answer button is added that appears only
while ringing.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.front_door
    live_provider: go2rtc
    go2rtc:
      modes:
        - webrtc
profiles:
  - doorbell
live:
  controls:
    call:
      # Hide the on-screen call controls overlay -- the menu drives the call.
      enabled: false
menu:
  # The menu hides during a call by default; keep it visible so its call
  # controls stay reachable.
  auto_hide: []
  buttons:
    # Starts a call, and becomes a hang-up button for the duration of a call.
    call:
      enabled: true
    # Mutes/unmutes your outbound microphone during a call.
    microphone:
      enabled: true
      type: toggle
    # Mutes/unmutes the inbound (caller's) audio during a call.
    mute:
      enabled: true
elements:
  # The menu `call` button cannot answer an inbound (ringing) call, so this
  # answer button is shown only while ringing to provide that control.
  - type: custom:advanced-camera-card-conditional
    conditions:
      - condition: call
        call: ringing
    elements:
      - type: custom:advanced-camera-card-menu-icon
        icon: mdi:phone
        title: Answer call
        tap_action:
          action: custom:advanced-camera-card-action
          advanced_camera_card_action: call_answer
```

## Events from other cameras

`dependencies.cameras` allows events/recordings for other cameras to be shown
along with the currently selected camera. For example, this can be used to show
events with the `birdseye` camera (since it will not have events of its own).

### Using dependent cameras with birdseye

This example shows events for two other cameras when `birdseye` is selected.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
  - camera_entity: camera.kitchen
  - frigate:
      camera_name: birdseye
    dependencies:
      cameras:
        - camera.office
        - camera.kitchen
```

### Using dependent cameras with birdseye for all cameras

This example shows events for _all_ other cameras when `birdseye` is selected.
This is just a shortcut for naming all other cameras.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.kitchen
  - camera_entity: camera.sitting_room
  - frigate:
      camera_name: birdseye
    dependencies:
      all_cameras: true
```

## Folders

These examples create folders that can be viewed in the
[`media_gallery`](./configuration/media-gallery.md).

> [!TIP]
> Having difficulty configuring your folders? Consult the [Worked
> Examples](./configuration/folders.md?id=worked-examples) in the [`folders`
> documentation](./configuration/folders.md?id=worked-examples).

### Home Assistant default root

This example creates a folder at the Home Assistant media root.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
folders:
  - type: ha
```

### Folder within the Home Assistant default root

This example applies a title match against the Home Assistant media root folder
looking for a folder entitled `Frigate`, and shows all items within it (since no
matcher is specified at the lowest level).

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
folders:
  - type: ha
    ha:
      path:
        - matchers:
            - type: title
              title: 'Frigate'
        - {}
```

### Folder date parsing and matching

This example parses dates from a folder, and matches only those dates in the
last two days. It then parses times from the media items themselves.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
folders:
  - type: ha
    ha:
      url: >-
        https://my-ha-instance.local/media-browser/browser/app%2Cmedia-source%3A%2F%2Freolink/playlist%2Cmedia-source%3A%2F%2Freolink%2FCAM%7C01J8XHYTNH77WE3C654K03KX1F%7C0
      path:
        # Matches against the "Low resolution" folder.
        - matchers:
            - type: title
              regexp: (?<value>.*) resolution
              title: Low
        # Parses the date out of the next level (auto-detected format).
        - parsers:
            - type: date
          matchers:
            - type: date
              since:
                days: 2
        # Parses the time out of the items themselves (user-specified format).
        - parsers:
            - type: date
              format: 'HH:mm:ss'
```

#### Folder date matching by `template`

This example dynamically includes media from two subfolders, one for today and
one for yesterday both in `%Y/%-m/%d`
[format](https://www.man7.org/linux/man-pages/man3/strftime.3.html).
[Templating](https://www.home-assistant.io/docs/configuration/templating/#time)
is used to dynamically refer to "today" and "yesterday".

> [!TIP]
> Using a `date` matcher (as above) should be preferred for matching dates, this
> example is included for illustration.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
folders:
  - type: ha
    ha:
      url: https://my-ha-instance.local/media-browser/browser/app%2Cmedia-source%3A%2F%2Freolink/playlist%2Cmedia-source%3A%2F%2Freolink%2FCAM%7C01J8XAATNH77WE5D654K07KY1F%7C0
      path:
        - matchers:
            - type: title
              title: 'Low resolution'
        - matchers:
            - type: or
              matchers:
                - type: template
                  value_template: "{{ acc.media.title == now().strftime('%Y/%-m/%d') }}"
                - type: template
                  value_template: "{{ acc.media.title == (now() - dt.timedelta(days=1)) | timestamp_custom('%Y/%-m/%d') }}"
        - {}
```

### Folder Paths

This example starts with the `media-source://frigate` folder, and looks for a
precisely titled `Clips [my-instance]` folder within that. The resulting media
will be the contents of that folder (if found).

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
folders:
  - type: ha
    ha:
      path:
        - id: 'media-source://frigate'
        - title: 'Clips [my-instance]'
```

### Folder URLs

This example uses the `url` parameter to establish the root of the query. Within
that folder, it looks for a sub-folder that matches the regular expression
`Clips.*`, and within that looks for a folder that matches the regular
expression `Person.*`. The resulting media will be the contents of that folder
(if found).

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
folders:
  - type: ha
    ha:
      url: https://my-ha-instance.local/media-browser/browser/app%2Cmedia-source%3A%2F%2Ffrigate
      path:
        - matchers:
            - type: title
              regexp: 'Clips.*'
        - matchers:
            - type: title
              regexp: 'Person.*'
```

### Show a folder as a camera's default media

By default a camera shows its own events / recordings. Setting [`media.type:
folder`](./configuration/cameras/README.md?id=media) instead makes a configured
folder the camera's default media, so its contents drive the timeline and
gallery. This is useful when the camera's interesting media (e.g. detection
clips) only lives in a Home Assistant media folder rather than being exposed as
native events.

The camera references the folder by its `id`. Parsing a `startdate` from each
item lets the timeline place the media in time.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.reolink_doorbell
    media:
      type: folder
      folders:
        - reolink-detections
folders:
  - id: reolink-detections
    type: ha
    ha:
      # Open HA -> Media, navigate into the desired folder and copy its URL here.
      url: https://my-ha-instance.local/media-browser/browser/app%2Cmedia-source%3A%2F%2Freolink/playlist%2Cmedia-source%3A%2F%2Freolink%2FCAM%7C01J8XAATNH77WE5D654K07KY1F%7C0
      path:
        # Match every item in the folder and parse its start time.
        - parsers:
            - type: startdate
```

### Show only matching items as a camera's default media

The card can only point at folders the Home Assistant Media browser actually
exposes. If your integration surfaces a single flat list of recordings rather
than a dedicated folder per event type, you can add a [`title`
matcher](./configuration/folders.md?id=matchers) to keep only the items you care
about (in this example clips whose title mentions `Person` or `Vehicle`).

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.reolink_doorbell
    media:
      type: folder
      folders:
        - reolink-detections
folders:
  - id: reolink-detections
    type: ha
    ha:
      url: https://my-ha-instance.local/media-browser/browser/app%2Cmedia-source%3A%2F%2Freolink/playlist%2Cmedia-source%3A%2F%2Freolink%2FCAM%7C01J8XAATNH77WE5D654K07KY1F%7C0
      path:
        - matchers:
            # Keep only clips whose title mentions a person or vehicle detection.
            - type: title
              regexp: Person|Vehicle
          parsers:
            - type: startdate
```

## `go2rtc`

This example will use a custom `go2rtc` server, automatically proxying the video
stream via the Home Assistant process if
[hass-web-proxy-integration](https://github.com/dermotduffy/hass-web-proxy-integration)
is detected. See [proxying](./configuration/cameras/README.md?id=proxy).

```yaml
type: custom:advanced-camera-card
cameras:
  - live_provider: go2rtc
    go2rtc:
      stream: office
      # This would normally risk mixed content issues with browsers (accessing
      # `http` content over a `https` connection to Home Assistant is often
      # forbidden by browsers). In this scenario, since hass-web-proxy-integration
      # has been installed separately by the user, the video will be automatically
      # proxied.
      url: http://my-go2rtc:1984
```

> [!WARNING]
> You may need to set `api.origin: '*'` in your go2rtc configuration.

## Human interaction

This example will automatically use a HD live substream when
the mouse cursor interacts with the card.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
    live_provider: image
    dependencies:
      cameras:
        - camera.office_hd
  - camera_entity: camera.office_hd
    live_provider: go2rtc
    capabilities:
      disable_except:
        - substream
        # Also allow PTZ controls on the substream.
        - ptz
automations:
  # On interaction: turn the HD substream on.
  - triggers:
      - trigger: interaction
        interaction: true
    actions:
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: substream_on
  # Once the interaction lapses: turn it off again.
  - triggers:
      - trigger: interaction
        interaction: false
    actions:
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: substream_off
```

## Media layout

These examples change how the media fits and is positioned within the card dimensions.

### Stretch a camera into a 4:4 square

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.landing
    dimensions:
      aspect_ratio: '4:4'
      layout:
        fit: fill
```

### Convert a landscape camera to a portrait live view

Take the left-hand side (position with x == `0`) and use that as the basis of a `9:16` (i.e. portrait) live view.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
    dimensions:
      aspect_ratio: '9:16'
      layout:
        fit: cover
        position:
          x: 0
```

## Menu alignment

This example moves the fullscreen button into its own group aligned to the
`left`, enables the `image` button and orders it furthest to the `right`.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
menu:
  alignment: right
  buttons:
    image:
      enabled: true
      priority: 100
    fullscreen:
      alignment: opposing
```

## Menu icons

You can add custom icons to the menu with arbitrary actions. This example adds
an icon that navigates the browser to the releases page for this card:

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
elements:
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:book
    tap_action:
      action: url
      url_path: https://github.com/dermotduffy/advanced-camera-card/releases
```

## Menu state icons

You can add custom state icons to the menu to show the state of an entity and
complete arbitrary actions. This example adds an icon that represents the state
of the `light.office_main_lights` entity, that toggles the light on double
click.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
elements:
  - type: custom:advanced-camera-card-menu-state-icon
    entity: light.office_main_lights
    tap_action:
      action: toggle
```

## Multiple actions

This example shows how to configure multiple actions for a single Advanced Camera Card user interaction, in this case both selecting a different camera and changing the view on `tap`. Note that multiple actions are not supported on stock Picture Elements, see [actions](configuration/actions/README.md) for more information.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
elements:
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:chair-rolling
    tap_action:
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: camera_select
        camera: camera.office
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: live
```

## Multiple providers

Cameras can be repeated with different providers (note the required use of `id`
to provide a separate unambiguous way of referring to that camera, since the
`camera_entity` is shared between the two cameras).

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
    live_provider: jsmpeg
    title: Office (JSMPEG)
  - camera_entity: camera.office
    live_provider: webrtc-card
    title: Office (WebRTC)
    id: office-webrtc
```

## Notifications

Show a notification with controls that respond to different interactions. In
this example, tapping the control navigates to the `clips` (media gallery) view
and double-tapping navigates to the `clip` (media player) view.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
elements:
  - type: custom:advanced-camera-card-menu-icon
    icon: mdi:bell
    title: Show notification
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: notification
      notification:
        heading:
          text: Motion detected
          icon: mdi:motion-sensor
          severity: medium
        text: Motion was detected in the office.
        controls:
          - icon: mdi:filmstrip
            tooltip: View clips (tap) / clip (double-tap)
            actions:
              tap_action:
                action: custom:advanced-camera-card-action
                advanced_camera_card_action: clips
              double_tap_action:
                action: custom:advanced-camera-card-action
                advanced_camera_card_action: clip
            dismiss: false
```

## Overriding configuration

You can override card configuration when certain [conditions](configuration/conditions-triggers.md) are met.

### Change menu position based on HA state

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
overrides:
  - conditions:
      - condition: state
        entity: light.office_main_lights
        state: 'on'
    merge:
      menu:
        position: bottom
```

### Change default view based on HA state

This example changes the default card view from `live` to `image` depending on
the value of the `binary_sensor.alarm_armed` sensor. The override alone will
only change the _default_ when the card next is requested to change to the
default view. By also including the `view.default_reset.entities` parameter, we
ask the card to trigger a card update based on that entity -- which causes it to
use the new overriden default immediately.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
view:
  default: live
  default_reset:
    entities:
      - binary_sensor.alarm_armed
overrides:
  - conditions:
      - condition: state
        entity: binary_sensor.alarm_armed
        state: 'off'
    merge:
      view:
        default: image
```

### Change grid behavior in full screen

This example will always render 5 columns in fullscreen mode in both the live
and media viewer views, and will not enlarge the selected item. The [normal auto-layout behavior](configuration/grid-layout-algorithm.md) will be used outside of fullscreen mode.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
overrides:
  - conditions:
      - condition: fullscreen
        fullscreen: true
      - condition: display_mode
        display_mode: grid
    merge:
      live:
        display:
          grid_columns: 5
          grid_selected_width_factor: 1
      media_viewer:
        display:
          grid_columns: 5
          grid_selected_width_factor: 1
```

### Change menu style when expanded

This example changes the menu style to `overlay` in expanded mode in order to
take advantage of the extra horizontal space of the dialog/popup.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
menu:
  style: hidden
overrides:
  - conditions:
      - condition: expand
        expand: true
    merge:
      menu:
        style: overlay
```

### Hide menu in fullscreen

This example disables the menu unless the card is in fullscreen mode, and uses a
card-wide action to enable fullscreen mode on `double_tap`.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
view:
  actions:
    double_tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: fullscreen
overrides:
  - conditions:
      - condition: fullscreen
        fullscreen: true
    merge:
      menu:
        style: none
```

### Remove a camera when an entity state changes

This example removes a camera from the card when an entity is disabled (e.g. a switch controlling power to the camera).

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
  - camera_entity: camera.kitchen
overrides:
  - conditions:
      - condition: state
        entity: switch.kitchen_camera_power
        state: off
    delete:
      - 'cameras[1]'
```

### Disable PTZ controls in the Home Assistant Companion App

This example disables the PTZ controls when the card is viewed on the Companion app:

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
overrides:
  - conditions:
      - condition: user_agent
        companion: true
    set:
      live.controls.ptz.mode: 'off'
```

## PTZ control

The card supports using PTZ controls to conveniently control pan, tilt and zoom
for cameras. If you're using a Frigate camera, and Frigate itself shows PTZ
controls, this should work straight out of the box without any extra
configuration:

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
```

If you're using a non-Frigate camera, or Frigate itself does not support the PTZ
controls on your camera but Home Assistant does, you can still manually
configure actions for the card to perform for each PTZ control:

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
    ptz:
      actions_left:
        action: perform-action
        perform_action: homeassistant.toggle
        target:
          entity_id: switch.camera_move_left
```

See the full [Camera PTZ Configuration](./configuration/live.md?id=ptz) for more information.

## `screen` conditions

These examples show altering the card configuration based on device or viewport properties.

### Change menu position when orientation changes

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
  - camera_entity: camera.kitchen
menu:
  style: overlay
overrides:
  - conditions:
      - condition: screen
        media_query: '(orientation: landscape)'
    merge:
      menu:
        position: left
```

### Hide menu & controls when viewport width &lt;= 300 (e.g. PIP mode)

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
  - camera_entity: camera.kitchen
overrides:
  - conditions:
      - condition: screen
        media_query: '(max-width: 300px)'
    merge:
      menu:
        style: none
      live:
        controls:
          next_previous:
            style: none
          thumbnails:
            mode: none
```

## State Badges

You can add a state badge to the card showing arbitrary entity states. This
example adds a state badge showing the temperature and hides the label text:

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
elements:
  - type: state-badge
    entity: sensor.office_temperature
    style:
      right: '-20px'
      top: 100px
      color: rgba(0,0,0,0)
      opacity: 0.5
```

![Picture elements temperature example](images/picture-elements-temperature.png 'Picture elements temperature example :size=400')

## Static images

This example fetches a static image every 10 seconds (in this case the latest image saved on the Frigate server for a given camera).

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
view:
  default: image
image:
  src: https://my-friage-server/api/living_room/latest.jpg
  refresh_seconds: 10
```

## Status bar

### Disable status bar

This example disables the status bar.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
status_bar:
  style: none
```

### Dynamic status bar contents

This example shows an icon and a message on the status bar when a camera is triggered, replacing the existing contents of the status bar through the use of `exclusive`.

![Dynamic Status Messages](images/dynamic-status.gif 'Dynamic Status Messages :size=400')

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
automations:
  # Camera triggered: show the alert.
  - triggers:
      - trigger: triggered
        triggered:
          - camera.office
    actions:
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: status_bar
        status_bar_action: add
        items:
          - type: custom:advanced-camera-card-status-bar-icon
            icon: mdi:alarm-light
            exclusive: true
          - type: custom:advanced-camera-card-status-bar-string
            string: Intruder detected!
            expand: true
            exclusive: true
            sufficient: true
  # No longer triggered: reset the status bar.
  - triggers:
      - trigger: triggered
        triggered: []
    actions:
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: status_bar
        status_bar_action: reset
```

## Submenus

You can add submenus to the menu -- buttons that when pressed reveal a dropdown submenu of configurable options.

### Basic submenu

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
elements:
  - type: custom:advanced-camera-card-menu-submenu
    icon: mdi:menu
    items:
      - title: Lights
        icon: mdi:lightbulb
        entity: light.office_main_lights
        tap_action:
          action: toggle
      - title: Google
        icon: mdi:google
        tap_action:
          action: url
          url_path: https://www.google.com
      - title: Fullscreen
        icon: mdi:fullscreen
        tap_action:
          action: custom:advanced-camera-card-action
          advanced_camera_card_action: fullscreen
```

### Conditional submenu

This example shows submenus conditional on the camera selected.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
elements:
  - type: custom:advanced-camera-card-conditional
    conditions:
      - condition: camera
        cameras:
          - camera.office
    elements:
      - type: custom:advanced-camera-card-menu-submenu
        icon: mdi:door
        items:
          - title: Office Lights
            icon: mdi:lightbulb
            entity: light.office_main_lights
            tap_action:
              action: toggle
  - type: custom:advanced-camera-card-conditional
    conditions:
      - condition: camera
        cameras:
          - camera.kitchen
    elements:
      - type: custom:advanced-camera-card-menu-submenu
        icon: mdi:sofa
        items:
          - title: Kitchen Lights
            icon: mdi:lightbulb
            entity: light.kitchen_lights
            tap_action:
              action: toggle
          - title: Kitchen Lamp
            icon: mdi:lightbulb
            entity: light.kitchen_lamp
            tap_action:
              action: toggle
```

### `select` submenu

You can easily add a submenu to the menu based on a `select` or `input_select` entity. This example imagines the user has an `input_select` entity configured in their Home Assistant configuration like so:

```yaml
input_select:
  office_scene:
    name: Office Scene Select
    options:
      - scene.office_quiet_scene
      - scene.office_party_scene
    icon: mdi:lightbulb
```

The following will convert this entity into a submenu:

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
elements:
  - type: custom:advanced-camera-card-menu-submenu-select
    entity: input_select.office_scene
```

To override 1 or more individual options (e.g. to set custom icons and titles)

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
elements:
  - type: custom:advanced-camera-card-menu-submenu-select
    icon: mdi:lamps
    entity: input_select.office_scene
    options:
      scene.office_quiet_scene:
        icon: mdi:volume-off
        title: Ssssssh
      scene.office_party_scene:
        icon: mdi:party-popper
        title: Party!
```

## Substreams

The card supports configuring 'substreams' (alternative live views) a given
camera through the use of [camera dependencies](configuration/cameras/README.md?id=dependencies).

This example shows two substreams for a single live camera, and uses the 'HD' icon.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
    live_provider: image
    dependencies:
      cameras:
        - office_hd
  - camera_entity: camera.office
    title: Office HD
    live_provider: go2rtc
    id: office_hd
    capabilities:
      disable_except:
        # This camera serves only as a substream.
        - substream
        # Also allow PTZ controls on the substream.
        - ptz
menu:
  buttons:
    substreams:
      icon: mdi:high-definition
```

## Templates in actions

### Accessing Home Assistant state

Perhaps the most common usage of templates is to access Home Assistant state
values. In the below example a fictitious service `homeassistant.service` is
called with data that refers to the current state of the `light.sunroom_ceiling`
entity.

```yaml
tap_action:
  action: perform-action
  perform_action: homeassistant.service
  data:
    key: '{{ hass.states["light.sunroom_ceiling"].state }}'
```

See [Stock Templates](./configuration/templates.md?id=stock-templates).

### Accessing Advanced Camera Card state

In this example, the currently selected camera and
[view](./configuration/view.md) are passed as data to a fictitious service
`homeassistant.service`.

```yaml
tap_action:
  action: perform-action
  perform_action: homeassistant.service
  data:
    camera: '{{ acc.camera }}'
    view: '{{ acc.view }}'
```

See [Custom Templates](./configuration/templates.md?id=custom-templates).

### Accessing Trigger state

In this example, an [automation](./configuration/automations.md) is triggered,
and values associated with the triggering are included in the action.

```yaml
automations:
  - triggers:
      - trigger: camera
    actions:
      - action: perform-action
        perform_action: homeassistant.service
        data:
          from_camera: '{{ trigger.from_acc.camera }}'
          to_camera: '{{ trigger.to_acc.camera }}'
```

See [Trigger Templates](./configuration/templates.md?id=triggers).

## Theme

### Custom border radius

This example shows how to customize the border radius for both the card and buttons to create a cohesive squared-off look:

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
view:
  theme:
    overrides:
      # Set a custom border radius for the card
      '--advanced-camera-card-border-radius': '12px'

      # Match the button border radius to complement the card
      '--advanced-camera-card-button-border-radius': '12px'
```

## Trigger actions

You can control the card itself with the `custom:advanced-camera-card-action` action.
This example shows an icon that toggles the card fullscreen mode.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
elements:
  - type: icon
    icon: mdi:fullscreen
    style:
      left: 40px
      top: 40px
    tap_action:
      action: custom:advanced-camera-card-action
      advanced_camera_card_action: fullscreen
```

## Trigger fullscreen

The card cannot automatically natively trigger fullscreen mode without the user
clicking, since Javascript (understandbly) prevents random websites from
triggering fullscreen mode without the user having activated it.

This example uses
[hass-browser_mod](https://github.com/thomasloven/hass-browser_mod) with an
automation to trigger a popup. Thanks to
[conorlap@](https://github.com/conorlap) for the following example:

```yaml
alias: >-
  Doorbell Pressed OR Human Detected - Firefox browser full screen video feed
  for 15 seconds
description: ''
trigger:
  - platform: state
    from: 'off'
    to: 'on'
    entity_id:
      - binary_sensor.frontdoor_person_occupancy
  - platform: state
    entity_id:
      - binary_sensor.front_door_dahua_button_pressed
    to: 'on'
condition: []
action:
  - service: browser_mod.popup
    data:
      size: wide
      timeout: 15000
      content:
        type: custom:advanced-camera-card
        aspect_ratio: 55%
        cameras:
          - camera_entity: camera.frontdoor
            live_provider: ha
        menu:
          style: none
        live:
          controls:
            title:
              mode: none
    target:
      device_id:
        - d0e93101edfg44y3yt35y5y45y54y
mode: single
```

## Trigger `live`

This example will change to `live` when a camera is triggered, using different
trigger conditions per camera. It will change back to the `default` view when
untriggered.

```yaml
type: custom:advanced-camera-card
cameras:
  # This is a Frigate camera which will automatically
  # be triggered when events occur.
  - camera_entity: camera.office
  # This is a Frigate camera which will only be triggered
  # by motion entity changes or a door being opened.
  - camera_entity: camera.kitchen
    triggers:
      occupancy: false
      motion: true
      entities:
        - binary_sensor.kitchen_door_opened
      media_events: []
view:
  triggers:
    show_trigger_status: true
    filter_selected_camera: false
    actions:
      trigger: live
      untrigger: default
```

## Video control from menu

Disable the stock video controls and add menu button equivalents.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
live:
  controls:
    builtin: false
media_viewer:
  controls:
    builtin: false
menu:
  buttons:
    play:
      enabled: true
    mute:
      enabled: true
```

## URL actions

The card can respond to actions in the query string. See [URL Actions](usage/url-actions.md).

> [!NOTE]
> These examples assume the dashboard URL is `https://ha.mydomain.org/lovelace-test/0` .

### Choosing `clips` view on a named card

This example assumes that one card (of potentially multiple Advanced Camera Cards on the dashboard) is configured with a `card_id` parameter:

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
card_id: main
```

```text
https://ha.mydomain.org/lovelace-test/0?advanced-camera-card-action.main.clips
```

### Choosing the camera from a separate picture elements card

In this example, the card will select a given camera when the user navigates from a _separate_ Picture Elements card:

Advanced Camera Card configuration:

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
  - camera_entity: camera.kitchen
```

Picture Elements configuration:

```yaml
type: picture-elements
image: https://demo.home-assistant.io/stub_config/floorplan.png
elements:
  - type: icon
    icon: mdi:cctv
    style:
      top: 22%
      left: 30%
    tap_action:
      action: navigate
      navigation_path: /lovelace-test/0?advanced-camera-card-action.camera_select=camera.office
  - type: icon
    icon: mdi:cctv
    style:
      top: 71%
      left: 42%
    tap_action:
      action: navigate
      navigation_path: /lovelace-test/0?advanced-camera-card-action.camera_select=camera.kitchen
```

![Taking card actions via the URL](images/navigate-picture-elements.gif 'Taking card actions via the URL :size=400')

### Selecting a camera in expanded mode via query string

```text
https://ha.mydomain.org/lovelace-test/0?advanced-camera-card-action.camera_select=kitchen&advanced_camera_card_action-action.expand
```

## WebRTC Card configuration

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
    live_provider: webrtc-card
    webrtc_card:
      ui: true
```

## Zoom

### Pre-defining camera zoom and pan

This example changes the default [zoom/pan settings for a camera](./configuration/cameras/README.md?id=layout-configuration) to always zoom in on a given area:

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
    dimensions:
      layout:
        zoom: 3
        pan:
          x: 20
          y: 80
```

### Disable zooming in media views

This example prevents zooming on the media viewer but keeps it on in other views (e.g. `live` view):

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
    dimensions:
      layout:
        zoom: 3
        pan:
          x: 20
          y: 80
media_viewer:
  zoomable: false
```

### Different zoom settings in media viewer vs `live`

This example uses different settings for the media viewer and `live` view, by overriding the camera configuration:

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
    dimensions:
      layout:
        zoom: 2
overrides:
  - conditions:
      - condition: view
        views:
          - media
    set:
      'cameras[0].dimensions.layout':
        zoom: 3
        pan:
          x: 100
          y: 100
```

### Automatically zoom based on state

This example automatically zooms in and out based on the state of an entity:

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.living_room
    live_provider: go2rtc
debug:
  logging: true
automations:
  # Door opens: zoom in.
  - triggers:
      - trigger: state
        entity_id: binary_sensor.door_contact
        to: 'on'
    actions:
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: ptz_digital
        target_id: camera.living_room
        absolute:
          zoom: 4
          pan:
            x: 38
            y: 20
  # Door closes: zoom back out.
  - triggers:
      - trigger: state
        entity_id: binary_sensor.door_contact
        to: 'off'
    actions:
      - action: custom:advanced-camera-card-action
        advanced_camera_card_action: ptz_digital
        target_id: camera.living_room
```

![Zoom automation example](images/zoom-automation.gif 'Zoom automation example :size=400')
