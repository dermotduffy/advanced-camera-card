# `actions`

## Introduction to actions <!-- {docsify-ignore} -->

`actions` is not a top-level configuration block, but can be used as part of
multiple other blocks.

Actions are pre-configured activities that can be triggered in response to a
variety of circumstances (e.g. tapping on a menu icon, double tapping on an
[element](../elements/README.md) or holding the mouse/tap down on a particular
[view](../view.md?id=supported-views)).

### Differences in actions between Advanced Camera Card and Home Assistant

Both the Home Assistant frontend and the Advanced Camera Card cooperate to provide
action functionality. In general, the Advanced Camera Card functionality is a superset
of that offered by stock Home Assistant.

Stock action functionality is used for Stock [Home Assistant picture
elements](https://www.home-assistant.io/lovelace/picture-elements/). Extended
Advanced Camera Card behavior covers all other interactions on the Advanced Camera Card (e.g.
menu icon elements, submenus and actions on the card or views).

#### Custom action types: `start_tap` and `end_tap`

The card has partial support for two special action types `start_tap` and
`end_tap` which occur when a tap is started (e.g. mouse is pressed down /
touch begins), and ended (e.g. mouse released / touch ends) respectively. This
might be useful for PTZ cameras cameras to start/stop movement on touch. Network
latency may introduce unavoidable imprecision between `end_tap` and action
actually occurring.

#### Multiple actions

Extended Advanced Camera Card behavior supports a list of actions instead of a single
action, all of which will be handled. See [an example of multiple
actions](../../examples.md?id=multiple-actions).

## Card and view actions <!-- {docsify-ignore} -->

Actions may be attached to the card itself, to trigger action when the card
experiences a `tap`, `double_tap`, `hold`, `start_tap` or `end_tap` event.
Alternatively they can be configured on a per group-of-views basis, e.g. only
when `live` view is tapped.

| Configuration path      | Views to which it refers               |
| ----------------------- | -------------------------------------- |
| `image.actions`         | `image`                                |
| `live.actions`          | `live`                                 |
| `media_gallery.actions` | `clips`, `snapshots`, `recordings`     |
| `media_viewer.actions`  | `clip`, `snapshot`, `recording`        |
| `view.actions`          | All except `timeline` and `diagnostic` |

If an action is configured for both the whole card (`view.actions`) and a more
specific view (e.g. `live.actions`) then the actions are merged, with the more
specific overriding the less specific.

> [!NOTE]
> The card itself relies on user interactions to function (e.g. `tap` on
> the menu should activate that button). Card or View actions are prevented from
> being activated through standard interaction with menu buttons, next/previous
> controls, thumbnails, etc, but in some cases this prevention is not possible
> (e.g. embedded WebRTC card controls) -- in these cases duplicate actions may
> occur with certain configurations (e.g. `tap`).

> [!NOTE]
> Card-wide actions are not supported on the `timeline` view, `diagnostics`
> view nor when a info/error message is being displayed.

## Actions <!-- {docsify-ignore} -->

| Option                               | Description                         |
| ------------------------------------ | ----------------------------------- |
| [Custom Actions](./custom/README.md) | Custom actions to control the card. |
| [Stock Actions](./stock/README.md)   | Standard Home Assistant actions.    |
