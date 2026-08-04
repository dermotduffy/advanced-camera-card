import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

import { getBrowsers, type Browser } from './scripts/browsers.js';
import { svgPath } from './scripts/svg-path-plugin.js';

// Browser tests mount the real card in a browser. Their own config rather than
// a fourth project in `vitest.config.ts`, because `vitest run` executes every
// project: they would become a way to satisfy the 100% per-file thresholds.
export default defineConfig({
  // Tests import `src/` directly rather than a built bundle, so Vite has to
  // supply the same asset shape the build's plugin does: an SVG becomes the
  // `{ path, viewBox }` a custom iconset serves. `svgPath` is the build's own
  // plugin, reused unchanged.
  plugins: [svgPath()],

  // Where the Mock Service Worker script is served from, which Vite serves at
  // the root of the page. Named rather than left at its default of `public/` in
  // the project root, which is the directory a Vite build copies into its
  // output: nothing a test needs belongs in a released card.
  //
  // See tests/browser/public/README.md .
  publicDir: 'tests/browser/public',

  resolve: {
    // Several dependencies declare their own Lit. Two copies in one page do not
    // recognise each other's directives and template results, which surfaces as
    // "Multiple versions of Lit loaded" followed by render-time type errors.
    // The build gets one copy from its own resolver; the tests have to be told.
    dedupe: ['lit', 'lit-html', 'lit-element', '@lit/reactive-element'],
  },

  optimizeDeps: {
    // `dedupe` above is not enough on its own: Vite also bundles dependencies
    // ahead of time, and each of those bundles carries its own copy of Lit.
    // Listed here, they are served as source and import the same Lit as `src/`.
    exclude: [
      '@lit-labs/scoped-registry-mixin',
      '@lit-labs/task',
      '@lit/reactive-element',
      'lit',
      'lit-element',
      'lit-html',
    ],
  },

  server: {
    // Vite mirrors the page's console into the terminal, which for a mounted
    // card is a stream of Lit development warnings on every run. The page's
    // console is still intercepted in-page, where a test can assert on it.
    forwardConsole: false,
  },

  css: {
    preprocessorOptions: {
      scss: {
        // A couple of stylesheets are pulled in by package name (e.g. `@use
        // '@graphiteds/core/css/core.css'`). sass resolves a bare name like
        // that only if node_modules is on its load path. The build sets the
        // same load path.
        loadPaths: ['./node_modules/'],
      },
    },
  },

  test: {
    name: 'browser',
    include: ['tests/**/*.browser.test.ts'],

    // The tests under `tests/dist` need a card build to exist (in dist/), which
    // this suite does not require. They have their own config, see
    // vitest.dist.config.ts .
    exclude: ['tests/dist/**'],

    // Cosmetic: Style the pages as HA does for screenshots.
    setupFiles: ['./tests/browser/style.ts'],

    // A failing test leaves a screenshot and any attachments behind. Both
    // default to somewhere else -- a `__screenshots__` directory next to the
    // test file, and `.vitest-attachments` at the root -- so they are pointed
    // at one directory that `.gitignore` can name once.
    attachmentsDir: '.vitest/attachments',

    // When to name a test in the output for taking too long. Browser tests blow
    // past the default of 300ms.
    slowTestThreshold: 10000,

    server: {
      deps: {
        // These dependencies import without extensions.
        // Related: https://github.com/vitest-dev/vitest/issues/2313
        inline: ['ha-nunjucks', 'ts-py-datetime'],
      },
    },

    browser: {
      enabled: true,
      provider: playwright(),

      headless: true,

      // An ordinary desktop window. The default is a phone (414x896), which
      // would put every test on the card's narrow-screen paths and crop the
      // screenshot taken when one fails.
      viewport: { width: 1280, height: 800 },

      instances: getBrowsers().map((browser: Browser) => ({ browser })),

      screenshotDirectory: '.vitest/screenshots',
    },

    // Keep the output clean, as the unit tests do, but hand over everything a
    // failing test wrote: much of what the card reports is written nowhere
    // else, and on CI nobody can look at the card themselves.
    silent: 'passed-only',
  },
});
