import { afterEach, describe, expect, it, vi } from 'vitest';

import { deepQuery } from '../../browser/dom';
import { MountedCardFactory } from '../../browser/mounted-card';
import {
  CARD_INITIALIZED_MESSAGE,
  createGenericCameraHASS,
  createInitializedAutomation,
  createStillImageCardConfig,
} from '../../browser/test-utils';

const DOOR_ENTITY = 'binary_sensor.door';

describe('ConditionsManager', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should apply an override once its `for` duration passes without further state updates', async () => {
    // The menu is configured away and the override is the only thing that
    // brings it back, so a menu on screen means the condition matched.
    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        automations: [createInitializedAutomation()],
        menu: { style: 'none' },
        overrides: [
          {
            conditions: [
              {
                condition: 'state',
                entity: DOOR_ENTITY,
                state: 'on',
                for: '00:00:05',
              },
            ],
            merge: { menu: { style: 'outside' } },
          },
        ],
      }),
      createGenericCameraHASS({ entities: { [DOOR_ENTITY]: 'off' } }),
    );
    await card.console.waitForMessage(CARD_INITIALIZED_MESSAGE);

    // The image loading is a state change that re-evaluates the conditions on
    // its own, so it must have happened before the door opens.
    await card.events.waitForFirst('advanced-camera-card:media:loaded');

    vi.useFakeTimers();
    card.setEntityState(DOOR_ENTITY, 'on');

    // No state update follows this one, so only the condition's own
    // re-evaluation can apply the override.
    await card.advanceSeconds(4);
    expect(deepQuery(card.card, 'advanced-camera-card-menu')).toBeNull();

    await card.advanceSeconds(2);
    await card.waitForSelector('advanced-camera-card-menu');
  });
});
