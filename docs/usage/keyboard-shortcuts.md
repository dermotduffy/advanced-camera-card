# Keyboard Shortcuts

There are two ways to have the card respond to key input:

- As a convenience, the card supports a small number of built in shortcuts with pre-defined default bindings. See [Built-in shortcuts](#built-in-shortcuts) for these built in shortcuts. Use the [`keyboard_shortcuts`](../configuration/view.md?id=keyboard_shortcuts) configuration to change their bindings.
- More generally, _any_ [action](../configuration/actions/README.md) can be configured to run in response to keyboard input as part of an [automation](../configuration/automations.md), even if that action does not have a pre-defined shortcut. See [keyboard automation example](../examples.md?id=responding-to-key-input) to show how to execute any arbitrary action(s) in response to keyboard activity.

## Built-in shortcuts

| Name           | Default key binding | Action                                                                | Description         |
| -------------- | ------------------- | --------------------------------------------------------------------- | ------------------- |
| `ptz_down`     | `ArrowDown`         | [`ptz_multi`](../configuration/actions/custom/README.md?id=ptz_multi) | PTZ move down.      |
| `ptz_home`     | `h`                 | [`ptz_multi`](../configuration/actions/custom/README.md?id=ptz_multi) | PTZ home / default. |
| `ptz_left`     | `ArrowLeft`         | [`ptz_multi`](../configuration/actions/custom/README.md?id=ptz_multi) | PTZ move left.      |
| `ptz_right`    | `ArrowRight`        | [`ptz_multi`](../configuration/actions/custom/README.md?id=ptz_multi) | PTZ move right.     |
| `ptz_up`       | `ArrowUp`           | [`ptz_multi`](../configuration/actions/custom/README.md?id=ptz_multi) | PTZ move up.        |
| `ptz_zoom_in`  | `+`                 | [`ptz_multi`](../configuration/actions/custom/README.md?id=ptz_multi) | PTZ zoom in.        |
| `ptz_zoom_out` | `-`                 | [`ptz_multi`](../configuration/actions/custom/README.md?id=ptz_multi) | PTZ zoom out.       |
