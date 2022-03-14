<!-- markdownlint-disable first-line-heading -->
<!-- markdownlint-disable fenced-code-language -->
<!-- markdownlint-disable no-inline-html -->

<img src="https://raw.githubusercontent.com/blakeblackshear/frigate-hass-integration/master/images/frigate.png"
     alt="Frigate icon"
     width="35%"
     align="right"
     style="float: right; margin: 10px 0px 20px 20px;" />
[![GitHub Release](https://img.shields.io/github/release/dermotduffy/frigate-hass-card.svg?style=flat-square)](https://github.com/dermotduffy/frigate-hass-card/releases)
[![Build Status](https://img.shields.io/github/workflow/status/dermotduffy/frigate-hass-card/Build?style=flat-square)](https://github.com/dermotduffy/frigate-hass-card/actions/workflows/build.yaml)
[![License](https://img.shields.io/github/license/dermotduffy/frigate-hass-card.svg?style=flat-square)](LICENSE)
[![hacs](https://img.shields.io/badge/HACS-default-orange.svg?style=flat-square)](https://hacs.xyz)
[![BuyMeCoffee](https://img.shields.io/badge/buy%20me%20a%20coffee-donate-yellow.svg?style=flat-square)](https://www.buymeacoffee.com/dermotdu)

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/image-view.png" alt="Frigate card example" width="400px">

| ♥️ This card is under active development. Be sure to consult the documentation that matches the release of the card you're using, rather than the documentation at head. README for latest stable release: [v3.0](https://github.com/dermotduffy/frigate-hass-card/blob/v3.0.0/README.md) |
| - |

# Frigate Lovelace Card

A full-featured Frigate Lovelace card:

* Live viewing of multiple cameras.
* Clips and snapshot browsing via mini-gallery.
* Automatic updating to continually show latest clip / snapshot.
* Support for filtering events by zone and label.
* Arbitrary entity access via menu (e.g. motion sensor access).
* Fullscreen mode.
* Carousel/Swipeable media, thumbnails and cameras.
* Direct media downloads.
* Lovelace visual editing support.
* Full [Picture Elements](https://www.home-assistant.io/lovelace/picture-elements/) support.
* Theme friendly.

## Screenshots Below!

See more [screenshots](#screenshots) below.

## Installation

* Use [HACS](https://hacs.xyz/) to install the card:

```
Home Assistant > HACS > Frontend > "Explore & Add Integrations" > Frigate Card
```

* Add the following to `configuration.yaml` (note that `/hacsfiles/` is just an [optimized equivalent](https://hacs.xyz/docs/categories/plugins#custom-view-hacsfiles) of `/local/community/` that HACS natively supports):

```yaml
lovelace:
  resources:
    - url: /hacsfiles/frigate-hass-card/frigate-hass-card.js
      type: module
```

* Restart Home Assistant.
* Add the new card to the Lovelace configuration!

<a name="manual-installation"></a>

### Advanced Users: Manual Installation

* Download the `frigate-hass-card.js` attachment of the desired [release](https://github.com/dermotduffy/frigate-hass-card/releases) to a location accessible by Home Assistant.
* Add the location as a Lovelace resource via the UI, or via [YAML configuration](https://www.home-assistant.io/lovelace/dashboards/#resources)) such as:

```yaml
lovelace:
  mode: yaml
  resources:
   - url: /local/frigate-hass-card.js
     type: module
```

## Options

At least 1 camera must be configured in the `cameras` options, but otherwise all configuration parameters are optional.

### Camera Options

The `cameras` block configures a list of cameras the card should support. The first listed camera is the default. Camera configuration is under:

```yaml
cameras:
  - [...camera 0 (default camera)...]
  - [...camera 1...]
  - [...camera 2...]
```

| Option | Default | Overridable | Description |
| - | - | - | - |
| `camera_entity` | | :heavy_multiplication_x: | The Home Assistant camera entity to use with the `frigate` live provider view. Also used to automatically detect the name of the underlying Frigate camera, and the title/icon of the camera. |
| `camera_name` | Autodetected from `camera_entity` if that is specified. | :heavy_multiplication_x: | The Frigate camera name to use when communicating with the Frigate server, e.g. for viewing clips/snapshots or the JSMPEG live view. To view the birdseye view set this to `birdseye` and use the `frigate-jsmpeg` live provider.|
| `live_provider` | `auto` | :heavy_multiplication_x: | The choice of live stream provider. See [Live Providers](#live-providers) below.|
| `frigate_url` | | :heavy_multiplication_x: | The URL of the frigate server. If set, this value will be (exclusively) used for a `Frigate UI` menu button. |
| `label` | | :heavy_multiplication_x: | A Frigate label / object filter used to filter events (clips & snapshots), e.g. 'person'.|
| `zone` | | :heavy_multiplication_x: | A Frigate zone used to filter events (clips & snapshots), e.g. 'front_door'.|
| `client_id` | `frigate` | :heavy_multiplication_x: | The Frigate client id to use. If this Home Assistant server has multiple Frigate server backends configured, this selects which server should be used. It should be set to the MQTT client id configured for this server, see [Frigate Integration Multiple Instance Support](https://docs.frigate.video/integrations/home-assistant/#multiple-instance-support).|
| `title` | Autodetected from `camera_entity` if that is specified. | :heavy_multiplication_x: | A friendly name for this camera to use in the card. |
| `icon` | Autodetected from `camera_entity` if that is specified. | :heavy_multiplication_x: | The icon to use for this camera in the camera menu and in the next & previous controls when using the `icon` style. |
| `webrtc_card` | | :heavy_multiplication_x: | The WebRTC entity/URL to use for this camera with the `webrtc-card` live provider. See below. |
| `id` | `camera_entity`, `webrtc_card.entity` or `camera_name` if set (in that preference order). | :heavy_multiplication_x: | An optional identifier to use throughout the card configuration to refer unambiguously to this camera. See [camera IDs](#camera-ids). |

<a name="live-providers"></a>

#### Available Live Providers

|Live Provider|Latency|Frame Rate|Installation|Description|
| -- | -- | -- | -- | -- |
|`ha` (default HA configuration)|Poor|High|Builtin|Use the built-in Home Assistant camera stream. The camera doesn't even need to be a Frigate camera! |
|`ha` (when configured with LL-HLS)|Better|High|Builtin|Use the built-in Home Assistant camera streams -- can be configured to use an [LL-HLS](https://www.home-assistant.io/integrations/stream/#ll-hls) feed for lower latency.|
|`ha` (Native WebRTC)|Best|High|Builtin|Use the built-in Home Assistant camera streams -- can be configured to use [native WebRTC](https://www.home-assistant.io/integrations/rtsp_to_webrtc/) offering a very low-latency feed direct to your browser.|
|`frigate-jsmpeg`|Better|Low|Builtin|Stream the JSMPEG stream from Frigate (proxied via the Frigate integration). See [note below on the required integration version](#jsmpeg-troubleshooting) for this live provider to function. This is the only live provider that can view the Frigate `birdseye` view.|
|`webrtc-card`|Best|High|Separate installation required|Embed's [AlexxIT's WebRTC Card](https://github.com/AlexxIT/WebRTC) to stream live feed, requires manual extra setup, see [below](#webrtc). Not to be confused with native Home Assistant WebRTC (use `ha` provider above).|

#### Camera WebRTC Card configuration

The `webrtc_card` block configures only the entity/URL for this camera to be used with the WebRTC Card live provider. This configuration is included as part of a camera entry in the `cameras` array.

```yaml
cameras:
 - webrtc_card:
```

| Option | Default | Overridable | Description |
| - | - | - | - |
| `entity` | | :heavy_multiplication_x: | The RTSP entity to pass to the WebRTC Card for this camera. Specify this OR `url` (below). |
| `url` | | :heavy_multiplication_x: | The RTSP url to pass to the WebRTC Card. Specify this OR `entity` (above). |

See [Using the WebRTC Card](#webrtc) below for more details on how to use the WebRTC Card live provider.

<a name="camera-ids"></a>

#### Camera IDs: Refering to cameras in card configuration

Each camera configured in the card has a single identifier (`id`). For a given camera, this will be one of the camera {`id`, `camera_entity`, `webrtc_card.entity` or `camera_name`} parameters for that camera -- in that order of precedence. These ids may be used in conditions or custom actions to refer to a given camera unambiguously. |

#### Example

See [the basic cameras configuration example](#basic-cameras-configuration) below.

### View Options

All configuration is under:

 ```yaml
view:
```

| Option | Default | Overridable | Description |
| - | - | - | - |
| `default` | `live` | :heavy_multiplication_x: | The view to show in the card by default. The default camera is the first one listed. See [views](#views) below.|
| `camera_select` | `current` | :heavy_multiplication_x: | The view to show when a new camera is selected (e.g. in the camera menu). If `current` the view is unchanged when a new camera is selected. Other acceptable values may be seen at [views](#views) below.|
| `timeout_seconds` | `300` | :heavy_multiplication_x: | A numbers of seconds of inactivity after user interaction, after which the card will reset to the default configured view (i.e. 'screensaver' functionality). Inactivity is defined as lack of mouse/touch interaction with the Frigate card. If the default view occurs sooner (e.g. via `update_seconds` or manually) the timer will be stopped. `0` means disable this functionality. |
| `update_seconds` | `0` | :heavy_multiplication_x: | A number of seconds after which to automatically update/refresh the default view. See [card updates](#card-updates) below for behavior and usecases. If the default view occurs sooner (e.g. manually) the timer will start over. `0` disables this functionality.|
| `update_force` | `false` | :heavy_multiplication_x: | Whether automated card updates/refreshes should ignore user interaction. See [card updates](#card-updates) below for behavior and usecases.|
| `update_entities` | | :heavy_multiplication_x: | **YAML only**: A list of entity ids that should cause the view to reset to the default. See [card updates](#card-updates) below for behavior and usecases.|
| `update_cycle_camera` | `false` | :heavy_multiplication_x: | When set to `true` the selected camera is cycled on each default view change. |
| `render_entities` | | :heavy_multiplication_x: | **YAML only**: A list of entity ids that should cause the card to re-render 'in-place'. The view/camera is not changed. `update_*` flags to not pertain/relate to the behavior of this flag. This should **very** rarely be needed, but could be useful if the card is both setting and changing HA state of the same object as could be the case for some complex `card_mod` scenarios ([example](https://github.com/dermotduffy/frigate-hass-card/issues/343)). |
| `actions` | | :heavy_multiplication_x: | Actions to use for all views, individual actions may be overriden by view-specific actions. See [actions](#actions) below.|
### Menu Options

All configuration is under:

 ```yaml
menu:
```

| Option | Default | Overridable | Description |
| - | - | - | - |
| `mode` | `hidden-top` | :white_check_mark: | The menu mode to show by default. See [menu modes](#menu-modes) below.|
| `button_size` | `40px` | :white_check_mark: | The size of the menu buttons [in CSS Units](https://www.w3schools.com/cssref/css_units.asp).|
| `buttons` | | :white_check_mark: | Whether to show or hide built-in buttons. See below. |

#### Menu Options: Buttons

All configuration is under:

```yaml
menu:
  buttons:
```

| Option | Default | Overridable | Description |
| - | - | - | - |
| `frigate` | `true` | :white_check_mark: | Whether to show the `Frigate` menu button: brings the user to the default configured view (`view.default`), or collapses/expands the menu if the `menu.mode` is `hidden-*` . |
| `cameras` | `true` | :white_check_mark: | Whether to show the camera selection submenu. Will only appear if multiple cameras are configured. |
| `live` | `true` | :white_check_mark: | Whether to show the `live` view menu button: brings the user to the `live` view. See [views](#views) below.|
| `clips` | `true` | :white_check_mark: | Whether to show the `clips` view menu button: brings the user to the `clips` view on tap and the most-recent `clip` view on hold. See [views](#views) below. This button will never be shown if the `camera_name` for the selected camera is not auto-detected/specified (e.g. non-Frigate cameras), or if the `camera_name` is `birdseye`.|
| `snapshots` | `true` | :white_check_mark: | Whether to show the `snapshots` view menu button: brings the user to the `clips` view on tap and the most-recent `snapshot` view on hold. See [views](#views) below. This button will never be shown if the `camera_name` for the selected camera is not auto-detected/specified (e.g. non-Frigate cameras), or if the `camera_name` is `birdseye`.|
| `image` | `false` | :white_check_mark: | Whether to show the `image` view menu button: brings the user to the static `image` view. See [views](#views) below.|
| `download` | `true` | :white_check_mark: | Whether to show the `download` menu button: allow direct download of the media being displayed.|
| `frigate_ui` | `true` | :white_check_mark: | Whether to show the `frigate_ui` menu button: brings the user to a context-appropriate page on the Frigate UI (e.g. the camera homepage). Will only appear if the `frigate.url` option is set.|
| `fullscreen` | `true` | :white_check_mark: | Whether to show the `fullscreen` menu button: expand the card to consume the fullscreen. |

### Live Options

All configuration is under:

 ```yaml
live:
```

| Option | Default | Overridable | Description |
| - | - | - | - |
| `preload` | `false` | :heavy_multiplication_x: | Whether or not to preload the live view. Preloading causes the live view to render in the background regardless of what view is actually shown, so it's instantly available when requested. This consumes additional network/CPU resources continually. |
| `auto_unmute` | `false` | :heavy_multiplication_x: | Whether or not to automatically unmute live cameras. Note that some browsers will not allow automated unmute until the user has interacted with the page in some way -- if the user has not then the browser may pause the media instead. |
| `lazy_load` | `true` | :heavy_multiplication_x: | Whether or not to lazily load cameras in the camera carousel. Setting this will `false` will cause all cameras to load simultaneously when the `live` carousel is opened (or cause all cameras to load continually if both `lazy_load` and `preload` are `true`). This will result in a smoother carousel experience at a cost of (potentially) a substantial amount of continually streamed data. |
| `lazy_unload` | `false` | :heavy_multiplication_x: | Whether or not to lazily **un**load lazyily-loaded cameras in the camera carousel, or just leave the camera paused. Setting this to `true` will cause cameras to be entirely unloaded when they are no longer visible (either because the carousel has scrolled past them, or because the document has been marked hidden/inactive by the browser). This will cause a reloading delay on revisiting that camera in the carousel but will save the streaming network resources that are otherwise consumed. This option has no effect if `lazy_load` is false. |
| `draggable` | `true` | :heavy_multiplication_x: | Whether or not the live carousel can be dragged left or right, via touch/swipe and mouse dragging. |
| `transition_effect` | `slide` | :heavy_multiplication_x: | Effect to apply as a transition between live cameras. Accepted values: `slide` or `none`. |
| `actions` | | :white_check_mark: | Actions to use for the `live` view. See [actions](#actions) below.|
| `controls` | | :white_check_mark: | Configuration for the `live` view controls. See below. |
| `jsmpeg` | | :white_check_mark: | Configuration for the `frigate-jsmpeg` live provider. See below.|
| `webrtc_card` | | :white_check_mark: | Configuration for the `webrtc-card` live provider. See below.|

#### Live Provider: JSMPEG Configuration

All configuration is under:

```yaml
live:
  jsmpeg:
```

| Option | Default | Overridable | Description |
| - | - | - | - |
| `options` | | :white_check_mark: | **Advanced users only**: Control the underlying [JSMPEG library options](https://github.com/phoboslab/jsmpeg#usage). Supports setting these JSMPEG options `{audio, video, pauseWhenHidden, disableGl, disableWebAssembly, preserveDrawingBuffer, progressive, throttled, chunkSize, maxAudioLag, videoBufferSize, audioBufferSize}`. This is not necessary for the vast majority of users: only set these flags if you know what you're doing, as you may entirely break video rendering in the card.|

<a name="webrtc-live-configuration"></a>

#### Live Provider: WebRTC Card Configuration

All configuration is under:

```yaml
live:
  webrtc_card:
```

| Option | Default | Overridable | Description |
| - | - | - | - |
| `*`| | :white_check_mark: | Any options specified in the `webrtc_card:` YAML dictionary are silently passed through to the AlexxIT's WebRTC Card. See [WebRTC Configuration](https://github.com/AlexxIT/WebRTC#configuration) for full details this external card provides. This implies that if `entity` or `url` are specified here they will override the matching named parameters under the per camera configuration. |

See [Using WebRTC Card](#webrtc) below for more details on how to embed AlexxIT's WebRTC Card with the Frigate Card.

#### Live Controls: Thumbnails

All configuration is under:

```yaml
live:
  controls:
    thumbnails:
```

| Option | Default | Overridable | Description |
| - | - | - | - |
| `mode` | `none` | :white_check_mark: | Whether to show the thumbnail carousel `below` the media, `above` the media or to hide it entirely (`none`).|
| `size` | `100px` | :white_check_mark: | The size of the thumbnails in the thumbnail carousel [in CSS Units](https://www.w3schools.com/cssref/css_units.asp).|
| `media` | `clips` | :white_check_mark: | Whether to show `clips` or `snapshots` in the thumbnail carousel in the `live` view.|

#### Live Controls: Next / Previous

All configuration is under:

```yaml
live:
  controls:
    next_previous:
```

| Option | Default | Overridable | Description |
| - | - | - | - |
| `style` | `chevrons` | :white_check_mark: | When viewing live cameras, what kind of controls to show to move to the previous/next camera. Acceptable values: `chevrons`, `icons`, `none` . |
| `size` | `48px` | :white_check_mark: | The size of the next/previous controls [in CSS Units](https://www.w3schools.com/cssref/css_units.asp).|

<a name="live-controls-title"></a>

#### Live Controls: Title

All configuration is under:

```yaml
live:
  controls:
    title:
```

| Option | Default | Overridable | Description |
| - | - | - | - |
| `mode` | `popup-bottom-right` | :white_check_mark: | How to display the live camera title. Acceptable values: `none`, `popup-top-left`, `popup-top-right`, `popup-bottom-left`, `popup-bottom-right` . |
| `duration_seconds` | `2` | :white_check_mark: | The number of seconds to display the title popup. `0` implies forever.|

### Event Viewer Options

The `event_viewer` is used for viewing all `clip` and `snapshot` media, in a media carousel.

All configuration is under:

```yaml
event_viewer:
```

| Option | Default | Overridable | Description |
| - | - | - | - |
| `auto_play` | `true` | :heavy_multiplication_x: | Whether or not to autoplay clips.|
| `auto_unmute` | `false` | :heavy_multiplication_x: | Whether or not to automatically unmute clips. Note that some browsers will not allow automated unmute until the user has interacted with the page in some way -- if the user has not then the browser may pause the media instead. |
| `lazy_load` | `true` | :heavy_multiplication_x: | Whether or not to lazily load media in the event viewer carousel. Setting this will false will fetch all media immediately which may make the carousel experience smoother at a cost of (potentially) a substantial number of simultaneous media fetches on load. |
| `draggable` | `true` | :heavy_multiplication_x: | Whether or not the event viewer carousel can be dragged left or right, via touch/swipe and mouse dragging. |
| `transition_effect` | `slide` | :heavy_multiplication_x: | Effect to apply as a transition between event media. Accepted values: `slide` or `none`. |
| `controls` | | :heavy_multiplication_x: | Configuration for the event viewer. See below. |
| `actions` | | :heavy_multiplication_x: | Actions to use for all views that use the `event_viewer` (e.g. `clip`, `snapshot`). See [actions](#actions) below.|

#### Event Viewer Controls: Next / Previous

All configuration is under:

```yaml
event_viewer:
  controls:
    next_previous:
```

| Option | Default | Overridable | Description |
| - | - | - | - |
| `style` | `thumbnails` | :heavy_multiplication_x: | When viewing media, what kind of controls to show to move to the previous/next media item. Acceptable values: `thumbnails`, `chevrons`, `none` . |
| `size` | `48px` | :heavy_multiplication_x: | The size of the next/previous controls [in CSS Units](https://www.w3schools.com/cssref/css_units.asp).|

#### Event Viewer Controls: Thumbnails

All configuration is under:

```yaml
event_viewer:
  controls:
    thumbnails:
```

| Option | Default | Overridable | Description |
| - | - | - | - |
| `mode` | `none` | :heavy_multiplication_x: | Whether to show the thumbnail carousel `below` the media, `above` the media or to hide it entirely (`none`).|
| `size` | `100px` | :heavy_multiplication_x: | The size of the thumbnails in the thumbnail carousel [in CSS Units](https://www.w3schools.com/cssref/css_units.asp).|

#### Event Viewer Controls: Title

All configuration is under:

```yaml
event_viewer:
  controls:
    title:
```

| Option | Default | Overridable | Description |
| - | - | - | - |
| `mode` | `popup-bottom-right` | :heavy_multiplication_x: | How to display the event viewer media title. Acceptable values: `none`, `popup-top-left`, `popup-top-right`, `popup-bottom-left`, `popup-bottom-right` . |
| `duration_seconds` | `2` | :heavy_multiplication_x: | The number of seconds to display the title popup. `0` implies forever.|

### Event Gallery Options

The `event_gallery` is used for providing an overview of all `clips` and `snapshots` in a thumbnail gallery.

All configuration is under:

```yaml
event_gallery:
```

| Option | Default | Overridable | Description |
| - | - | - | - |
| `min_columns` | `5` | :heavy_multiplication_x: | The minimum number of columns to show in the gallery -- smaller values will render fewer but larger thumbnail columns. Thumbnails will never be stretched beyond their intrinsic size (typically `175px`). All available space (in normal mode, or fullscreen mode) will be occupied by the gallery, so more columns than `min_columns` will often be rendered if space allows for more full-sized thumbnails. For normal sized Lovelace cards (`492px` wide), this typically means there'll never be fewer than 3 columns rendered (as otherwise the thumbnails would need to stretch beyond their actual size). Must be `1 <= x <= 10`. |
| `actions` | | :heavy_multiplication_x: | Actions to use for all views that use the `event_gallery` (e.g. `clips`, `snapshots`). See [actions](#actions) below.|

### Image Options

All configuration is under:

```yaml
image:
```

| Option | Default | Overridable | Description |
| - | - | - | - |
| `mode` | `url` | :white_check_mark: | Mode of the the `image` [view](#views). Value must be one of `url` (to fetch an arbitrary image URL), `camera` (to show a still of the currently selected camera using either `camera_entity` or `webrtc_card.entity` in that order of precedence), or `screensaver` (to show an [embedded stock Frigate card logo](https://github.com/dermotduffy/frigate-hass-card/blob/main/src/images/frigate-bird-in-sky.jpg)). In either `url` or `camera` mode, the `screensaver` content is used as a fallback if a URL is not specified or cannot be derived. |
| `url` | | :white_check_mark: |  A static image URL to be used when the `mode` is set to `url`. Note that a `_t=[timestsamp]` query parameter will be automatically added to all URLs such that the image will not be cached by the browser.|
| `refresh_seconds` | 0 | :white_check_mark: | The image will be refreshed at least every `refresh_seconds` (it may refresh more frequently, e.g. whenever Home Assistant updates its camera security token). `0` implies no refreshing. |
| `actions` | | :white_check_mark: | Actions to use for the `image` view. See [actions](#actions) below.|

### Dimension Options

All configuration is under:

```yaml
dimensions:
```

| Option | Default | Overridable | Description |
| - | - | - | - |
| `aspect_ratio_mode` | `dynamic` | :heavy_multiplication_x: | The aspect ratio mode to use. Acceptable values: `dynamic`, `static`, `unconstrained`. See [aspect ratios](#aspect-ratios) below.|
| `aspect_ratio` | `16:9` | :heavy_multiplication_x: | The aspect ratio  to use. Acceptable values: `<W>:<H>` or `<W>/<H>`. See [aspect ratios](#aspect-ratios) below.|

#### `dimensions.aspect_ratio_mode`:

| Option           | Description                                         |
| ------------- | --------------------------------------------- |
| `dynamic` | The aspect-ratio of the card will match the aspect-ratio of the last loaded media. |
| `static` | A fixed aspect-ratio (as defined by `dimensions.aspect_ratio`) will be applied to all views. |
| `unconstrained` | No aspect ratio is enforced in any view, the card will expand with the content (may be especially useful for a panel-mode dashboard). |

#### `dimensions.aspect_ratio`:

* `16 / 9` or `16:9`: Default widescreen ratio.
* `4 / 3` or `4:3`: Default fullscreen ratio.
* `<W>/<H>` or `<W>:<H>`: Any arbitrary aspect-ratio.

<a name="aspect-ratios"></a>

#### Aspect Ratio

The card can show live cameras, stored events (clip or snapshot) and an event
gallery (clips or snapshots). Of these [views](#views), the gallery views have
no intrinsic aspect-ratio, whereas the other views have the aspect-ratio of the
media.

The card aspect ratio can be changed with the `dimensions.aspect_ratio_mode` and
`dimensions.aspect_ratio` options described above.

If no aspect ratio is specified or available, but one is needed then `16:9` will
be used by default.

### Override Options

All configuration is a list under:

```yaml
overrides:
```

Various parts of this configuration may conditionally (see [Frigate Card
Conditions](#frigate-card-conditions)) be overridden, for example to use custom
WebRTC parameters for a particular camera or to hide the menu in fullscreen mode.

Not all configuration parameters are overriddable (only those with check marks
in this documentation) -- some because it doesn't make sense for that parameter
to vary, and many because of the extra complexity of supporting overriding given
the lack of compelling usecases ([please request new overridable parameters
here!](https://github.com/dermotduffy/frigate-hass-card/issues/new/choose)).

Each entry under the top-level `overrides` configuration block should be a list
item, that has both of the following parameters set:

| Option | Default | Overridable | Description |
| - | - | - | - |
| `conditions` | | :heavy_multiplication_x: | A set of conditions that must evaluate to `true` in order for the overrides to be applied. See [Frigate Card Conditions](#frigate-card-conditions). |
| `overrides` | | :heavy_multiplication_x: |Configuration overrides to be applied. Any configuration parameter described in this documentation as 'Overridable' is supported. |

<a name="webrtc"></a>

### Using AlexxIT's WebRTC Card

WebRTC Card support blends the use of the ultra-realtime [WebRTC card live
view](https://github.com/AlexxIT/WebRTC) with convenient access to Frigate
events/snapshots/UI. A perfect combination!

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/webrtc.png" alt="Live viewing" width="400px">

**Note**: AlexxIT's WebRTC Integration/Card must be installed and configured separately (see [details](https://github.com/AlexxIT/WebRTC)) before it can be used with this card.

#### Specifying The WebRTC Card Camera

The WebRTC Card live provider does **not** support use of Frigate-provided
camera entities, as it requires an RTSP stream which Frigate does not currently
provide. There are two ways to specify the WebRTC Card source camera:

* Manual setup of separate RTSP camera entities in Home Assistant ([see
  example](https://www.home-assistant.io/integrations/generic/#live-stream)).
  These entities will then be available for selection in the GUI card editor for
  the camera, or can be manually specified with a `webrtc_card.entity` option under
  that particular cameras configuration:

```yaml
cameras:
 - webrtc_card:
     entity: 'camera.front_door_rstp`
```

* OR manually entering the WebRTC Card camera URL parameter in the GUI card
  editor, or configuring the `url` parameter as part of a manual Frigate card
  configuration, as illustrated in the following example:

```yaml
cameras:
 - webrtc_card:
     url: 'rtsp://USERNAME:PASSWORD@CAMERA:554/RTSP_PATH'
```

Other WebRTC Card options may be specified under the `live` section, like so:

```yaml
live:
  webrtc_card:
    ui: true
```

See [the WebRTC Card live configuration](#webrtc-live-configuration) above, and the
[external WebRTC Card configuration
documentation](https://github.com/AlexxIT/WebRTC#configuration) for full
configuration options that can be used here.

<a name="frigate-card-conditions"></a>

## Frigate Card Conditions

Conditions are used to apply certain configuration depending on runtime evaluations. Conditions may be used in `elements` configuration (as part of a `custom:frigate-card-conditional` element) or the `overrides` configuration (see below for both).

All variables listed are under a `conditions:` section. 

| Condition | Description |
| ------------- | --------------------------------------------- |
| `view` | A list of [views](#views) in which this condition is satified (e.g. `clips`) |
| `camera` | A list of camera ids in which this condition is satisfied. See [camera IDs](#camera-ids).|
| `fullscreen` | If `true` the condition is satisfied if the card is in fullscreen mode. If `false` the condition is satisfied if the card is **NOT** in fullscreen mode.|

See the [PTZ example below](#frigate-card-conditional-example) for a real-world example of how these conditions can be used.

<a name="frigate-card-elements"></a>

## Picture Elements / Menu Customizations

This card supports the [Picture Elements configuration
syntax](https://www.home-assistant.io/lovelace/picture-elements/) to seamlessly
allow the user to add custom elements to the card, which may be configured to
perform a variety of actions on interaction (see [actions](#actions) below).

In the card YAML configuration, elements may be manually added under an
`elements` key.

See the [action
documentation](https://www.home-assistant.io/lovelace/actions/#hold-action) for
more information on the action options available.

**Note**: The Frigate Card allows either a single action (as in stock Home
Assistant) or list of actions to be defined for each class of user interaction
(e.g. `tap`, `double_tap`, `hold`, etc). See [an example of multiple actions](#example-multiple-actions).

### Special Elements

This card supports all [Picture
Elements](https://www.home-assistant.io/lovelace/picture-elements/#icon-element)
using compatible syntax. The card also supports a handful of custom special
elements to add special Frigate card functionality.

| Element name | Description                                         |
| ------------- | --------------------------------------------- |
| `custom:frigate-card-menu-icon` | Add an arbitrary icon to the Frigate Card menu. Configuration is ~identical to that of the [Picture Elements Icon](https://www.home-assistant.io/lovelace/picture-elements/#icon-element) except with a type name of `custom:frigate-card-menu-icon`.|
| `custom:frigate-card-menu-state-icon` | Add a state icon to the Frigate Card menu that represents the state of a Home Assistant entity. Configuration is ~identical to that of the [Picture Elements State Icon](https://www.home-assistant.io/lovelace/picture-elements/#state-icon) except with a type name of `custom:frigate-card-menu-state-icon`.|
| `custom:frigate-card-menu-submenu` | Add a configurable submenu dropdown. See [configuration below](#frigate-card-menu-submenu).|
| `custom:frigate-card-conditional` | Restrict a set of elements to only render when the card is showing particular a particular [view](#views). See [configuration below](#frigate-card-conditional).|

<a name="frigate-card-submenu"></a>

#### `custom:frigate-card-menu-submenu`

Parameters for the `custom:frigate-card-menu-submenu` element are identical to the parameters of the [stock Home Assistant Icon Element](https://www.home-assistant.io/lovelace/picture-elements/#icon-element) with the exception of these parameters which differ:

| Parameter | Description |
| - | - |
| `type` | Must be `custom:frigate-card-menu-submenu`. |
| `items` | A list of menu items, as described below. | 

##### Submenu Items

| Parameter | Default | Description |
| - | - | - |
| `title` | | An optional title to display. |
| `icon` | | An optional item icon to display, e.g. `mdi:car` |
| `entity` | | An optional Home Assistant entity from which title, icon and style can be automatically computed. |
| `state_color` | `true` | Whether or not the title and icon should be stylized based on state. |
| `selected` | `false` | Whether or not to show this item as selected. |
| `style` | | Position and style the element using CSS. |
| `tap_action`, `double_tap_action`, `hold_action`, `start_tap`, `end_tap` | | [Home Assistant action configuration](https://www.home-assistant.io/lovelace/actions) including the extended functionality described under [actions](#actions). |

See the [Configuring a Submenu example](#configuring-a-submenu-example).

<a name="frigate-card-conditional"></a>

#### `custom:frigate-card-conditional`

Parameters for the `custom:frigate-card-conditional` element:

| Parameter | Description |
| ------------- | --------------------------------------------- |
| `type` | Must be `custom:frigate-card-conditional`. |
 `elements` | The elements to render. Can be any supported element, include additional condition or custom elements. |
| `conditions` | A set of conditions that must evaluate to true in order for the elements to be rendered. See [Frigate Card Conditions](#frigate-card-conditions). |

### Special Actions

#### `custom:frigate-card-action`

| Action name | Description |
| - | - |
| `custom:frigate-card-action` | Call a Frigate Card action. Acceptable values are `default`, `clip`, `clips`, `image`, `live`, `snapshot`, `snapshots`, `download`, `frigate_ui`, `fullscreen`, `camera_select`, `menu_toggle`.|

| Value | Description |
| - | - |
| `default` | Trigger the default view. |
| `clip`, `clips`, `image`, `live`, `snapshot`, `snapshots` | Trigger the named [view](#views).|
|`download`|Download the displayed media.|
|`frigate_ui`|Open the Frigate UI at the configured URL.|
|`fullscreen`|Toggle fullscreen.| 
|`camera_select`|Select a given camera. Takes a single additional `camera` parameter with the [camera ID](#camera-ids) of the camera to select. Respects the value of `view.camera_select` to choose the appropriate view on the new camera.|
|`menu_toggle` | Show/hide the menu (for `hidden-*` mode menus). |

<a name="views"></a>

## Views

This card supports several different views:

| Key           | Description                                         |
| ------------- | --------------------------------------------- |
|`live` (default)| Shows the live camera view with the configured live provider.|
|`snapshots`|Shows an event gallery of snapshots for this camera/zone/label.|
|`snapshot`|Shows an event viewer for the most recent snapshot for this camera/zone/label. Can also be accessed by holding down the `snapshots` menu icon.|
|`clips`|Shows an event gallery of clips for this camera/zone/label.|
|`clip`|Shows an event viewer for the most recent clip for this camera/zone/label. Can also be accessed by holding down the `clips` menu icon.|
|`image`|Shows a static image specified by the `image` parameter, can be used as a discrete default view or a screensaver (via `view.timeout_seconds`).|

### Navigating From A Snapshot To A Clip

Clicking on a snapshot will take the user to a clip that was taken at the ~same
time as the snapshot (if any).

<a name="actions"></a>

## Actions

### Introduction to Actions

Actions are pre-configured activities that can be triggered in response to a
variety of circumstances (e.g. tapping on a menu icon, double tapping on a
[picture element](#frigate-card-elements) or holding the mouse/tap down on a
particular [view](#views)).

### Configuring Actions

The format for actions is the standard Home Assistant [action
format](https://www.home-assistant.io/lovelace/actions/#tap-action), with the
exception of differences called out below.

### Differences in actions between Frigate Card and Home Assistant 

Both the Home Assistant frontend and the Frigate card cooperate to provide
action functionality. In general, the Frigate Card functionality is a superset
of that offered by stock Home Assistant.

Stock action functionality is used for Stock [Home Assistant picture
elements](https://www.home-assistant.io/lovelace/picture-elements/). Extended
Frigate card behavior covers all other interactions on the Frigate card (e.g.
menu icon elements, submenus and actions on the card or views).

#### Custom action types: `start_tap` and `end_tap`

The card has partial support for two special action types `start_tap` and
`end_tap` which occur when a tap is started (e.g. mouse is pressed down /
touch begins), and ended (e.g. mouse released / touch ends) respectively. This
might be useful for PTZ cameras cameras to start/stop movement on touch. Network
latency may introduce unavoidable imprecision between `end_tap` and action
actually occurring.

#### Multiple actions

Extended Frigate card behavior supports a list of actions which will be handled,
in addition to using a singular action. See [an example of multiple
actions](#example-multiple-actions) below.

### Card & View Actions

Actions may be attached to the card itself, to trigger action when the card
experiences a `tap`, `double_tap`, `hold`, `start_tap` or `end_tap` event. These
actions can be specified both for the overall card and for individual groups of
view.

| Configuration path | Views to which it refers |
| - | - |
| `view.actions` | All (may be overriden by the below) |
| `event_viewer.actions` | `clip`, `snapshot` |
| `event_gallery.actions` | `clips`, `snapshots` |
| `live.actions` | `live` |
| `image.actions` | `image` |

If an action is configured for both the whole card (`view.actions`) and a more
specific view (e.g. `live.actions`) then the actions are merged, with the more
specific overriding the less specific (see example below).

**Note:** The card itself relies on user interactions to function (e.g. `tap` on
the menu should activate that button, `tap` on a gallery thumbnail should open
that piece of media, etc). Efforts are taken to de-duplicate interactions (e.g.
card-wide actions will not be activated through interaction with menu buttons,
next/previous controls, thumbnails, etc), but in some cases this is not possible
(e.g. embedded WebRTC card controls) -- in these cases duplicate actions may
occur with certain configurations (e.g. `tap`).

## Menu Modes

This card supports several menu configurations.

| Key           | Description                                         | Screenshot |
| ------------- | --------------------------------------------- | - |
|`hidden-{top,bottom,right,left}`  [default: `hidden-top`]| Hide the menu by default, expandable upon clicking the Frigate button. | <img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/menu-mode-hidden.png" alt="Menu hidden" width="400px"> |
|`overlay-{top,bottom,right,left}`| Overlay the menu over the card contents. The Frigate button shows the default view. | <img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/menu-mode-overlay.png" alt="Menu overlaid" width="400px"> |
|`hover-{top,bottom,right,left}`| Overlay the menu over the card contents when the mouse is over the card / touch on the card, otherwise it is not shown. The Frigate button shows the default view. | <img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/menu-mode-overlay.png" alt="Menu overlaid" width="400px"> |
|`above`| Render the menu above the card. The Frigate button shows the default view. | <img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/menu-mode-above.png" alt="Menu above" width="400px"> |
|`below`| Render the menu below the card. The Frigate button shows the default view. | <img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/menu-mode-below.png" alt="Menu below" width="400px"> |
|`none`| No menu is shown. | <img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/menu-mode-none.png" alt="No Menu" width="400px"> |

<a name="screenshots"></a>

## Screenshots

### Live Viewing of Multiple Cameras

Scroll through your live cameras, or choose from a menu. Seamlessly supports
cameras of different dimensions, and custom submenus per camera.

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/camera-carousel.gif" alt="Gallery" width="400px">

### Full Viewing Of Events

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/gallery.png" alt="Gallery" width="400px">

### Live Viewing With Thumbnail Carousel

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/live-thumbnails.gif" alt="Live view with event thumbnails" width="400px">

### Clip Viewing With Thumbnail Carousel

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/viewer-thumbnails.gif" alt="Viewer with event thumbnails" width="400px">

### Hover Menu / Thumbnail Next & Previous Controls

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/viewer-with-thumbnail-next-prev.gif" alt="Viewer with event thumbnails" width="400px">

### Card Editing

This card supports full editing via the Lovelace card editor. Additional arbitrary configuration for WebRTC Card may be specified in YAML mode.

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/editor.gif" alt="Live viewing" width="400px">

### Configurable Submenus

This card supports fully configurable submenus.

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/submenu.gif" alt="Configurable submenus" width="400px">

## Examples

### Basic cameras configuration

<details>
  <summary>Expand: Basic cameras configuration</summary>

```yaml
type: custom:frigate-card
cameras:
  - camera_entity: camera.sitting_room
  - camera_entity: camera.front_door
```
</details>


<details>
  <summary>Expand: Different providers for a single camera</summary>

Cameras can be repeated with different providers (note the required use of `id`
to provide a separate unambiguous way of referring to that camera, since the
`camera_entity` is shared between the two cameras).

```yaml
type: custom:frigate-card
cameras:
  - camera_entity: camera.front_door
    live_provider: frigate-jsmpeg
    title: Front Door (JSMPEG)
  - camera_entity: camera.front_door
    live_provider: webrtc-card
    title: Front Door (WebRTC)
    webrtc_card:
      entity: camera.front_door_rtsp
    id: front-door-webrtc
```
</details>

### WebRTC Card Provider

<details>
  <summary>Expand: Basic WebRTC Card configuration with UI enabled</summary>

```yaml
type: custom:frigate-card
cameras:
  - camera_entity: camera.front_door
    live_provider: webrtc-card
    title: Front Door
    webrtc_card:
      entity: camera.front_door_rtsp
live:
  webrtc_card:
    ui: true
```
</details>

</details>

### Static Aspect Ratios

You can set a static aspect ratio.

<details>
  <summary>Expand: Static 4:3 aspect ratios</summary>

```yaml
[...]
dimensions:
  aspect_ratio_mode: dynamic
  aspect_ratio: '4:3'
```
</details>

### Adding Menu Icons

You can add custom icons to the menu with arbitrary actions.

<details>
  <summary>Expand: Custom menu icon</summary>

This example adds an icon that navigates the browser to the releases page for this
card:

```yaml
[...]
elements:
  - type: custom:frigate-card-menu-icon
    icon: mdi:book
    tap_action:
      action: url
      url_path: https://github.com/dermotduffy/frigate-hass-card/releases
```
</details>

### Adding Menu State Icons

You can add custom state icons to the menu to show the state of an entity and complete arbitrary actions.

<details>
  <summary>Expand: Custom menu state icon</summary>

This example adds an icon that represents the state of the
`light.office_main_lights` entity, that toggles the light on double click.

```yaml
[...]
elements:
  - type: custom:frigate-card-menu-state-icon
    entity: light.office_main_lights
    tap_action:
      action: toggle
```
</details>

### Adding State Badges

You can add a state badge to the card showing arbitrary entity states.

<details>
  <summary>Expand: State badge</summary>

This example adds a state badge showing the temperature and hides the label text:

```yaml
[...]
elements:
  - type: state-badge
    entity: sensor.kitchen_temperature
    style:
      right: '-20px'
      top: 100px
      color: rgba(0,0,0,0)
      opacity: 0.5
```

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/picture_elements_temperature.png" alt="Picture elements temperature example" width="400px">
</details>

### Adding State Badges

You can have icons conditionally added to the menu based on entity state.

<details>
  <summary>Expand: Conditional menu icons</summary>

This example only adds the light entity to the menu if a light is on.

```yaml
[...]
elements:
  - type: conditional
    conditions:
      - entity: light.kitchen
        state: 'on'
    elements:
      - type: custom:frigate-card-menu-state-icon
        entity: light.kitchen
        tap_action:
          action: toggle
```
</details>

<a name="frigate-card-conditional-example"></a>

### Restricting Icons To Certain Views

You can restrict icons to only show for certain [views](#views) using a
`custom:frigate-card-conditional` element (e.g. PTZ controls)

<details>
  <summary>Expand: View-based conditions (e.g. PTZ controls)</summary>

This example shows PTZ icons that call a PTZ service, but only in the `live` view.

```yaml
[...]
elements:
  - type: custom:frigate-card-conditional
    conditions:
      view:
        - live
    elements:
      - type: icon
        icon: mdi:arrow-up
        style:
          background: rgba(255, 255, 255, 0.25)
          border-radius: 5px
          right: 25px
          bottom: 50px
        tap_action:
          action: call-service
          service: amcrest.ptz_control
          service_data:
            entity_id: camera.kitchen
            movement: up
      - type: icon
        icon: mdi:arrow-down
        style:
          background: rgba(255, 255, 255, 0.25)
          border-radius: 5px
          right: 25px
          bottom: 0px
        tap_action:
          action: call-service
          service: amcrest.ptz_control
          service_data:
            entity_id: camera.kitchen
            movement: down
      - type: icon
        icon: mdi:arrow-left
        style:
          background: rgba(255, 255, 255, 0.25)
          border-radius: 5px
          right: 50px
          bottom: 25px
        tap_action:
          action: call-service
          service: amcrest.ptz_control
          service_data:
            entity_id: camera.kitchen
            movement: left
      - type: icon
        icon: mdi:arrow-right
        style:
          background: rgba(255, 255, 255, 0.25)
          border-radius: 5px
          right: 0px
          bottom: 25px
        tap_action:
          action: call-service
          service: amcrest.ptz_control
          service_data:
            entity_id: camera.kitchen
            movement: right
```
</details>

<a name="frigate-card-action"></a>

### Triggering Card Actions

You can control the card itself with the `custom:frigate-card-action` action.

<details>
  <summary>Expand: Custom fullscreen button</summary>

This example shows an icon that toggles the card fullscreen mode.

```yaml
[...]
elements:
  - type: icon
    icon: mdi:fullscreen
    style:
      left: 40px
      top: 40px
    tap_action:
      action: custom:frigate-card-action
      frigate_card_action: fullscreen
```
</details>

### Adding Card-wide Actions

You can add actions to the card to be trigger on `tap`, `double_tap`, `hold`, `start_tap` or `end_tap`. See [actions](#actions) above.

<details>
  <summary>Expand: Adding a card-wide action</summary>

In this example double clicking the card in any view will cause the card to go
into fullscreen mode, **except** when the view is `live` in which case the
office lights are toggled.

```yaml
[...]
view:
  actions:
    double_tap_action:
      action: custom:frigate-card-action
      frigate_card_action: fullscreen
live:
  actions:
    entity: light.office_main_lights
    double_tap_action:
      action: toggle
```
</details>

<a name="configuring-a-submenu-example"></a>

### Configuring a submenu

You can add submenus to the menu -- buttons that when pressed reveal a dropdown submenu of configurable options.

<details>
  <summary>Expand: Adding a submenu</summary>

This example shows a submenu that illustrates a variety of actions.

```yaml
[...]
elements:
  - type: custom:frigate-card-menu-submenu
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
          action: custom:frigate-card-action
          frigate_card_action: fullscreen
```

</details>

<details>
  <summary>Expand: Custom submenus per camera</summary>

This example shows submenus conditional on the camera selected.

```yaml
[...]
elements:
  - type: custom:frigate-card-conditional
    conditions:
      camera:
        - camera.front_door
    elements:
      - type: custom:frigate-card-menu-submenu
        icon: mdi:door
        items:
          - title: Front Door Lights
            icon: mdi:lightbulb
            entity: light.front_door_lights
            tap_action:
              action: toggle
  - type: custom:frigate-card-conditional
    conditions:
      camera:
        - camera.living_room
    elements:
      - type: custom:frigate-card-menu-submenu
        icon: mdi:sofa
        items:
          - title: Living Room Lights
            icon: mdi:lightbulb
            entity: light.living_room_lights
            tap_action:
              action: toggle
          - title: Living Room Lamp
            icon: mdi:lightbulb
            entity: light.living_room_lamp
            tap_action:
              action: toggle
```

</details>


### Overriding card behavior

You can override card configuration when certain [conditions](#frigate-card-conditions) are met.

<details>
  <summary>Expand: Hiding the menu in fullscreen mode</summary>

This example disables the menu unless the card is in fullscreen mode, and uses a
card-wide action to enable fullscreen mode on `double_tap`:

```yaml
view:
  actions:
    double_tap_action:
      action: custom:frigate-card-action
      frigate_card_action: fullscreen
overrides:
  - conditions:
      fullscreen: true
    overrides:
      menu:
        mode: none
```

</details>

<details>
  <summary>Expand: Enable WebRTC Card UI only for a selected camera</summary>

This example enables WebRTC Card UI mode for a particular camera.

```yaml
cameras:
 - camera_entity: camera.office
   live_provider: webrtc-card
 - camera_entity: camera.a-different-camera
[...]
overrides:
  - conditions:
      camera:
        - camera.office
    overrides:
      live:
        webrtc_card:
          ui: true
```

</details>

### Refreshing a static image

<details>
  <summary>Expand: Auto-refreshing a static image</summary>

This example fetches a static image every 10 seconds (in this case the latest image saved on the Frigate server for a given camera).

```yaml
[...]
view:
  default: image
image:
  src: https://my-friage-server/api/living_room/latest.jpg
  refresh_seconds: 10
```
</details>

<a name="example-multiple-actions"></a>

### Defining multiple actions for Elements

<details>
  <summary>Expand: Changing camera and view simultaneously</summary>

This example shows how to configure multiple actions for a single Frigate card user interaction, in this case both selecting a different camera and changing the view on `tap`. Note that multiple actions are not supported on stock Picture Elements, see [actions](#actions) for more information.

```yaml
[...]
elements:
  - type: custom:frigate-card-menu-icon
    icon: mdi:chair-rolling
    tap_action:
      - action: custom:frigate-card-action
        frigate_card_action: camera_select
        camera: camera.office
      - action: custom:frigate-card-action
        frigate_card_action: live
```
</details>

<a name="card-updates"></a>

### Using `card-mod` to style the card

This card allows the use of
[card-mod](https://github.com/thomasloven/lovelace-card-mod) to style arbitrary
card contents. `card-mod` can be complex to use and relies on the underlying
internal DOM structure to style elements -- as such, while its use is possible
it's not officially supported and no attempt is made to preserve backwards
compatability of the internal DOM between any versions. It'll look good, but you're on your own!

<details>
  <summary>Expand: Use card-mod to style a Picture elements label</summary>

This example changes the color and removes the padding around a [Picture
Elements state
label](https://www.home-assistant.io/lovelace/picture-elements/#state-label).

```yaml
[...]
card_mod:
  style:
    frigate-card-elements $:
      hui-state-label-element $: |
        div {
          padding: 0px !important;
          color: blue;
        }
```
</details>

<a name="card-updates"></a>

## Card Refreshes

Four sets of flags govern when the card will automatically refresh in the
absence of user interaction.

The following table describes the behavior these flags have.

### Card Update Truth Table

| `view . update_seconds` | `view . timeout_seconds` | `view . update_force` | `view . update_entities` | Behavior |
| :-: | :-: | :-: | :-: | - |
| `0` | `0` | *(Any value)* | Unset | Card will not automatically refresh. |
| `0` | `0` | *(Any value)* | *(Any entity)* | Card will reload default view & camera when entity state changes. |
| `0` | `X` seconds | *(Any value)* | Unset | Card will reload default view & camera `X` seconds after user interaction stops. |
| `0` | `X` seconds | `false` | *(Any entity)* | Card will reload default view & camera `X` seconds after user interaction stops, or when entity state changes (as long as user interaction has not occurred in the last `X` seconds). |
| `0` | `X` seconds | `true` | *(Any entity)* | Card will reload default view & camera `X` seconds after user interaction stops or when entity state changes. |
| `Y` seconds | `0` | *(Any value)* | Unset | Card will reload default view & camera every `Y` seconds. |
| `Y` seconds | `0` | *(Any value)* | *(Any entity)* | Card will reload default view & camera every `Y` seconds, or whenever entity state changes. |
| `Y` seconds | `X` seconds | `false` | Unset | Card will reload default view & camera `X` seconds after user interaction stops, and every `Y` seconds (as long as there hasn't been user interaction in the last `X` seconds).  |
| `Y` seconds | `X` seconds | `false` | *(Any entity)* | Card will reload default view & camera `X` seconds after user interaction stops, and every `Y` seconds or whenever entity state changes (in both cases -- as long as there hasn't been user interaction in the last `X` seconds).  |
| `Y` seconds | `X` seconds | `true` | Unset | Card will reload default view & camera `X` seconds after user interaction stops, and every `Y` seconds.  |
| `Y` seconds | `X` seconds | `true` | *(Any entity)* | Card will reload default view & camera `X` seconds after user interaction stops, and every `Y` seconds or whenever entity state changes.  |

### Usecases For Automated Refreshes

 * Refreshing the `live` thumbnails every 30 seconds.
```yaml
view:
  default: live
  update_seconds: 30
```
 * Using `clip` or `snapshot` as the default view (for the most recent clip or
   snapshot respectively) and having the card automatically refresh (to fetch a
   newer clip/snapshot) when an entity state changes. Use the Frigate
   binary_sensor for that camera (or any other entity at your discretion) to
   trigger the update:
```yaml
view:
  update_entities:
    - binary_sensor.office_person_motion
```
 * Cycle the live view of the camera every 60 seconds
```yaml
view:
  update_cycle_camera: true
  update_seconds: 60
```
 * Return to the most recent clip of the default camera 30 seconds after user
   interaction with the card stops.
```yaml
view:
  default: clip
  timeout_seconds: 30
```

## Troubleshooting

<a name="jsmpeg-troubleshooting"></a>

### JSMPEG Live Camera Only Shows A 'spinner'

You must be using a version of the [Frigate integration](https://github.com/blakeblackshear/frigate-hass-integration) >= 2.1.0
to use JSMPEG proxying. The `frigate-jsmpeg` live provider will not work with earlier
integration versions.

### Fullscreen Button Does Not Appear On iPhone

Unfortunately, [iOS does not support the Javascript fullscreen
API](https://caniuse.com/fullscreen). As a result, card-level fullscreen support
for the iPhone is not currently possible.

### Android Will Not Render >4 JSMPEG Live Views

Android Webview (as used by Android Chrome / Android Home Assistant Companion)
appears to severely limit the number of simultaneous OpenGL contexts that can be
opened. The JSMPEG player (that this card uses), consumes 1 OpenGL context per
rendering.

This limitation may be worked around (at a performance penalty) by disabling
OpenGL for JSMPEG live views:

```yaml
live:
  jsmpeg:
    options:
      disableGl: true
```

[This bug](https://github.com/dermotduffy/frigate-hass-card/issues/191) has some
more discussion on this topic. New ideas to address this underlying limitation
most welcome!

### Carousels with video players cannot be dragged in Firefox

The Firefox video player swallows mouse interactions, so dragging is not
possible in carousels that use the Firefox video player (e.g. `clips` carousel,
or live views that use the `frigate` or `webrtc-card` provider). The next and
previous buttons may be used to navigate in these instances.

Dragging works as expected for snapshots, or for the `frigate-jsmpeg` provider.

### Progress bar cannot be dragged in Safari

Dragging the Safari video controls "progress bar" conflicts with carousel "dragging", meaning the video controls progress bar cannot be moved left or right. Turning off carousel dragging (and using next/previous controls) will return full video controls in Safari:

```yaml
live:
  draggable: false
event_viewer:
  draggable: false
```

### `double_tap` does not work for [card-wide actions](#actions) on Android

The Android video player swallows `double_tap` interactions in order to
rewind or fast-forward. Workarounds:

* Use `hold` instead of `double_tap` for your card-wide action.
* Use a [Frigate Card Element](#frigate-card-elements) or menu icon to trigger
  the action instead.

### Console shows 'Offset is out of bounds' / 'Out of bounds memory access'

This is an issue with the JSMPEG live provider and cameras with high-resolutions
/ high-bitrates. [This bug](https://github.com/dermotduffy/frigate-hass-card/issues/189) has much
more discussion on this topic. Some users report success in disabling the WASM-option for JSMPEG like so:

```yaml
live:
  jsmpeg:
    options:
      disableWebAssembly: true
```

Lowering the camera bitrate, and/or increasing the `videoBufferSize` for JSMPEG may also help:

```yaml
live:
  jsmpeg:
    options:
      videoBufferSize: 41943040
```

### Home Assistant iOS App not updating after card version change

Try resetting the app frontend cache:

* `Configuration -> Companion App -> Debugging -> Reset frontend cache`

## Development

### Building

```sh
$ git clone https://github.com/dermotduffy/frigate-hass-card
$ cd frigate-hass-card
$ npm install
$ npm run build
```

Resultant build will be at `dist/frigate-hass-card.js`. This could be installed via the [manual installation instructions above](#manual-installation).

### Releasing

 1. Merge a PR that contains only a `package.json` and `const.ts` version number bump (see [this example](https://github.com/dermotduffy/frigate-hass-card/commit/a854187d4a354f8841ad284d75b0afbed7b634c4)).
 1. Go to the [releases page](https://github.com/dermotduffy/frigate-hass-card/releases).
 1. A release draft will automatically have been created, click 'Edit'.
 1. Use the same version number for the release title and tag.
 1. Choose 'This is a pre-release' for a beta version.
 1. Hit 'Publish release'.
