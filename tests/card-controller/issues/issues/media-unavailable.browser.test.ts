import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';

import { RETRY_EXPONENTIAL_BASE_SECONDS } from '../../../../src/card-controller/issues/issue-manager';
import { LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS } from '../../../../src/components-lib/live/liveness/detectors/entity-availability';
import { MEDIA_LOADING_TIMEOUT_SECONDS } from '../../../../src/components-lib/media-load-watchdog-controller';
import { FRAME_STALL_SECONDS } from '../../../../src/components-lib/media-player/frame-stall-watchdog';
import type { RawAdvancedCameraCardConfig } from '../../../../src/config/types';
import { deepQuery, deepQueryAll } from '../../../browser/dom';
import {
  MountedCardFactory,
  type MountedCard,
  type MountOptions,
} from '../../../browser/mounted-card';
import {
  createFailingMediaURL,
  createStallingMediaURL,
  createTemporarilyFailingMediaURL,
  createUnansweredMediaURL,
  getTestMediaRequestCount,
  useTestMedia,
} from '../../../browser/test-media';
import {
  CAMERA_ENTITY,
  CARD_INITIALIZED_MESSAGE,
  createGenericCameraHASS,
  createInitializedAutomation,
  createStillImageCameraConfig,
  createStillImageCardConfig,
  getBlockNotificationText,
  getStatusBarItem,
  isLiveMediaShowing,
  waitUntilObservedVisible,
  type CameraHASSOptions,
  type GenericCameraHASSOptions,
} from '../../../browser/test-utils';

const SECOND_CAMERA_ENTITY = 'camera.hallway';

const OVERRIDE_ENTITY = 'input_boolean.override';

const MEDIA_ISSUE_TITLE = 'Media unavailable';

// Holding this reaches the diagnostics view, the only view showing no media
// that a camera without a media browsing engine can get to.
const IRIS_CONTROL = 'Iris / Default View / Unhide menu';

const findIssue = (card: MountedCard): Element | null =>
  getStatusBarItem(card.card, MEDIA_ISSUE_TITLE);

const isIssueReported = (card: MountedCard): boolean => !!findIssue(card);

const getIssueReason = (detail: unknown): string | null =>
  detail && typeof detail === 'object' && 'reason' in detail
    ? String(detail.reason)
    : null;

// Resolve once `image` holds a picture that actually loaded. A failed load also
// marks the element complete, so the decoded size is what separates the two.
const waitForImageLoaded = async (image: HTMLImageElement): Promise<void> =>
  await new Promise<void>((resolve) => {
    if (image.complete && image.naturalWidth > 0) {
      resolve();
    } else {
      image.addEventListener('load', () => resolve(), { once: true });
    }
  });

const waitForIssueReported = async (card: MountedCard): Promise<void> => {
  await card.waitForRender(
    () => findIssue(card),
    `the ${MEDIA_ISSUE_TITLE} issue being reported`,
  );
};

const waitForIssueCleared = async (card: MountedCard): Promise<void> => {
  await card.waitForRender(
    () => !findIssue(card) || null,
    `the ${MEDIA_ISSUE_TITLE} issue being cleared`,
  );
};

interface MountCardOptions extends MountOptions, GenericCameraHASSOptions {}

/**
 * Every test here needs the status bar rendered, since that is where an issue
 * is reported.
 */
const mountCard = async (
  config?: Partial<RawAdvancedCameraCardConfig>,
  options?: MountCardOptions,
): Promise<MountedCard> => {
  const { cameras, entities, language, ...mountOptions } = options ?? {};

  return await MountedCardFactory.createFromSource(
    createStillImageCardConfig({ status_bar: { style: 'outside' }, ...config }),
    createGenericCameraHASS({ cameras, entities, language }),
    mountOptions,
  );
};

const mountCardSingleCamera = async (): Promise<MountedCard> => {
  const card = await mountCard();

  await card.events.waitForFirst('advanced-camera-card:media:loaded');

  return card;
};

/**
 * A grid of the two standard cameras, which differ only in how they are
 * configured to behave.
 */
const mountCardGrid = async (
  cameras: RawAdvancedCameraCardConfig[],
  options?: {
    config?: Partial<RawAdvancedCameraCardConfig>;
    entities?: CameraHASSOptions['entities'];
  },
): Promise<MountedCard> =>
  await mountCard(
    { live: { display: { mode: 'grid' } }, cameras, ...options?.config },
    {
      cameras: [SECOND_CAMERA_ENTITY],
      ...(options?.entities && { entities: options.entities }),

      // The grid observes both its own size and its cells', so a cell resize
      // can resize the host and vice versa. Chromium reports each round it has
      // to defer as an uncaught error. How many rounds that takes follows the
      // browser's frame scheduling, not the card: measured anywhere between
      // none and three for the same test. So it cannot be counted, only
      // tolerated, and only for the grid: anywhere else it would mean
      // something new.
      toleratedConsoleErrors: [/ResizeObserver loop completed/],
    },
  );

const mountCardDualCameras = async (): Promise<MountedCard> => {
  const card = await mountCardGrid([
    createStillImageCameraConfig(),
    createStillImageCameraConfig(SECOND_CAMERA_ENTITY),
  ]);

  await card.events.waitForFirst('advanced-camera-card:media:loaded');

  return card;
};

// Several test cameras here intentionally fail, hang or go quiet, which is
// served from within the page rather than by the dev server.
useTestMedia();

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MediaUnavailableIssue', () => {
  it('should not report a healthy camera', async () => {
    const card = await mountCardSingleCamera();

    await card.advanceSeconds(LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS * 4);

    expect(isIssueReported(card)).toBe(false);
  });

  it('should wait out the grace period before reporting an unavailable camera', async () => {
    const card = await mountCardSingleCamera();

    card.setEntityState(CAMERA_ENTITY, 'unavailable');

    // Just short of the grace period: reporting here would alarm on a camera
    // that is about to come back.
    await card.advanceSeconds(LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS - 1);
    expect(isIssueReported(card)).toBe(false);

    await card.advanceSeconds(1);
    expect(isIssueReported(card)).toBe(true);
  });

  it('should never report a camera that recovers within the grace period', async () => {
    const card = await mountCardSingleCamera();

    card.setEntityState(CAMERA_ENTITY, 'unavailable');
    await card.advanceSeconds(LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS - 1);

    card.setEntityState(CAMERA_ENTITY, 'idle');

    // Well past the point the issue report would have appeared had the blip not
    // ended. Nothing should ever have been shown.
    await card.advanceSeconds(LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS * 4);

    expect(isIssueReported(card)).toBe(false);
  });

  it('should name the camera that failed and why', async () => {
    const card = await mountCardDualCameras();

    card.setEntityState(SECOND_CAMERA_ENTITY, 'unavailable');
    await card.advanceSeconds(LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS);
    await card.waitForSelector('advanced-camera-card-notification-block');

    // Which camera, not just that something is wrong: with several on screen an
    // issue report that does not say which one leaves the user guessing.
    expect(getBlockNotificationText(card.card)).toContain('Camera entity unavailable');
    expect(getBlockNotificationText(card.card)).toContain(SECOND_CAMERA_ENTITY);
  });

  it('should leave the cameras that are still working alone', async () => {
    const card = await mountCardDualCameras();

    card.setEntityState(SECOND_CAMERA_ENTITY, 'unavailable');
    await card.advanceSeconds(LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS);
    await card.waitForSelector('advanced-camera-card-notification-block');

    // One camera failing must not take the other down with it.
    expect(
      deepQueryAll(card.card, 'advanced-camera-card-notification-block'),
    ).toHaveLength(1);
    expect(isLiveMediaShowing(card.card)).toBe(true);
  });

  it('should offer no scrollbar on a failed grid camera that is not selected', async () => {
    const card = await mountCardDualCameras();

    card.setEntityState(SECOND_CAMERA_ENTITY, 'unavailable');
    await card.advanceSeconds(LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS);
    const block = await card.waitForSelector('advanced-camera-card-notification-block');

    // Unselected cells cannot usefully be scrolled, so a scrollbar is not offered.
    const content = block.shadowRoot?.querySelector('.content');
    assert(content);

    expect(getComputedStyle(content).overflowY).toBe('hidden');
  });

  it('should trigger an issue for an unselected grid camera and recover it', async () => {
    // Every camera in a grid is on screen, so any of them failing triggers an
    // issue, not only the camera that happens to be selected.
    // See: https://github.com/dermotduffy/advanced-camera-card/issues/2637
    const card = await mountCardGrid([
      createStillImageCameraConfig(),
      createStillImageCameraConfig(
        SECOND_CAMERA_ENTITY,
        createTemporarilyFailingMediaURL(1),
      ),
    ]);

    await card.events.waitForFirst('advanced-camera-card:issue:trigger');
    await waitForIssueReported(card);

    expect(getBlockNotificationText(card.card)).toContain(SECOND_CAMERA_ENTITY);

    // Nothing here asks the card to try again: the retry runs on its own.
    await card.advanceSeconds(RETRY_EXPONENTIAL_BASE_SECONDS);
    await waitForIssueCleared(card);

    expect(isLiveMediaShowing(card.card)).toBe(true);
  });

  it('should trigger an issue for a camera added to a grid by an override', async () => {
    // Overrides don't recreate views. If an override changes the cameras,
    // issues should be created for newly added cameras.
    const card = await mountCardGrid([createStillImageCameraConfig()], {
      entities: { [OVERRIDE_ENTITY]: 'off' },
      config: {
        overrides: [
          {
            conditions: [{ condition: 'state', entity: OVERRIDE_ENTITY, state: 'on' }],
            set: {
              cameras: [
                createStillImageCameraConfig(),
                createStillImageCameraConfig(
                  SECOND_CAMERA_ENTITY,
                  createFailingMediaURL(),
                ),
              ],
            },
          },
        ],
      },
    });

    await card.events.waitForFirst('advanced-camera-card:media:loaded');
    expect(isIssueReported(card)).toBe(false);

    card.setEntityState(OVERRIDE_ENTITY, 'on');

    await card.events.waitForFirst('advanced-camera-card:issue:trigger');
    await waitForIssueReported(card);

    expect(getBlockNotificationText(card.card)).toContain(SECOND_CAMERA_ENTITY);
  });

  it('should stay silent about a carousel camera that is not on screen', async () => {
    // A carousel camera that has loaded and failed triggers no issue while it
    // is off screen. Lazy loading is off so that it does load and fail, rather
    // than the test passing because nothing was watching it.
    const card = await mountCard(
      {
        live: { lazy_load: false },
        cameras: [
          createStillImageCameraConfig(),
          createStillImageCameraConfig(SECOND_CAMERA_ENTITY),
        ],
      },
      { cameras: [SECOND_CAMERA_ENTITY] },
    );
    await card.events.waitForFirst('advanced-camera-card:media:loaded');

    card.setEntityState(SECOND_CAMERA_ENTITY, 'unavailable');
    await card.advanceSeconds(LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS * 4);

    expect(isIssueReported(card)).toBe(false);

    // Step the carousel on to that same camera, which reports the failure it
    // already had. The silence above was the scoping, not an absence of
    // anything watching.
    await card.clickNextPreviousControl('right');
    await waitForIssueReported(card);

    expect(getBlockNotificationText(card.card)).toContain(SECOND_CAMERA_ENTITY);
  });

  it('should keep an issue across a detach and re-attach', async () => {
    const card = await mountCardGrid(
      [
        createStillImageCameraConfig(),
        createStillImageCameraConfig(SECOND_CAMERA_ENTITY),
      ],
      { config: { automations: [createInitializedAutomation()] } },
    );
    await card.events.waitForFirst('advanced-camera-card:media:loaded');

    card.setEntityState(SECOND_CAMERA_ENTITY, 'unavailable');
    await card.advanceSeconds(LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS);
    await waitForIssueReported(card);

    card.detach();
    card.attach();

    // Re-attaching rebuilds the camera manager and its cameras; the issue
    // belongs to one of them, so wait for initialization to finish before
    // reading it.
    await card.console.waitForMessage(CARD_INITIALIZED_MESSAGE, { count: 2 });
    await waitForIssueReported(card);

    // The clock has not moved, so a failure found all over again could not
    // have been reported yet (the detection grace period cannot have elapsed).
    // This is the issue from before the detach.
    expect(isIssueReported(card)).toBe(true);
  });

  it('should trigger an issue for a grid camera that goes quiet without failing', async () => {
    // No active errors, just an unanswered load on an unselected camera.
    const card = await mountCardGrid([
      createStillImageCameraConfig(),
      createStillImageCameraConfig(SECOND_CAMERA_ENTITY, createUnansweredMediaURL()),
    ]);

    // Nothing is waited on until the cell has a player asking for media.
    await card.waitForSelector('advanced-camera-card-live-image');

    await card.advanceSeconds(MEDIA_LOADING_TIMEOUT_SECONDS - 1);
    expect(isIssueReported(card)).toBe(false);

    await card.advanceSeconds(1);
    await waitForIssueReported(card);

    // The cell itself is still showing that it is waiting, so which camera has
    // given up is only knowable from the issue.
    await card.clickControl(MEDIA_ISSUE_TITLE);
    const notification = await card.waitForSelector('advanced-camera-card-notification');

    expect(notification.shadowRoot?.textContent).toContain(SECOND_CAMERA_ENTITY);
    expect(notification.shadowRoot?.textContent).toContain('Media not loading');
  });

  it('should report a camera whose media fails to load', async () => {
    const card = await mountCard({
      cameras: [createStillImageCameraConfig(CAMERA_ENTITY, createFailingMediaURL())],
    });

    // The entity is present and healthy, so the failed fetch is the only thing
    // that can be reported. It is reported as soon as the load fails rather
    // than after the loading timeout, because a failure is not a slow load.
    await card.events.waitForFirst('advanced-camera-card:issue:trigger');
    await waitForIssueReported(card);

    expect(getBlockNotificationText(card.card)).toContain('Could not load image');
    expect(getBlockNotificationText(card.card)).toContain(CAMERA_ENTITY);

    expect(card.events.getEntries('advanced-camera-card:issue:trigger')).toHaveLength(1);
  });

  it('should trigger an issue for an image view whose media fails to load', async () => {
    const card = await mountCard({
      view: { default: 'image' },
      image: { mode: 'url', url: createFailingMediaURL() },
    });

    await card.events.waitForFirst('advanced-camera-card:issue:trigger');
    await waitForIssueReported(card);

    expect(isIssueReported(card)).toBe(true);
    expect(card.events.getEntries('advanced-camera-card:issue:trigger')).toHaveLength(1);
  });

  it('should clear the issue report once the camera delivers media again', async () => {
    const card = await mountCard({
      cameras: [
        createStillImageCameraConfig(CAMERA_ENTITY, createTemporarilyFailingMediaURL(1)),
      ],
    });

    await card.events.waitForFirst('advanced-camera-card:issue:trigger');
    await waitForIssueReported(card);

    // Nothing here asks the card to try again. A camera that has come back must
    // be picked up by the card's own retry, or the issue report stays up
    // forever for a user who is looking at a working camera.
    await card.advanceSeconds(RETRY_EXPONENTIAL_BASE_SECONDS);
    await card.events.waitForFirst('advanced-camera-card:media:loaded');

    expect(isIssueReported(card)).toBe(false);

    // The picture is back, so the cleared issue report is not the card having
    // thrown the whole live view away.
    expect(isLiveMediaShowing(card.card)).toBe(true);
  });

  it('should wait out the loading timeout before reporting a slow camera', async () => {
    const card = await mountCard({
      cameras: [createStillImageCameraConfig(CAMERA_ENTITY, createUnansweredMediaURL())],
    });

    // Nothing is waited on until there is a player asking for media, so let one
    // render before the clock is run forward.
    await card.waitForSelector('img');

    // A camera answering slowly is not a camera that has failed. Reporting here
    // would fire on every sluggish connection.
    await card.advanceSeconds(MEDIA_LOADING_TIMEOUT_SECONDS - 1);
    expect(isIssueReported(card)).toBe(false);

    // Past the timeout, silence is indistinguishable from failure and has to be
    // reported: nothing else will ever say so, since the request never answers
    // and there is no error to catch.
    await card.advanceSeconds(1);
    expect(isIssueReported(card)).toBe(true);
  });

  it('should keep retrying a camera that is still broken', async () => {
    // Must use the real clock: fake time moves the card's timers instantly, so
    // a request would never get a chance to answer between one retry and the
    // next, and the card would call the attempt slow instead of failed.
    vi.useRealTimers();

    const card = await mountCard({
      // A fixed interval rather than the default backoff, which jitters every
      // delay by a random half. Backoff itself is tested in unittests. Short,
      // because this is real time, but long enough that a failed request is
      // reported before the next attempt replaces it.
      //
      // Caution: As this test must use the real clock, this directly adds to
      // the test runtime.
      view: { issues: { retry_seconds: 0.1 } },
      cameras: [
        createStillImageCameraConfig(CAMERA_ENTITY, createTemporarilyFailingMediaURL(2)),
      ],
    });

    // Two failures: the first attempt, and a retry after it. Giving up after
    // one would leave a camera dark that was about to come back.
    await card.events.waitForCount('advanced-camera-card:issue:trigger', 2);
    await waitForIssueReported(card);

    // The third attempt is served. Clearing the issue is a render that follows
    // the media arriving rather than accompanying it, so it is waited for.
    await card.events.waitForFirst('advanced-camera-card:media:loaded');
    await waitForIssueCleared(card);

    expect(isLiveMediaShowing(card.card)).toBe(true);

    // Exactly the two attempts that failed, so the retry ran once rather than
    // spinning until something happened to work.
    expect(
      card.events
        .getEntries('advanced-camera-card:issue:trigger')
        .map((entry) => getIssueReason(entry.detail)),
    ).toEqual(['not_loading', 'not_loading']);
  });

  it('should re-attempt when the retry control is used', async () => {
    const mediaURL = createTemporarilyFailingMediaURL(1);
    const card = await mountCard({
      // Automatic retries switched off.
      view: { issues: { retry_seconds: 0 } },
      cameras: [createStillImageCameraConfig(CAMERA_ENTITY, mediaURL)],
    });

    await card.events.waitForFirst('advanced-camera-card:issue:trigger');

    // The status bar only summarizes. Everything a user can do about the
    // failure is behind it, which is the point of the issue report being
    // clickable.
    await card.clickControl(MEDIA_ISSUE_TITLE);
    await card.clickControl('Retry');

    await card.events.waitForFirst('advanced-camera-card:media:loaded');

    expect(isIssueReported(card)).toBe(false);
    expect(isLiveMediaShowing(card.card)).toBe(true);

    expect(getTestMediaRequestCount(mediaURL)).toBe(2);
  });

  it('should not report while a non-media view is showing', async () => {
    const card = await mountCard({
      menu: { style: 'outside' },
      cameras: [createStillImageCameraConfig(CAMERA_ENTITY, createFailingMediaURL())],
    });

    await card.events.waitForFirst('advanced-camera-card:issue:trigger');
    await waitForIssueReported(card);

    // Diagnostics shows no media at all, so there is nothing for an issue
    // report to be about and complaining there would be noise on an unrelated
    // screen.
    await card.holdControl(IRIS_CONTROL);
    await card.waitForSelector('advanced-camera-card-diagnostics');

    expect(isIssueReported(card)).toBe(false);

    // Returning to the camera brings the issue report back. Leaving the view is
    // not an answer to the failure, and coming back to a silently broken camera
    // would be worse than never having been told.
    await card.clickControl('Live view');
    await waitForIssueReported(card);

    expect(isIssueReported(card)).toBe(true);
  });

  it('should report media that stalls after it has loaded', async () => {
    const refreshSeconds = 2;

    const card = await mountCard({
      cameras: [
        {
          camera_entity: CAMERA_ENTITY,
          live_provider: 'image',
          image: {
            mode: 'url',
            // The first request is answered and every one after it is left
            // hanging, which is a camera that delivered a picture and then went
            // quiet. One that refused outright would be reported as a failure
            // rather than a stall.
            url: createStallingMediaURL(),
            refresh_seconds: refreshSeconds,
          },
        },
      ],
    });

    await card.events.waitForFirst('advanced-camera-card:media:loaded');
    expect(card.events.getEntries('advanced-camera-card:issue:trigger')).toHaveLength(0);

    // The card only starts its stall timer once the player has both loaded and
    // come on screen. The load is waited for above, so waiting for the provider
    // to be seen means the timer is running and the clock can be jumped through
    // it.
    await waitUntilObservedVisible(card, 'advanced-camera-card-live-provider');

    // A refreshing picture is allowed a whole refresh interval on top of the
    // standard window, so that one slow fetch is not called a stall.
    await card.advanceSeconds(refreshSeconds + FRAME_STALL_SECONDS);
    await waitForIssueReported(card);

    // Stalled rather than failed: the picture on screen is real but frozen, and
    // saying so is the difference between "this is old" and "this is broken".
    expect(getBlockNotificationText(card.card)).toContain('Stream stalled');
  });

  it('should trigger an issue for a camera snapshot that falls back to a stock image', async () => {
    // A camera-mode image that cannot be fetched swaps in a bundled stock
    // picture, so something is always on screen. That substitute must not be
    // announced as the camera's media arriving, or the failure it replaced
    // would be reported as recovered.
    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        status_bar: { style: 'outside' },
        cameras: [
          {
            camera_entity: CAMERA_ENTITY,
            live_provider: 'image',
            image: { mode: 'camera' },
          },
        ],
      }),
      createGenericCameraHASS({
        entities: {
          [CAMERA_ENTITY]: {
            state: 'idle',
            attributes: { entity_picture: createFailingMediaURL() },
          },
        },
      }),
    );

    const image = await card.waitForSelector<HTMLImageElement>('img');
    await card.events.waitForFirst('advanced-camera-card:issue:trigger');

    // The stock picture is being swapped into the same element. Wait for that
    // load specifically: it is the one that could be mistaken for the camera's
    // media arriving.
    await waitForImageLoaded(image);

    expect(isIssueReported(card)).toBe(true);
    expect(card.events.getEntries('advanced-camera-card:media:loaded')).toHaveLength(0);
  });

  it('should resolve the issue for a refreshing camera snapshot that recovers by itself', async () => {
    // Must use the real clock: the picture is refetched on a timer that fake
    // time would run through instantly, without the fetch in between ever being
    // answered.
    vi.useRealTimers();

    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        status_bar: { style: 'outside' },

        // Automatic retries disabled.
        view: { issues: { retry_seconds: 0 } },
        cameras: [
          {
            camera_entity: CAMERA_ENTITY,
            live_provider: 'image',
            image: { mode: 'camera', refresh_seconds: 1 },
          },
        ],
      }),
      createGenericCameraHASS({
        entities: {
          [CAMERA_ENTITY]: {
            state: 'idle',
            attributes: { entity_picture: createTemporarilyFailingMediaURL(1) },
          },
        },
      }),
    );

    await card.events.waitForFirst('advanced-camera-card:issue:trigger');
    await waitForIssueReported(card);

    // A picture that is refetched on a timer can recover on its own, and the
    // issue has to recover with it.
    await card.events.waitForFirst('advanced-camera-card:media:loaded');
    await waitForIssueCleared(card);

    expect(isLiveMediaShowing(card.card)).toBe(true);

    // Cameras that fetch each second must not announce failures each second.
    expect(card.events.getEntries('advanced-camera-card:issue:trigger')).toHaveLength(1);
  });

  it('should report a player that reports a playback error', async () => {
    const card = await mountCard({
      // A provider given nothing to play. It reports that it failed without
      // saying why, which is what a playback error is: every other reason
      // here is one the card was able to name.
      cameras: [{ camera_entity: CAMERA_ENTITY, live_provider: 'go2rtc' }],
    });

    await card.events.waitForFirst('advanced-camera-card:issue:trigger');
    await waitForIssueReported(card);

    expect(getBlockNotificationText(card.card)).toContain(
      'Could not get camera endpoint',
    );

    await card.clickControl(MEDIA_ISSUE_TITLE);
    await card.waitForSelector('advanced-camera-card-notification');

    expect(
      deepQuery(card.card, 'advanced-camera-card-notification')?.shadowRoot?.textContent,
    ).toContain('Playback error');
  });
});
