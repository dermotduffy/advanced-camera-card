import { describe, expect, it, vi } from 'vitest';

import type { CardController } from '../src/card-controller/controller';
import { deepQuery } from './browser/dom';
import { MountedCardFactory } from './browser/mounted-card';
import {
  createGenericCameraHASS,
  createStillImageCardConfig,
} from './browser/test-utils';

describe('AdvancedCameraCard', () => {
  it('should render elements without templates before mandatory initialization finishes', async () => {
    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        elements: [
          {
            type: 'custom:advanced-camera-card-menu-icon',
            icon: 'mdi:reload',
            title: 'Reload',
          },
        ],
      }),
      createGenericCameraHASS(),
    );
    await card.waitForSelector('advanced-camera-card-elements');

    const controller = (card.card as unknown as { _controller: CardController })
      ._controller;
    vi.spyOn(
      controller.getInitializationManager(),
      'areMandatoryAspectsInitialized',
    ).mockReturnValue(false);

    card.card.requestUpdate();
    await card.updateComplete;

    expect(deepQuery(card.card, 'advanced-camera-card-elements')).not.toBeNull();
  });
});
