There are [security and performance
implications](https://github.com/dermotduffy/hass-web-proxy-integration?tab=readme-ov-file#considerations)
to consider before installing
[hass-web-proxy-integration](https://github.com/dermotduffy/hass-web-proxy-integration)
and using this functionality.

If the
[hass-web-proxy-integration](https://github.com/dermotduffy/hass-web-proxy-integration)
is not detected, the card will fall back to the original URL unless proxying was
explicitly enabled (i.e. set to `true`), in which case an error will be shown.

> [!WARNING]
> When proxying, the card's ability to ensure caching doesn't interfere with
> refresh accuracy depends on what is being proxied. Specifically, `image`
> based proxying will have less reliable behavior because signed URLs cannot
> have additional query parameters added without invalidating the signature. The
> card uses a URL fragment (`#_t=...`) for cache-busting instead, which does not
> affect the signature but is less reliable: the fragment is not sent to the
> server, so the browser may serve a cached response. Reliable refreshing will
> depend on the source server providing appropriate `Cache-Control` headers. The
> Home Assistant companion app's WebView does not re-fetch images when only the
> fragment changes, so proxied image refreshing will not work in the companion
> app.
