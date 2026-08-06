import { describe, expect, it, vi } from 'vitest';

import type { RawAdvancedCameraCardConfig } from '../../src/config/types';
import { MountedCardFactory, type MountedCard } from '../browser/mounted-card';
import {
  createCameraHASS,
  createStillImageCameraConfig,
  createStillImageCardConfig,
  getBlockNotificationText,
} from '../browser/test-utils';

const INIT_FAILED_ISSUE_HEADING = 'Initialization failed';

const TRIGGERING_CAMERA_ENTITY = 'camera.triggering';
const OTHER_TRIGGERING_CAMERA_ENTITY = 'camera.triggering_too';

/**
 * A camera that subscribes to a Home Assistant event once initialized, so that
 * whether it was cleaned up is externally observable.
 */
const createSubscribingCameraConfig = (
  cameraEntity: string,
  cameraID?: string,
): RawAdvancedCameraCardConfig => ({
  ...createStillImageCameraConfig(cameraEntity),
  ...(cameraID && { id: cameraID }),
  triggers: {
    events: [{ event_type: 'acc_test_event' }],
  },
});

describe('CameraManager', () => {
  it('should release the subscriptions of cameras that initialized before initialization failed', async () => {
    // Duplicate identifiers are rejected only after every camera has been
    // built, so both cameras are live and subscribed when the failure happens.
    const DUPLICATE_ID = 'duplicate';

    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        cameras: [
          createSubscribingCameraConfig(TRIGGERING_CAMERA_ENTITY, DUPLICATE_ID),
          createSubscribingCameraConfig(OTHER_TRIGGERING_CAMERA_ENTITY, DUPLICATE_ID),
        ],
        view: { issues: { retry_seconds: 0 } },
      }),
      createCameraHASS({
        cameras: [TRIGGERING_CAMERA_ENTITY, OTHER_TRIGGERING_CAMERA_ENTITY],
      }),
    );

    await vi.waitFor(() =>
      expect(getBlockNotificationText(card.card)).toContain(INIT_FAILED_ISSUE_HEADING),
    );

    // Both cameras are unreachable once initialization has failed, so nothing
    // else could ever release what they subscribed to.
    await vi.waitFor(() => expect(card.getOpenEventSubscriptionCount()).toBe(0));

    card.destroy();
  });

  it('should release camera subscriptions when the card is taken off the page', async () => {
    const card: MountedCard = await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        cameras: [createSubscribingCameraConfig(TRIGGERING_CAMERA_ENTITY)],
      }),
      createCameraHASS({ cameras: [TRIGGERING_CAMERA_ENTITY] }),
    );

    await vi.waitFor(() => expect(card.getOpenEventSubscriptionCount()).toBe(1));

    card.detach();

    await vi.waitFor(() => expect(card.getOpenEventSubscriptionCount()).toBe(0));

    card.destroy();
  });
});
