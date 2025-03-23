# Grid Layout Algorithm

When display mode (in [`live`](live.md?id=display) or
[`media_viewer`](media-viewer.md?id=display) views) is set to `grid`, this
algorithm is used to control the layout.

## Layout Order

Cameras are laid out horizontally in the order they are specified in the config,
first to last. The card may tweak item positioning in order to optimize grid
'density'.

In addition, if the `grid_selected_position` parameter is `first` or `last`, the
selected camera is always laid out first (at the top) or last (at the bottom) of
the layout.

## Number of columns in the grid

The following algorithm is used to calculate the number of columns. This
attempts to offers a balance between configurability, reasonable display in a
typical Lovelace card width and reasonable display in a typical fullscreen
display.

- Use `grid_columns` if specified.
- Otherwise, use the largest number of columns in the range `[2 -
grid_max_columns]` that will fit at least a `600px` column width.
- Otherwise, use the largest number of columns in the range `[2 -
grid_max_columns]` that will fit at least a `190px` column width.
- Otherwise, there will be `1` column only.
