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
const INCLUSIONS = [`${TEST_DIRECTORY}/**/*.test.ts`];

// For test performance reasons, tests are split into two groups:
//
// - `shared`: run non-isolated, so they share one loaded copy of the source
//   tree instead of each re-importing it.
// - `isolated`: given their own module registry per file, because sharing one
//   would change their behaviour. A file calling `vi.mock()` cannot replace a
//   module an earlier file already loaded unmocked; a file loading the template
//   renderer reads browser globals as the renderer loads; and a file needing a
//   DOM leaves modules holding a `window` that is torn down when it finishes,
//   which breaks any later file that reaches one of those modules.
//
// Absent this variable every test file runs isolated, which is both the safe
// default and what coverage requires (istanbul only counts a module's top-level
// code the first time it runs).
const GROUP = process.env.VITEST_GROUP;

const findTestFiles = (directory: string): string[] => {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTestFiles(path));
    } else if (entry.name.endsWith('.test.ts')) {
      files.push(path);
    }
  }
  return files;
};

const REQUIRE_ISOLATION_REGEXP =
  /\bvi\.(do)?mock\(|loadRenderer|stubConnectedHomeAssistant|@vitest-environment\s+jsdom/;

const getGroup = (file: string): string =>
  REQUIRE_ISOLATION_REGEXP.test(readFileSync(file, 'utf-8')) ? 'isolated' : 'shared';

const getInclusions = (): string[] =>
  GROUP
    ? findTestFiles(TEST_DIRECTORY).filter((file) => getGroup(file) === GROUP)
    : INCLUSIONS;

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
    include: getInclusions(),

    // Forked child processes start and tear down faster here than worker
    // threads, which matters when every test file needs a fresh one.
    pool: 'forks',

    isolate: !GROUP || GROUP === 'isolated',

    // Hide console writing to keep output clean, usual sources of noise:
    // - Unnecessary Lit dev-mode warnings.
    // - Various console outputs (that are expected/tested).
    onConsoleLog: () => false,

    coverage: {
      exclude: EXCLUSIONS,

      // Favor istanbul for coverage over v8 due to better accuracy.
      provider: 'istanbul',
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
