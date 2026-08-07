# Browser test fixtures

The media the browser tests serve to the card, at the paths and names built by
`tests/browser/fixtures.ts`. Most requests reach them directly from the Vite dev
server. A test that needs a camera to misbehave gets copies from
`tests/browser/test-media.ts` instead.

## `still-red.png`

A 320x180 red image, 16:9. Everything the card draws as a still image: a
snapshot in the viewer, or a live view built from stills.

## `clip.webm`

Ten seconds of red at 64x48, VP8. Ten seconds so a test can watch it play
without it ending under the assertion.

WebM rather than the MP4 (what a real camera integration likely serves), because
nothing available offline encodes H.264: Playwright's bundled `ffmpeg` has
libvpx only. This does not change what is under test -- every non-HLS video
takes the same branch.

Rebuild it with ImageMagick and the `ffmpeg` Playwright installs alongside its
browsers:

```sh
convert tests/browser/fixtures/still-red.png -resize 64x48! /tmp/frame.jpg

for i in $(seq 100);
do
  cat /tmp/frame.jpg;
done > /tmp/frames.mjpeg

~/.cache/ms-playwright/ffmpeg-*/ffmpeg-linux -f image2pipe -vcodec mjpeg -r 10 \
  -i /tmp/frames.mjpeg -c:v libvpx -b:v 50k tests/browser/fixtures/clip.webm
```
