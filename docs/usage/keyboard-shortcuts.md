# Keyboard Shortcuts

There are two ways to have the card respond to key input:

- As a convenience, the card supports a small number of built in shortcuts with pre-defined default bindings. See [Built-in shortcuts](#built-in-shortcuts) for these built in shortcuts. Use the [`keyboard_shortcuts`](../configuration/view.md?id=keyboard_shortcuts) configuration to change their bindings.
- More generally, _any_ [action](../configuration/actions/README.md) can be configured to run in response to keyboard input as part of an [automation](../configuration/automations.md), even if that action does not have a pre-defined shortcut. See [keyboard automation example](../examples.md?id=responding-to-key-input) to show how to execute any arbitrary action(s) in response to keyboard activity.

## How key input is handled

- **The card must have focus.** Key input only reaches the card if the user has
  interacted with it (i.e. click or tab to the card first).
- **Registered keyboard shortcuts will be handled only by the card.** When a key
  matches a built-in shortcut (below) or a [`key`
  trigger](../configuration/conditions-triggers.md?id=key), the browser's own
  behavior for that key is suppressed (to ensure that pressing `ArrowDown` pans
  the camera without also scrolling the dashboard). Keys with no binding are
  left entirely to the browser.
  - **A `key` trigger with no `key` property is an exception.** Such a trigger
    fires on _every_ key, so no suppression occurs to preserve the browser
    behavior in the general case (e.g. `Tab` still moves focus).
- **Keys typed into an input field are otherwise ignored.** Key strokes aimed at
  intentional inputs (e.g. a text box or dropdown) do not trigger card actions /
  automations.

## Built-in shortcuts

Built in keyboard shortcuts can be disabled through the [`keyboard_shortcuts` configuration](../configuration/view.md?id=keyboard_shortcuts).

| Name           | Default key binding | Action                                                                | Description         |
| -------------- | ------------------- | --------------------------------------------------------------------- | ------------------- |
| `ptz_down`     | `ArrowDown`         | [`ptz_multi`](../configuration/actions/custom/README.md?id=ptz_multi) | PTZ move down.      |
| `ptz_home`     | `h`                 | [`ptz_multi`](../configuration/actions/custom/README.md?id=ptz_multi) | PTZ home / default. |
| `ptz_left`     | `ArrowLeft`         | [`ptz_multi`](../configuration/actions/custom/README.md?id=ptz_multi) | PTZ move left.      |
| `ptz_right`    | `ArrowRight`        | [`ptz_multi`](../configuration/actions/custom/README.md?id=ptz_multi) | PTZ move right.     |
| `ptz_up`       | `ArrowUp`           | [`ptz_multi`](../configuration/actions/custom/README.md?id=ptz_multi) | PTZ move up.        |
| `ptz_zoom_in`  | `+`                 | [`ptz_multi`](../configuration/actions/custom/README.md?id=ptz_multi) | PTZ zoom in.        |
| `ptz_zoom_out` | `-`                 | [`ptz_multi`](../configuration/actions/custom/README.md?id=ptz_multi) | PTZ zoom out.       |
