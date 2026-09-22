# Folder Navigation

When a [folder](../configuration/folders.md) is shown in a gallery, the user may
click a subfolder to see its contents and use the `Up` control to go back. This
page describes what the card shows at each step, and how the
[`navigation`](../configuration/folders.md) option changes behavior.

## Folder levels

A folder's [`path`](../configuration/folders.md#path) describes a sequence of
levels in the Home Assistant media hierarchy. Each level may name an exact media
item ([`id`](../configuration/folders.md#path)), filter the items found at that
level ([`matchers`](../configuration/folders.md#matchers)) and extract metadata
from them ([`parsers`](../configuration/folders.md#parsers)). The last level is
the **configured folder**: what the card shows when it loads.

To help illustrate how navigation works, the below examples assume media
organized by room, then by date, with an image alongside each date folder for
the [`thumbnail` parser](../configuration/folders.md#parser-thumbnail) to use.
Your media does not need to be organized like this -- the principles hold
regardless of your media setup.

```
media-source://media_source/
├── Kitchen/
│   ├── 2026-08-28/
│   ├── 2026-08-28.jpg
│   ├── 2026-08-29/
│   ├── 2026-08-29.jpg
│   └── misc/
└── Garage/
    ├── 2026-08-28/
    ├── 2026-08-28.jpg
    └── misc/
```

This configuration shows the contents of `Kitchen`, giving each date folder the
matching image as its thumbnail:

```yaml
folders:
  - type: ha
    title: Kitchen
    ha:
      url: >-
        /media-browser/browser/app%2Cmedia-source%3A%2F%2Fmedia_source/%2Cmedia-source%3A%2F%2Fmedia_source%2Flocal%2FKitchen
      path:
        - parsers:
            - type: thumbnail
```

The levels this configuration internally produces, outermost first:

| Level                         | From             |
| ----------------------------- | ---------------- |
| `media-source://`             | the `url`        |
| `media-source://media_source` | the `url`        |
| `Kitchen`                     | the `url`        |
| The configured folder         | the `path` entry |

The card shows `2026-08-28` and `2026-08-29`, each with its thumbnail, plus
`misc` with no thumbnail. The two thumbnail images are not shown independently,
having become thumbnails of the folders beside them.

## Navigating down

Clicking a subfolder shows its contents. Below the levels specified in the
configuration there is no configuration left to apply -- so no `matchers` nor
`parsers` are assumed (e.g. clicking `misc` shows its contents with no thumbnail
matching because there are no parsers specified for that level).

Adding another entry to `path` would extend the configuration one level deeper.

## Navigating up

The `Up` control returns the user to the folder they came from. Whether they may
continue past the configured folder is set by
[`navigation`](../configuration/folders.md):

| Value                    | Behavior                                                                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `restricted` _(default)_ | The configured folder is the root. `Up` appears only once the user has navigated down into a subfolder, and does not allow navigation up further than the configured folder.       |
| `unrestricted`           | The user may navigate above the configured folder, as far up as the outermost level in the configuration (usually the Home Assistant media root folder when a `url` is specified). |

With the configuration above and the default `restricted`, no `Up` control is
shown until the user clicks into one of the dated folders, or the `misc` folder.

## Navigating above the configured folder

With `unrestricted`, `Up` from the configured folder would show both `Kitchen`
and `Garage`. The configuration is then applied relative to wherever the user
now is, and each `path` option is like so:

| Option     | Above the configured folder                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`       | Ignored. `id` specifies _where_ an exact folder is. The user's navigation has intentionally changed the folder, so only showing folders that match a given `id` would not offer meaningful navigation. |
| `matchers` | Still applied. They describe _which_ media to show.                                                                                                                                                    |
| `parsers`  | Still applied. They describe _how_ to read the media.                                                                                                                                                  |

As such, clicking `Garage` shows its `2026-08-28` folder with `2026-08-28.jpg`
as the thumbnail, exactly as it does for `Kitchen`. This is because the
thumbnail parser in the configuration is for the level below a room, and
`Garage` (like `Kitchen`) is such a room.

> [!NOTE]
> A `matchers` block at or above the level the user has navigated to continues
> to filter (e.g. a folder configured to show only the last three days of media
> will not reveal older media regardless of where the user navigates at or below
> the level that includes that matcher).

If applying the configuration to other rooms is not desirable, either leave
`navigation` at its default (`restricted`), or match the room with a `matchers`
entry rather than `url` or an `id`, like so:

```yaml
folders:
  - type: ha
    title: Kitchen
    ha:
      path:
        - id: media-source://media_source
        - matchers:
            - type: title
              title: Kitchen
        - parsers:
            - type: thumbnail
    navigation: unrestricted
```

In this case, `Up` would show only `Kitchen`, because the matcher still applies
at that level. `Garage` would be excluded.
