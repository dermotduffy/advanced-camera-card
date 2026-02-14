import { defineConfig } from 'vitest/config';

// These globs are expected to have 100% coverage.
const FULL_COVERAGE = [
  'src/camera-manager/*.ts',
  'src/camera-manager/browse-media/camera.ts',
  'src/camera-manager/browse-media/utils/*.ts',
  'src/camera-manager/frigate/camera.ts',
  'src/camera-manager/frigate/requests.ts',
  'src/camera-manager/frigate/util.ts',
  'src/camera-manager/frigate/watcher.ts',
  'src/camera-manager/generic/*.ts',
  'src/camera-manager/reolink/*.ts',
  'src/camera-manager/utils/**/*.ts',
  'src/card-controller/**/*.ts',
  'src/components-lib/**/*.ts',
  'src/conditions/**/*.ts',
  'src/config/**/*.ts',
  'src/const.ts',
  'src/ha/**/*.ts',
  'src/types.ts',
  'src/utils/**/*.ts',
  'src/view/*.ts',
];

const EXCLUSIONS = [
  '.eslintrc.cjs',
  'docs/**',
  'src/components-lib/timeline/controller.ts',
  'tests/**',
];

const INCLUSIONS = ['tests/**/*.test.ts'];

interface Threshold {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  perFile: boolean;
}

const fullCoverage: Threshold = {
  statements: 100,
  branches: 100,
  functions: 100,
  lines: 100,
  perFile: true,
};

const calculateFullCoverageThresholds = (): Record<string, Threshold> => {
  return FULL_COVERAGE.reduce((a, v) => ({ ...a, [v]: fullCoverage }), {});
};

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
        ...calculateFullCoverageThresholds(),
      },
    },
  },
});
