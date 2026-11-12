import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RawAdvancedCameraCardConfig } from '../../../../src/config/types';
import {
  createFrigateCameraDescription,
  FakeFrigate,
} from '../../../browser/fake-frigate';
import { MountedCardFactory, type MountedCard } from '../../../browser/mounted-card';
import {
  CAMERA_ENTITY,
  CARD_INITIALIZED_MESSAGE,
  createCameraHASS,
  createGenericCameraHASS,
  createInitializedAutomation,
  createStillImageCameraConfig,
  createStillImageCardConfig,
  getBlockNotificationText,
  getStatusBarItem,
  isLiveMediaShowing,
} from '../../../browser/test-utils';

const FAILED_CAMERA_TITLE = 'Camera initialization failed';
const CARD_FAILED_ISSUE_HEADING = 'Initialization failed';

const MISSING_CAMERA_ENTITY = 'camera.missing';

const CAMERA_ISSUE_TITLE = 'Cameras not fully initialized';

// A fixed interval rather than the default backoff, which jitters delays.
const RETRY_SECONDS = 10;

const createUninitializableCameraConfig = (id: string): RawAdvancedCameraCardConfig => ({
  ...createStillImageCameraConfig(MISSING_CAMERA_ENTITY),
  id,

  // Naming the engine prevents the card looking the entity up.
  engine: 'motioneye',
});

const mountCard = async (cameras: RawAdvancedCameraCardConfig[]): Promise<MountedCard> =>
  await MountedCardFactory.createFromSource(
    createStillImageCardConfig({
      cameras,

      // Log post-initialization.
      automations: [createInitializedAutomation()],
    }),
    createGenericCameraHASS(),
  );

describe('CameraInitializationIssue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not fail overall initialization when one camera cannot initialize', async () => {
    const card = await mountCard([
      createUninitializableCameraConfig('broken'),
      createStillImageCameraConfig(CAMERA_ENTITY),
    ]);

    // A card that failed as a whole never logs this.
    await card.console.waitForMessage(CARD_INITIALIZED_MESSAGE);

    // No event fires when a camera fails: wait for the notification text.
    await vi.waitFor(() =>
      expect(getBlockNotificationText(card.card)).toContain(FAILED_CAMERA_TITLE),
    );
    expect(getBlockNotificationText(card.card)).not.toContain(CARD_FAILED_ISSUE_HEADING);

    const mediaLoaded = card.events.waitForNext('advanced-camera-card:media:loaded');
    await card.clickNextPreviousControl('right');
    await mediaLoaded;

    expect(isLiveMediaShowing(card.card)).toBe(true);
  });

  it('should not fail overall initialization even when no camera initializes', async () => {
    const card = await mountCard([
      createUninitializableCameraConfig('broken-1'),
      createUninitializableCameraConfig('broken-2'),
    ]);

    await card.console.waitForMessage(CARD_INITIALIZED_MESSAGE);

    await vi.waitFor(() =>
      expect(getBlockNotificationText(card.card)).toContain(FAILED_CAMERA_TITLE),
    );
    expect(getBlockNotificationText(card.card)).not.toContain(CARD_FAILED_ISSUE_HEADING);
  });

  it('should recover a partially initialized camera once its entity has a state', async () => {
    vi.useFakeTimers();

    // Simulate the Frigate integration reloading: the camera entity exists but
    // has no state yet.
    const camera = createFrigateCameraDescription();
    const hass = createCameraHASS([camera]);
    hass.removeState(CAMERA_ENTITY);
    new FakeFrigate(hass);

    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        status_bar: { style: 'outside' },
        view: { issues: { retry_seconds: RETRY_SECONDS } },
      }),
      hass,
    );

    await card.waitForRender(
      () => getStatusBarItem(card.card, CAMERA_ISSUE_TITLE),
      `the ${CAMERA_ISSUE_TITLE} issue being reported`,
    );

    card.setEntityState(CAMERA_ENTITY, camera.entity);
    await card.advanceSeconds(RETRY_SECONDS);

    await card.waitForRender(
      () => !getStatusBarItem(card.card, CAMERA_ISSUE_TITLE) || null,
      `the ${CAMERA_ISSUE_TITLE} issue being cleared`,
    );
  });
});
