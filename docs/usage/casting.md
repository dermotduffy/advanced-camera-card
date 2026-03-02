# Casting

This card allows casting a camera stream to a Google Cast device. You can enable the cast button with:

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
    live_provider: go2rtc
menu:
  media_player:
    enabled: true
```

Clicking this button will allow you to choose a Google Cast device to cast the camera stream to, or the clip that is currently playing.

There are two different casting methods for cameras: `standard` and `dashboard` (see below).

## Standard Casting

This is the default casting method.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
    live_provider: go2rtc
    cast:
      method: standard
menu:
  media_player:
    enabled: true
```

This will send the camera stream to the Google Cast device through the use of the [`media_player.play_media` Home Assistant action](https://www.home-assistant.io/integrations/media_source/#playing-media-from-a-media-source).

The main disadvantage of this method is that the stream will be played through HLS which has a **delay of around 10 seconds**, making it sub-optimal for live monitoring.

## Dashboard Casting

This method is powered by [Home Assistant Cast](https://cast.home-assistant.io) and requires additional configuration, but allows **low latency streaming** with go2rtc.

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
    live_provider: go2rtc
    cast:
      method: dashboard
      dashboard:
        dashboard_path: dashboard-cast
        view_path: office
```

When the cast button is clicked, the card will perform the following Home Assistant action:

```yaml
action: cast.show_lovelace_view
data:
  entity_id: media_player.kitchen
  dashboard_path: dashboard-cast
  view_path: office
```

Which in turn will cast the specified Home Assistant dashboard (and view) to the Google Cast device.

For the example above to work, a dashboard with `dashboard-cast` URL must exist:

![image](../images/cast-dashboard.png)

Within that dashboard, create an `office` view and finally within that view you can place the Advanced Camera Card configured for that camera for a proper full-screen casting experience:

```yaml
views:
  - title: Office
    type: panel
    path: office
    cards:
      - type: custom:advanced-camera-card
        cameras:
          - camera_entity: camera.office
            live_provider: go2rtc
        profiles:
          - low-performance
          - casting
```

The `casting` profile pre-configures the card to be casted to a 16:9 screen (such as a TV), including hiding all interactive elements and the menu. The `low-performance` profile is also recommended, as normally casting devices have limited hardware capabilities.

![image](../images/cast-profile.jpg)

When casting to a Google Nest Hub, the following configuration can be used:

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.office
    live_provider: go2rtc
profiles:
  - low-performance
  - casting
menu:
  style: hidden
dimensions:
  aspect_ratio: 1024:600
```

This restores the menu and sets the aspect ratio to 1024:600, which is the resolution of the Nest Hub.

![](../images/card-on-nest-hub.jpg 'Casting on a Nest Hub :size=400')

### Limitations

Casting Home Assistant dashboards comes with a number of caveats:

- Home Assistant Casting does not support the HA `streaming` component
  ([source](https://cast.home-assistant.io/faq.html)). This means clips playing
  and the `ha` live provider can not work. Other live providers such as `jsmpeg`
  and `webrtc-card` function correctly.
- The Javascript fullscreen API does not work, so the fullscreen button does not
  work (use a `panel` view instead).
