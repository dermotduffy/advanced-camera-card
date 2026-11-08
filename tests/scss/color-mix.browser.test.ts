import { describe, expect, it } from 'vitest';

import { MountedCardFactory } from '../browser/mounted-card';
import {
  createGenericCameraHASS,
  createStillImageCardConfig,
} from '../browser/test-utils';

// Theme colors that `color-mixed()` sets twice: a plain value for browsers
// without `color-mix()`, then the mix itself behind a @supports guard. One for
// each fallback it can write -- a mid grey, the color unfaded, and a value the
// caller passed in. See src/scss/color-mix.scss .
const EXAMPLE_MIXED_PROPERTIES = [
  '--advanced-camera-card-timeline-background-item-color',
  '--advanced-camera-card-ptz-color-inactive',
  '--advanced-camera-card-control-background-transparent',
];

describe('a color-mixed property', () => {
  it('should use color-mix rather than the fallback when supported', async () => {
    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig(),
      createGenericCameraHASS(),
    );

    for (const property of EXAMPLE_MIXED_PROPERTIES) {
      expect(getComputedStyle(card.card).getPropertyValue(property)).toContain(
        'color-mix(',
      );
    }
  });
});
