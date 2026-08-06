import { describe, expect, it } from 'vitest';

import { MountedCardFactory } from '../browser/mounted-card';
import {
  createGenericCameraHASS,
  createStillImageCardConfig,
} from '../browser/test-utils';

// A colour the dark theme sets and the card carries no other way. Reading it
// back proves the stylesheet reached the card rather than merely compiling.
// See src/scss/themes/dark.scss .
const DARK_PRIMARY_BACKGROUND = '#111111';

const mountThemed = async (themes: string[]) =>
  await MountedCardFactory.createFromSource(
    createStillImageCardConfig({ view: { theme: { themes } } }),
    createGenericCameraHASS(),
  );

describe('themes', () => {
  it('should style the card from the theme it is configured with', async () => {
    const card = await mountThemed(['dark']);
    await card.waitForRender(
      () => card.card.getAttribute('themes'),
      'the card being given its themes',
    );

    expect(
      getComputedStyle(card.card).getPropertyValue('--primary-background-color').trim(),
    ).toBe(DARK_PRIMARY_BACKGROUND);
  });

  it('should not style the card from a theme it is not configured with', async () => {
    const card = await mountThemed(['light']);
    await card.waitForRender(
      () => card.card.getAttribute('themes'),
      'the card being given its themes',
    );

    expect(
      getComputedStyle(card.card).getPropertyValue('--primary-background-color').trim(),
    ).not.toBe(DARK_PRIMARY_BACKGROUND);
  });
});
