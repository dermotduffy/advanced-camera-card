# `editor`

These options control the visual card editor.

```yaml
editor:
  # [...]
```

| Option | Default     | Description                                                                                                                                                                                                                                                                                             |
| ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode` | _Automatic_ | Which editor to show. Acceptable values: `simple` for an abbreviated editor that includes bare bones settings or `full` for every option the editor can set. When unset, the `simple` editor is used unless the configuration sets something it does not show, in which case the `full` editor is used. |

## Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
editor:
  mode: simple
```
