# Card editor

![Architecture of the card editor](architecture.svg)

The SVG is also its own editable source: it embeds the draw.io diagram, so open
`architecture.svg` directly in draw.io / diagrams.net to change it.

## Maintaining the diagram

`architecture.svg` is a dual file: the **rendered SVG** (shown above / in
GitHub) plus the **editable mxGraph XML** embedded in its `content="..."`
attribute. Keep them in sync -- never commit an SVG whose embedded XML changed
but whose rendered picture did not, or the image above goes stale.
