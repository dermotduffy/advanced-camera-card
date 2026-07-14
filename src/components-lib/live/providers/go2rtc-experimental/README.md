# go2rtc-experimental provider

![Architecture of the go2rtc-experimental provider](architecture.drawio.svg)

The SVG is also its own editable source: it embeds the draw.io diagram, so open
`architecture.drawio.svg` directly in draw.io / diagrams.net to change it.

## Maintaining the diagram

`architecture.drawio.svg` is a dual file: the **rendered SVG** (shown above /
in GitHub) plus the **editable mxGraph XML** embedded in its `content="..."`
attribute. Keep them in sync -- never commit an SVG whose embedded XML changed
but whose rendered picture did not, or the image above goes stale.
