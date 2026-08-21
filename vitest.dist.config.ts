import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

import { getBrowsers, type Browser } from './scripts/vitest/browsers.js';
import { distCommands } from './scripts/vitest/dist-commands.js';

// This is the only test suite that runs against the built bundle rather than
// `src/`. They need a build to already exist: run `yarn run build` first.
export default defineConfig({
  // Serves the built card at the root of the page entirely unmodified.
  publicDir: 'dist',

  optimizeDeps: {
    // The npm packages these *tests* use. Vite bundles each one into a single
    // file before the page opens. A package left out is bundled the first time
    // a test imports it, and Vite reloads the page to serve it, failing
    // whichever test was running.
    //
    // Take the list from the `dependencies optimized:` line printed by a run
    // with an empty cache. Subpaths are separate entries (i.e. `lit` does not cover
    // `lit/decorators.js`).
    include: [
      'date-fns',
      'home-assistant-js-websocket',
      'lit',
      'lit/decorators.js',
      'lodash-es',
      'screenfull',
      'vitest-mock-extended',
      'zod',
    ],
  },

  server: {
    // Vite mirrors the page's console into the terminal, which for a mounted
    // card is a stream of Lit development warnings on every run. The page's
    // console is still intercepted in-page, where a test can assert on it.
    forwardConsole: false,
  },

  test: {
    name: 'dist',
    include: ['tests/dist/**/*.browser.test.ts'],

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

      // Functions that run in Node (not in the browser under test). A test
      // calls one from the browser by importing `commands` from
      // `vitest/browser`, and vitest forwards the call and hands back the
      // return value.
      //
      // The browser page cannot read the filesystem, and several assertions
      // here are about the files in `dist/`: which are there, what they hold,
      // and what they import -- so distCommands supports that introspection.
      commands: distCommands,
    },

    // Keep the output clean, as the unit tests do, but hand over everything a
    // failing test wrote: much of what the card reports is written nowhere
    // else, and on CI nobody can look at the card themselves.
    silent: 'passed-only',
  },
});
