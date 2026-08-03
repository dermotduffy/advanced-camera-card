# Browser test public directory

## Why this directory is here

Served at the root of the page the browser tests run in, by way of `publicDir`
in `vitest.browser.config.ts`. Named rather than left at its default of
`public/` in the project root, which is the directory a Vite build copies into
its output: nothing a test needs belongs in a released card.

## Why `mockServiceWorker.js` must not be touched

It is Mock Service Worker's own script, copied here by `msw init`. Do not edit
it and do not rename it: `msw.workerDirectory` in `package.json` records this
path, and installing dependencies copies the script here again from whichever
version of `msw` is installed. That is what stops it going stale against a
version bump, and it also means any local change is lost.

## Why the tests serve media this way

What the tests do with it is in `tests/browser/test-media.ts`: a camera that
fails or goes quiet is answered from within the page, so a request nobody will
ever answer costs no browser connection. That matters because a browser allows
only a handful of connections to one host, and everything the page asks for
afterwards queues behind the ones a test is deliberately holding open. The card
imports some of its own code only when it is needed, so what starves is not
just the next picture but the next module.
