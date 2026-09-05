import { describe, expect, it } from 'vitest';

import type { RawAdvancedCameraCardConfig } from '../../src/config/types';
import { deepQuery } from '../browser/dom';
import { MountedCardFactory } from '../browser/mounted-card';
import {
  createGenericCameraHASS,
  createStillImageCameraConfig,
  createStillImageCardConfig,
} from '../browser/test-utils';

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

// The color a test configures, in the form `getComputedStyle` reports it back.
const CONFIGURED_BACKGROUND = 'rgb(0, 128, 0)';

const getIcon = (button: HTMLElement): Element | null =>
  deepQuery(button, 'advanced-camera-card-icon');

describe('AdvancedCameraCardMenu', () => {
  it('should apply a configured style to the button', async () => {
    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        menu: {
          style: 'outside',
          buttons: { live: { style: { background: CONFIGURED_BACKGROUND } } },
        },
      }),
      createGenericCameraHASS(),
    );

    const button = await card.findControl('Live view');

    const icon = getIcon(button);

    expect(getComputedStyle(button).backgroundColor).toBe(CONFIGURED_BACKGROUND);
    expect(icon).not.toBeNull();
    expect(icon && getComputedStyle(icon).backgroundColor).toBe(TRANSPARENT);
  });

  it('should apply a configured style to a submenu button', async () => {
    const secondCamera = 'camera.kitchen';
    const config: RawAdvancedCameraCardConfig = {
      ...createStillImageCardConfig({
        menu: {
          style: 'outside',
          buttons: { cameras: { style: { background: CONFIGURED_BACKGROUND } } },
        },
      }),
      cameras: [
        createStillImageCameraConfig(),
        createStillImageCameraConfig(secondCamera),
      ],
    };

    const card = await MountedCardFactory.createFromSource(
      config,
      createGenericCameraHASS({ cameras: [secondCamera] }),
    );

    const button = await card.findControl('Cameras');
    const icon = getIcon(button);

    expect(getComputedStyle(button).backgroundColor).toBe(CONFIGURED_BACKGROUND);
    expect(icon).not.toBeNull();
    expect(icon && getComputedStyle(icon).backgroundColor).toBe(TRANSPARENT);
  });
});
