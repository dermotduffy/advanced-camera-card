import { defineConfig } from 'vitest/config';

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

const INCLUSIONS = ['tests/**/*.test.ts'];

// ts-prune-ignore-next
export default defineConfig({
  test: {
    server: {
      deps: {
        // These dependencies import without extensions.
        // Related: https://github.com/vitest-dev/vitest/issues/2313
        inline: ['ha-nunjucks', 'ts-py-datetime'],
      },
    },
    include: INCLUSIONS,
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
