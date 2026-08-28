import { describe, expect, it, vi } from 'vitest';

import type { RawAdvancedCameraCardConfig } from '../../../../src/config/types';
import { MountedCardFactory, type MountedCard } from '../../../browser/mounted-card';
import {
  CAMERA_ENTITY,
  CARD_INITIALIZED_MESSAGE,
  createGenericCameraHASS,
  createInitializedAutomation,
  createStillImageCameraConfig,
  createStillImageCardConfig,
  getBlockNotificationText,
  isLiveMediaShowing,
} from '../../../browser/test-utils';

const FAILED_CAMERA_TITLE = 'Camera initialization failed';
const CARD_FAILED_ISSUE_HEADING = 'Initialization failed';

const MISSING_CAMERA_ENTITY = 'camera.missing';

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
});
