# `folders`

[](./common/experimental-warning.md ':include')

The `folders` stanza is used for configuring folders from which media/subfolders may be viewed.

?> To configure the behavior of the gallery in which folders are displayed, see the [`media_gallery` configuration](./media-gallery.md).

```yaml
folders:
  # [...]
```

| Option  | Default | Description                                                                                                                                    |
| ------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`    |         | An optional folder `id` which can be used by the [`folder` action](./actions/custom/README.md?id=folder) to show a particular folder contents. |
| `ha`    |         | Options for `ha` folder types. See below.                                                                                                      |
| `icon`  |         | An optional folder icon.                                                                                                                       |
| `title` |         | An optional folder title.                                                                                                                      |
| `type`  | `ha`    | The type of folder, `ha` for Home Assistant media folders (currently the only supported type of folder).                                       |

## `ha`

Used to specify a path to Home Assistant media.

```yaml
folders:
  - type: ha
    ha:
      # [...]
```

| Option | Default                     | Description                                                                                                                                                                                     |
| ------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`  |                             | An optional Home Assistant `Media` browser URL to use as the query base. If `path` is also specified, those matchers/parsers are applied against folders "below" the folder specified in `url`. |
| `path` | [`{ id: media-source:// }`] | An optional array of parsers and matchers to dynamically compare and extract metadata from the Home Assistant media folder hierarchy. See below.                                                |

?> `url` is never fetched, nor sent over the network. It is only processed
locally in your browser. The host part of the URL can optionally be removed.

### `path`

An array of values that represents the path to a Home Assistant media item, e.g.
a media item at a path of `one/two/three` would be represented by a path array
of length three.

| Option     | Default | Description                                                                                                                                                    |
| ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`       |         | An optional exact media item to select, usually the parent of where `matchers` and `parsers` should apply.                                                     |
| `matchers` |         | An optional array of matchers to evaluate whether to return a given media item. If no matcher is specified, everything in the given folder matches. See below. |
| `parsers`  |         | An optional array of parsers that extract data out of a media item. See below.                                                                                 |

If `url` is also specified, parsers/matchers are applied starting at that
folder, otherwise they are applied from the media source root (i.e.
`media-source://`).

```yaml
folders:
  - type: ha
    ha:
      path:
        # [...]
```

?> To match everything at a given level whilst parsing nothing would simply be
represented by an empty object `{}`

#### Matchers

Matches are used to match a given media item. Multiple matchers may be specified
to perform multiple tests. A given match may match multiple items. If an item
does not match, it will not be returned to the user nor (in case of subfolders)
feature in future traversals.

##### Matcher: `or`

Match if any single matcher matches.

```yaml
type: or
# [...]
```

| Parameter | Description                                                  |
| --------- | ------------------------------------------------------------ |
| `type`    | Must be `or`.                                                |
| `matches` | An array of other matchers only one of which needs to match. |

##### Matcher: `title`

Match against the media item title.

```yaml
type: title
# [...]
```

| Parameter | Description                                                          |
| --------- | -------------------------------------------------------------------- |
| `type`    | Must be `title`.                                                     |
| `regexp`  | An optional regular expression to match against the title.           |
| `title`   | An optional exact value (case-sensitive) to match against the title. |

#### Parsers

Parsers are used to extract data from a media item (e.g. an event start time).
Parsed data is propagated down the hierarcy, e.g. a given media item inherits
the metadata of its parents.

##### Parser `date` / `startdate`

Parses a start date from a media title. `date` is an convenient alias for
`startdate`.

```yaml
type: date
# [...]
```

| Parameter | Description                                                                                                                                                                                                                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`    | Must be `date` or `startdate`.                                                                                                                                                                                                                                                                              |
| `format`  | A [`date-fns` format string](https://date-fns.org/docs/parse). If unspecified, [`any-date-parser`](https://www.npmjs.com/package/any-date-parser) is used to parse a date and/or time which covers many common cases. In the event of missing or inaccurate metadata, specifying a precise format may help. |
| `regexp`  | An optional regular expression to first match the title against before parsing. May be used to match against a subset of the string, see [tip below](#regular-expression-matching).                                                                                                                         |

## Advanced

### Regular Expression Matching

For `matchers` and `parsers` that support the `regexp` option, it may be used to
compare against only a portion of the media title. By default, that portion is
whatever part of the title matches the given regexp. For extra-precision, use a
named regexp group called `value`.

For example, pulling time values out of a media title, before parsing them with
a `HH:mm:ss` format.

```yaml
parsers:
  - type: date
    regexp: "\d{2}:\d{2}:\d{2}"
    format: HH:mm:ss
```

Similarly, this example uses a named group to refer to the text at the end of
the title.

```yaml
parsers:
  - type: date
    regexp: '^Time: (?<value>.*)+'
    format: HH:mm:ss
```

In this contrived example, the regular expression is used to extract either
`Low` or `High` from the title, and then match only the `High` entry.

```yaml
matchers:
  - type: title
    regexp: '(?<value>Low|High) Resolution'
    title: High
```

### Understanding Media Source IDs and "parent folders"

Home Assistant Media Source IDs are typically long integration-specific non-user
friendly strings that refer to a media item, or folder of media items. Media
source "folders" do not have an intrinsic parent as with filesystem folders,
rather a trail is built as the user navigates "downwards" -- but anything could
theoretically be the parent of anything.

## Worked Example

Imagine a media folder hierarchy that starts with a choice of resolution (Low or
High). Lets start by specifying a basic folder referring to the URL of the Home
Assistant Media Browser for that folder (via copy and paste of the URL from
another browser window with the folder open):

```yaml
folders:
  - type: ha
    ha:
      url: >-
        /media-browser/browser/app%2Cmedia-source%3A%2F%2Freolink/playlist%2Cmedia-source%3A%2F%2Freolink%2FCAM%7C01J8XAATNH77WE5D654K07KY1F%7C0
```

The result:

![](../images/folder-hierarchy-1.png 'Folder Hierarchy 1 :size=400')

Now lets include selecting the High resolution folder:

```yaml
folders:
  - type: ha
    ha:
      url: >-
        /media-browser/browser/app%2Cmedia-source%3A%2F%2Freolink/playlist%2Cmedia-source%3A%2F%2Freolink%2FCAM%7C01J8XAATNH77WE5D654K07KY1F%7C0
      # Added below:
      path:
        - matchers:
            - type: title
              title: High resolution
```

The result:

![](../images/folder-hierarchy-2.png 'Folder Hierarchy 2 :size=400')

The next step is to navigate down to the date folder, parsing the date as we go
(auto-detecting the format):

```yaml
folders:
  - type: ha
    ha:
      url: >-
        /media-browser/browser/app%2Cmedia-source%3A%2F%2Freolink/playlist%2Cmedia-source%3A%2F%2Freolink%2FCAM%7C01J8XAATNH77WE5D654K07KY1F%7C0
      path:
        - matchers:
            - type: title
              title: High resolution
        # Added below:
        - parsers:
            - type: startdate
```

The result:

![](../images/folder-hierarchy-3.png 'Folder Hierarchy 3 :size=400')

The final step is to navigate down to the media item themselves, automatically parsing the time out of them:

```yaml
folders:
  - type: ha
    ha:
      url: >-
        /media-browser/browser/app%2Cmedia-source%3A%2F%2Freolink/playlist%2Cmedia-source%3A%2F%2Freolink%2FCAM%7C01J8XAATNH77WE5D654K07KY1F%7C0
      path:
        - matchers:
            - type: title
              title: High resolution
        - parsers:
            - type: startdate
        # Added below:
        - parsers:
            - type: startdate
```

The final result:

![](../images/folder-hierarchy-4.png 'Folder Hierarchy 2 :size=400')

### Other Examples

See [Folder Examples](../examples.md?id=folders).

## Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
folders:
  - type: ha
    ha:
      url: https://my-ha-instance.local/media-browser/browser/app%2Cmedia-source%3A%2F%2Ffrigate
      path:
        - id: 'media-source://'
        - matchers:
            - type: title
              regexp: (?<value>.*) resolution
              title: Low
        - parsers:
            - type: date
              format: yyyy/MM/dd
        - parsers:
            - type: startdate
              format: HH:mm:ss
              regexp: 'File (?<value>.*)'
  - type: ha
    ha:
      path:
        - id: 'media-source://'
        - matchers:
            - type: template
              value_template: "{{ acc.media.title == now().strftime('%Y/%-m/%d') }}"
```
