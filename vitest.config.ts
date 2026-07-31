import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { defineConfig } from 'vitest/config';

import { svgPath } from './scripts/svg-path-plugin.js';

const EXCLUSIONS = [
  '.eslintrc.cjs',
  'docs/**',
  'tests/**',

  // Web-components.
  'src/card.ts',
  'src/components/**/*.ts',
  'src/editor.ts',

  // Timeline controller (can be added later).
  'src/components-lib/timeline/controller.ts',

  // HA patches.
  'src/patches/**/*.ts',
];

const TEST_DIRECTORY = 'tests';

// Tests that mount the card in a real browser. They run from
// `vitest.browser.config.ts` and cannot run in any of the projects below, so
// they are kept out of the sweep.
const BROWSER_TEST_SUFFIX = '.browser.test.ts';

const findTestFiles = (directory: string): string[] => {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTestFiles(path));
    } else if (
      entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith(BROWSER_TEST_SUFFIX)
    ) {
      files.push(path);
    }
  }
  return files;
};

// Each test file is read and sorted into one of the projects below, which
// explain what these two properties cost.
const REQUIRE_ISOLATION_REGEXP = /\bvi\.(do)?mock\(/;
const REQUIRE_DOM_REGEXP = /@vitest-environment\s+jsdom/;

const getGroup = (file: string): string => {
  const contents = readFileSync(file, 'utf-8');
  if (REQUIRE_ISOLATION_REGEXP.test(contents)) {
    return 'isolated';
  }
  return REQUIRE_DOM_REGEXP.test(contents) ? 'shared-jsdom' : 'shared-node';
};

const getInclusions = (group: string): string[] =>
  findTestFiles(TEST_DIRECTORY).filter((file) => getGroup(file) === group);

export default defineConfig({
  plugins: [svgPath()],
  test: {
    server: {
      deps: {
        // These dependencies import without extensions.
        // Related: https://github.com/vitest-dev/vitest/issues/2313
        inline: ['ha-nunjucks', 'ts-py-datetime'],
      },
    },

    // Forked child processes start and tear down faster here than worker
    // threads, which matters when every test file needs a fresh one.
    pool: 'forks',

    // Importing the source tree costs far more than running the tests in it, so
    // files are grouped by whether they can share one loaded copy of it. Each
    // project below is a group that can, or the one that cannot.
    projects: [
      {
        extends: true,
        test: {
          // Nothing stops these sharing, so they run against a single loaded
          // copy of the source tree. Most of the suite is here, and anything
          // moved out of here pays to import that tree again.
          name: 'shared',
          include: getInclusions('shared-node'),
          isolate: false,
        },
      },
      {
        extends: true,
        test: {
          // These share too, but only with each other. A module loaded under
          // jsdom holds a reference to that DOM, so a worker that moves from a
          // DOM file to a non-DOM one drops its loaded copy of the source tree
          // and imports it again. A project's files are spread across workers
          // without regard to environment, so putting both kinds in one project
          // leaves every worker alternating between them and reloading as it
          // goes, and the more workers there are the more often that happens. A
          // project per environment hands each worker a run of files that all
          // want the same one. The file-level `@vitest-environment jsdom`
          // comments are what sort files into here, and are redundant once they
          // arrive.
          //
          // They share one `document` as well, so a file that redefines part of
          // it must leave the property configurable for the files that follow.
          name: 'shared (jsdom)',
          include: getInclusions('shared-jsdom'),
          environment: 'jsdom',
          isolate: false,
        },
      },
      {
        extends: true,
        test: {
          // `vi.mock()` cannot replace a module that an earlier file already
          // loaded unmocked, so these cannot share a loaded source tree with
          // anything, including each other. They get a registry per file and
          // pay the full import cost.
          name: 'isolated',
          include: getInclusions('isolated'),
          isolate: true,
        },
      },
    ],

    // Hide console writing to keep output clean, usual sources of noise:
    // - Unnecessary Lit dev-mode warnings.
    // - Various console outputs (that are expected/tested).
    onConsoleLog: () => false,

    coverage: {
      exclude: EXCLUSIONS,

      // 'v8' reads coverage from the JavaScript engine, so it runs about twice
      // as fast as 'istanbul', which has to rewrite every source file first.
      // Known gap: 'istanbul' will flag a default parameter value that no test
      // ever falls back on -- 'v8' will not, but it is not worth the
      // significant performance slowdown to cover this rare case.
      provider: 'v8',
      thresholds: {
        perFile: true,
        'src/**/*.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
});
