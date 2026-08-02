import { describe, expect, it, vi } from 'vitest';

import type { RawAdvancedCameraCardConfig } from '../../../src/config/types';
import { MountedCard } from '../../browser/mounted-card';
import {
  createStillCameraHASS,
  createStillImageCameraConfig,
  createStillImageCardConfig,
  isMediaLoadedInfoEventDetail,
} from '../../browser/test-utils';

const STARTED_MESSAGE = 'card-started';
const OTHER_CAMERA_ENTITY = 'camera.other';

const createConfig = (
  overrides?: Partial<RawAdvancedCameraCardConfig>,
): RawAdvancedCameraCardConfig =>
  createStillImageCardConfig({
    automations: [
      {
        triggers: [{ trigger: 'initialized' }],
        actions: [
          {
            action: 'fire-dom-event',
            advanced_camera_card_action: 'log',
            message: STARTED_MESSAGE,
          },
        ],
      },
    ],
    ...overrides,
  });

const mount = async (
  overrides?: Partial<RawAdvancedCameraCardConfig>,
): Promise<MountedCard> =>
  await MountedCard.create(
    createConfig(overrides),
    createStillCameraHASS({ cameras: [OTHER_CAMERA_ENTITY] }),
  );

// Only the messages the automation logged, since the card logs other things at
// the same level.
const getStartedMessages = (card: MountedCard): string[] =>
  card.console.getMessages('info').filter((message) => message === STARTED_MESSAGE);

// The cameras the card has actually loaded media for, in order. Media that
// named no camera is left out, since these are only read to ask which camera
// the card ended up on.
const getLoadedCameraIDs = (card: MountedCard): string[] =>
  card.events
    .getEntries('advanced-camera-card:media:loaded')
    .map((entry) => entry.detail)
    .filter(isMediaLoadedInfoEventDetail)
    .map((detail) => detail.info.targetID)
    .filter((targetID): targetID is string => targetID !== undefined);

describe('SessionManager', () => {
  it('should fire an initialized trigger each time the card starts', async () => {
    const card = await mount();

    await vi.waitFor(() => expect(getStartedMessages(card)).toHaveLength(1));

    // The card leaving the page is a change of the value the trigger watches,
    // and must not fire it.
    card.detach();
    await card.updateComplete;

    expect(getStartedMessages(card)).toHaveLength(1);

    card.attach();
    await vi.waitFor(() => expect(getStartedMessages(card)).toHaveLength(2));
  });

  it('should start the card again once Home Assistant comes back', async () => {
    const card = await mount();

    await vi.waitFor(() => expect(getStartedMessages(card)).toHaveLength(1));

    // Losing Home Assistant changes the value the trigger watches, and must not
    // fire it.
    card.setConnected(false);
    await card.updateComplete;

    expect(getStartedMessages(card)).toHaveLength(1);

    card.setConnected(true);
    await vi.waitFor(() => expect(getStartedMessages(card)).toHaveLength(2));
  });

  it('should initialize the new cameras without starting the card again', async () => {
    const card = await mount();

    await card.events.waitForFirst('advanced-camera-card:media:loaded');
    await vi.waitFor(() => expect(getStartedMessages(card)).toHaveLength(1));

    // A camera change is the heaviest configuration change there is: the
    // cameras are destroyed and initialized again.
    card.setConfig(
      createConfig({ cameras: [createStillImageCameraConfig(OTHER_CAMERA_ENTITY)] }),
    );

    // Media loading for the new camera is what says the change took effect at
    // all, without which the assertion below would pass on a card that ignored
    // the configuration.
    await vi.waitFor(() =>
      expect(getLoadedCameraIDs(card)).toContain(OTHER_CAMERA_ENTITY),
    );

    expect(getStartedMessages(card)).toHaveLength(1);
  });

  it('should apply an override keyed on the card being started every time it starts', async () => {
    // The menu is configured away and the override is the only thing that
    // brings it back, so a menu on screen means the condition matched.
    const card = await mount({
      menu: { style: 'none' },
      overrides: [
        {
          conditions: [{ condition: 'initialized' }],
          merge: { menu: { style: 'outside' } },
        },
      ],
    });

    await card.waitForSelector('advanced-camera-card-menu');

    card.detach();
    card.attach();
    await vi.waitFor(() => expect(getStartedMessages(card)).toHaveLength(2));

    await card.waitForSelector('advanced-camera-card-menu');
  });

  it('should not show the loading indicator again once the card has started', async () => {
    const card = await mount({
      performance: { features: { card_loading_indicator: true } },
    });

    const loading = await card.waitForSelector('advanced-camera-card-loading');
    await vi.waitFor(() => expect(loading.hasAttribute('loaded')).toBe(true));

    card.detach();
    card.attach();
    await vi.waitFor(() => expect(getStartedMessages(card)).toHaveLength(2));

    // A card that has been on screen once must not show the loading indicator
    // again when it is re-attached.
    expect(
      (await card.waitForSelector('advanced-camera-card-loading')).hasAttribute(
        'loaded',
      ),
    ).toBe(true);
  });
});
