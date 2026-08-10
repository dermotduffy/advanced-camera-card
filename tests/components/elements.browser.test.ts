import { describe, expect, it } from 'vitest';

import { MountedCardFactory } from '../browser/mounted-card';
import {
  createGenericCameraHASS,
  createStillImageCardConfig,
} from '../browser/test-utils';

interface PictureElement extends Element {
  delegatedActions: boolean;
}

describe('AdvancedCameraCardElements', () => {
  it('should have a picture element listen for its own taps', async () => {
    // See: https://github.com/dermotduffy/advanced-camera-card/issues/2664
    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        elements: [
          { type: 'icon', icon: 'mdi:cow', tap_action: { action: 'more-info' } },
        ],
      }),
      createGenericCameraHASS(),
    );

    const element = await card.waitForSelector<PictureElement>('hui-icon-element');

    // Home Assistant has this element wait for the container rendering it to
    // dispatch the action for it. This card cannot do that as we require
    // "behind" the elements to be able to receive pointer interactions.
    expect(element.delegatedActions).toBe(false);
  });
});
