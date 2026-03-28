# `image`

Configure the `image` view.

```yaml
image:
  # [...]
```

| Option              | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actions`           |         | [Actions](actions/README.md) to use for the `image` view.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `entity`            |         | The entity to use when `mode` is set to `entity`. This entity is expected to have an `entity_picture` attribute that specifies the image URL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `entity_parameters` |         | Optional URL parameters to add to the URL generated for entity-based modes (i.e. when `mode` is `camera` or `entity`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `mode`              | `auto`  | Value must be one of `url` (to fetch an arbitrary image URL), `camera` (to show a still of the currently selected camera entity using either `camera_entity` or `webrtc_card.entity` in that order of precedence), `entity` (to show an image associated with a named entity, see the `entity` parameter below), `default` (to show the [default embedded image](https://github.com/dermotduffy/advanced-camera-card/blob/main/src/images/iris-screensaver.jpg)), or `screensaver` (to show a random image from [picsum.photos](https://picsum.photos/), refreshing every 60s by default). If `auto`, the mode is chosen automatically based on whether `url` or `entity` parameters have been specified. |
| `proxy`             |         | Proxy configuration for `url` mode images. See [proxy](#proxy) below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `refresh_seconds`   | `auto`  | The image will be refreshed at least every `refresh_seconds` (it may refresh more frequently, e.g. whenever Home Assistant updates its camera security token). `0` implies no refreshing. When set to `auto`, uses `1` for all modes except `screensaver` which uses `60`.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `url`               |         | A static image URL to be used when the `mode` is set to `url` or when a temporary image is required (e.g. may appear momentarily prior to load of a camera snapshot in the `camera` mode). Note that a `_t=[timestamp]` cache-busting value will be added automatically.                                                                                                                                                                                                                                                                                                                                                                                                                                  |

> [!NOTE]
> When `mode` is set to `camera` this is effectively providing the same image as the `image` [live provider](cameras/live-provider.md) would show in the live camera carousel.

[](common/screensaver-warning.md ':include')

## `proxy`

Configures whether and how the image URL is proxied via
[hass-web-proxy-integration](https://github.com/dermotduffy/hass-web-proxy-integration)
(this must be installed separately). This is useful when the image URL uses HTTP
but Home Assistant is served over HTTPS, which would otherwise be blocked by the
browser as [mixed
content](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content).

```yaml
image:
  proxy:
    # [...]
```

[](common/proxy-warning.md ':include')

| Option             | Default | Description                                                                                                                                                                                                                                                               |
| ------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`          | `false` | Whether or not to proxy image URLs when in `url` mode. `true` to proxy (will show an error if the proxy integration is unavailable), `false` to not proxy.                                                                                                                |
| `dynamic`          | `true`  | Whether to dynamically (at the time) request proxying of the required URL, or rely on statically user-configured pre-existing proxying. See the [hass-web-proxy-integration documentation](https://github.com/dermotduffy/hass-web-proxy-integration).                    |
| `ssl_verification` | `auto`  | Whether to verify the validity of SSL certificates. If `true` always verifies, if `false` never verifies and if `auto` defaults to `true`.                                                                                                                                |
| `ssl_ciphers`      | `auto`  | Whether to use `default`, `intermediate`, `insecure` or `modern` SSL ciphers. See the [Home Assistant code](https://github.com/home-assistant/core/blob/dev/homeassistant/util/ssl.py) for the precise list of SSL ciphers each implies. If `auto` defaults to `default`. |

## Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
image:
  mode: auto
  refresh_seconds: auto
  url: 'https://path/to/image.png'
  entity: image.office_person
  entity_parameters: 'width=400&height=200'
  proxy:
    enabled: false
    dynamic: true
    ssl_verification: auto
    ssl_ciphers: auto
  actions:
    entity: light.office_main_lights
    tap_action:
      action: none
    hold_action:
      action: none
    double_tap_action:
      action: none
    start_tap_action:
      action: none
    end_tap_action:
      action: none
```
