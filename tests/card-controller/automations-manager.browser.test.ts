import { describe, expect, it } from 'vitest';

import { MountedCardFactory, type MountedCard } from '../browser/mounted-card';
import {
  createGenericCameraHASS,
  createStillImageCardConfig,
} from '../browser/test-utils';

const TRIGGER_ENTITY = 'input_boolean.zoom';

const mount = async (): Promise<MountedCard> => {
  const hass = createGenericCameraHASS({ entities: { [TRIGGER_ENTITY]: 'off' } });
  return await MountedCardFactory.createFromSource(
    createStillImageCardConfig({
      automations: [
        {
          triggers: [{ trigger: 'state', entity: TRIGGER_ENTITY, to: 'on' }],
          actions: [
            {
              action: 'fire-dom-event',
              advanced_camera_card_action: 'ptz_digital',
              absolute: { zoom: 2 },
            },
          ],
        },
      ],
    }),
    hass,
  );
};

describe('AutomationsManager', () => {
  it('should run an automation only when a watched entity changes', async () => {
    const card = await mount();

    const zoomer = await card.waitForSelector('advanced-camera-card-zoomer');
    expect(zoomer.hasAttribute('zoomed')).toBe(false);

    // A new `hass` carrying no change at all. A card that acted on this would
    // be reacting to the object rather than to what is in it.
    card.renewHASS();
    await card.card.updateComplete;

    expect(zoomer.hasAttribute('zoomed')).toBe(false);

    // The zoom is the far end of a chain that starts at the configuration: an
    // entity the card was told to watch changed, the trigger matched, and the
    // action it named actually ran. It also proves the assertion above was
    // reporting a card that did nothing rather than a probe that never moves.
    card.setEntityState(TRIGGER_ENTITY, 'on');
    await card.events.waitForFirst('advanced-camera-card:zoom:zoomed');

    expect(zoomer.hasAttribute('zoomed')).toBe(true);
  });
});
