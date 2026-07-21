# Custom Icons

The card registers an `advanced-camera-card` iconset with Home Assistant,
providing a small set of builtin icons not found in the traditional [Material
Design Icons (`mdi`)](https://pictogrammers.com/library/mdi/) set. Once the
card resource is loaded, these icons work in _any_ Home Assistant icon field
(inside or outside this card, e.g. an entity icon) and appear in the Home
Assistant icon picker.

| Icon Name                        | Resulting Icon                                                              |
| -------------------------------- | --------------------------------------------------------------------------- |
| `advanced-camera-card:frigate`   | ![Frigate Icon](../images/icons/frigate.svg ':size=24 :class=svg-icon')     |
| `advanced-camera-card:iris`      | ![Iris Icon](../images/icons/iris.svg ':size=24 :class=svg-icon')           |
| `advanced-camera-card:motioneye` | ![motionEye Icon](../images/icons/motioneye.svg ':size=24 :class=svg-icon') |
| `advanced-camera-card:reolink`   | ![Reolink Icon](../images/icons/reolink.svg ':size=24 :class=svg-icon')     |
| `advanced-camera-card:tplink`    | ![TPLink Icon](../images/icons/tplink.svg ':size=24 :class=svg-icon')       |

?> For backwards compatibility, icon fields within this card (e.g.
[`menu`](../configuration/menu.md) and
[`status_bar`](../configuration/status-bar.md) items) also accept the bare
legacy names (`frigate`, `iris`, `motioneye`, `reolink`, `tplink`).
