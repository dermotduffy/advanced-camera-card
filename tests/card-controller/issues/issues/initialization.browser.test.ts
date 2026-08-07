import { describe, expect, it, vi } from 'vitest';

import { MountedCardFactory, type MountedCard } from '../../../browser/mounted-card';
import {
  CARD_INITIALIZED_MESSAGE,
  createGenericCameraHASS,
  createInitializedAutomation,
  createStillImageCameraConfig,
  createStillImageCardConfig,
  getBlockNotificationText,
} from '../../../browser/test-utils';

const INIT_FAILED_ISSUE_HEADING = 'Initialization failed';

// A camera Home Assistant has never heard of, which is what a typo in a
// configuration looks like and the earliest thing a camera can fail on.
const MISSING_CAMERA_ENTITY = 'camera.missing';

const getReportedInitializationFailures = (card: MountedCard): string[] =>
  card.console
    .getMessages('warn')
    .filter((message) => message.includes('[issue=initialization]'));

const waitForInitializationFailures = async (card: MountedCard): Promise<void> =>
  await vi.waitFor(() =>
    expect(getBlockNotificationText(card.card)).toContain(INIT_FAILED_ISSUE_HEADING),
  );

/**
 * A card whose camera cannot be initialized. Giving Home Assistant the entity
 * is what makes it initializable, which a test does with `setEntityState`.
 */
const mountBrokenCard = async (): Promise<MountedCard> =>
  await MountedCardFactory.createFromSource(
    createStillImageCardConfig({
      cameras: [createStillImageCameraConfig(MISSING_CAMERA_ENTITY)],

      // Automatic retries switched off, so any recovery below can only be the
      // retry control being used.
      view: { issues: { retry_seconds: 0 } },
      automations: [createInitializedAutomation()],
    }),
    createGenericCameraHASS(),
  );

describe('InitializationIssue', () => {
  it('should report a card that could not be started, and start it on a retry', async () => {
    const card = await mountBrokenCard();

    await waitForInitializationFailures(card);

    // A card that failed to start has not started, whatever it is showing.
    expect(card.console.countMessages(CARD_INITIALIZED_MESSAGE)).toBe(0);

    // The camera the user meant now exists. Nothing recovers on its own from
    // here: automatic retries are off, and a card showing a full-card issue
    // refuses to start.
    card.setEntityState(MISSING_CAMERA_ENTITY, 'idle');
    await card.clickControl('Retry');

    await card.console.waitForMessage(CARD_INITIALIZED_MESSAGE);
    await card.events.waitForFirst('advanced-camera-card:media:loaded');

    // Starting is not the same as the issue leaving the screen, since a
    // full-card issue hides the views behind it.
    expect(getBlockNotificationText(card.card)).not.toContain(INIT_FAILED_ISSUE_HEADING);
  });

  it('should keep reporting a card whose retry fails again', async () => {
    const card = await mountBrokenCard();

    await waitForInitializationFailures(card);
    expect(getReportedInitializationFailures(card)).toHaveLength(1);

    await card.clickControl('Retry');

    // The camera still does not exist, so the retry fails too. A second failure
    // has to be raised rather than leaving the card looking as though the retry
    // had worked.
    await vi.waitFor(() =>
      expect(getReportedInitializationFailures(card)).toHaveLength(2),
    );
    await waitForInitializationFailures(card);

    expect(card.console.countMessages(CARD_INITIALIZED_MESSAGE)).toBe(0);
  });
});
