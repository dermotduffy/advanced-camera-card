import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RETRY_EXPONENTIAL_BASE_SECONDS } from '../../../../src/card-controller/issues/issue-manager';
import { MEDIA_LOADING_TIMEOUT_SECONDS } from '../../../../src/card-controller/issues/issues/media-unavailable';
import { LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS } from '../../../../src/components-lib/live/liveness/detectors/entity-availability';
import { FRAME_STALL_SECONDS } from '../../../../src/components-lib/media-player/frame-stall-watchdog';
import type { RawAdvancedCameraCardConfig } from '../../../../src/config/types';
import { MountedCard, type MountOptions } from '../../../browser/mounted-card';
import {
  createFailingMediaURL,
  createStallingMediaURL,
  createStillCameraHASS,
  createStillImageCameraConfig,
  createStillImageCardConfig,
  createTemporarilyFailingMediaURL,
  createUnansweredMediaURL,
  deepQuery,
  deepQueryAll,
  getBlockNotificationText,
  isLiveMediaShowing,
  STILL_CAMERA_ENTITY,
} from '../../../browser/test-utils';

const SECOND_CAMERA_ENTITY = 'camera.hallway';

const REPORT_TITLE = 'Media unavailable';

// Holding this reaches the diagnostics view, the only view showing no media
// that a camera without a media browsing engine can get to.
const IRIS_CONTROL = 'Iris / Default View / Unhide menu';

// Only the status bar counts as the report. The notification behind it carries
// the same title, so a wider search would answer a different question.
const findReport = (card: MountedCard): Element | null =>
  deepQuery(card.card, 'advanced-camera-card-status-bar')?.shadowRoot?.querySelector(
    `[title="${REPORT_TITLE}"]`,
  ) ?? null;

const isIssueReported = (card: MountedCard): boolean => !!findReport(card);

const waitForIssueReported = async (card: MountedCard): Promise<void> => {
  await vi.waitFor(() => {
    if (!findReport(card)) {
      throw new Error(`The issue was not reported: ${REPORT_TITLE}`);
    }
  });
};

interface MountCardOptions extends MountOptions {
  cameras?: string[];
}

/**
 * Every test here needs the status bar rendered, since that is where the report
 * appears.
 */
const mountCard = async (
  config?: Partial<RawAdvancedCameraCardConfig>,
  options?: MountCardOptions,
): Promise<MountedCard> => {
  const { cameras, ...mountOptions } = options ?? {};

  return await MountedCard.create(
    createStillImageCardConfig({ status_bar: { style: 'outside' }, ...config }),
    createStillCameraHASS({ cameras }),
    mountOptions,
  );
};

const mountCardSingleCamera = async (): Promise<MountedCard> => {
  const card = await mountCard();

  await card.events.waitForFirst('advanced-camera-card:media:loaded');

  return card;
};

const mountCardDualCameras = async (): Promise<MountedCard> => {
  const card = await mountCard(
    {
      live: { display: { mode: 'grid' } },
      cameras: [
        createStillImageCameraConfig(),
        createStillImageCameraConfig(SECOND_CAMERA_ENTITY),
      ],
    },
    {
      cameras: [SECOND_CAMERA_ENTITY],

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

  await card.events.waitForFirst('advanced-camera-card:media:loaded');

  return card;
};

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

    card.setEntityState(STILL_CAMERA_ENTITY, 'unavailable');

    // Just short of the grace period: reporting here would alarm on a camera
    // that is about to come back.
    await card.advanceSeconds(LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS - 1);
    expect(isIssueReported(card)).toBe(false);

    await card.advanceSeconds(1);
    expect(isIssueReported(card)).toBe(true);
  });

  it('should never report a camera that recovers within the grace period', async () => {
    const card = await mountCardSingleCamera();

    card.setEntityState(STILL_CAMERA_ENTITY, 'unavailable');
    await card.advanceSeconds(LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS - 1);

    card.setEntityState(STILL_CAMERA_ENTITY, 'idle');

    // Well past the point the report would have appeared had the blip not
    // ended. Nothing should ever have been shown.
    await card.advanceSeconds(LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS * 4);

    expect(isIssueReported(card)).toBe(false);
  });

  it('should name the camera that failed and why', async () => {
    const card = await mountCardDualCameras();

    card.setEntityState(SECOND_CAMERA_ENTITY, 'unavailable');
    await card.advanceSeconds(LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS);

    // Which camera, not just that something is wrong: with several on screen a
    // report that does not say which one leaves the user to guess.
    expect(getBlockNotificationText(card.card)).toContain('Camera entity unavailable');
    expect(getBlockNotificationText(card.card)).toContain(SECOND_CAMERA_ENTITY);
  });

  it('should leave the cameras that are still working alone', async () => {
    const card = await mountCardDualCameras();

    card.setEntityState(SECOND_CAMERA_ENTITY, 'unavailable');
    await card.advanceSeconds(LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS);

    // One camera failing must not take the other down with it.
    expect(
      deepQueryAll(card.card, 'advanced-camera-card-notification-block'),
    ).toHaveLength(1);
    expect(isLiveMediaShowing(card.card)).toBe(true);
  });

  it('should report a camera whose media fails to load', async () => {
    const card = await mountCard({
      cameras: [
        createStillImageCameraConfig(STILL_CAMERA_ENTITY, createFailingMediaURL()),
      ],
    });

    // The entity is present and healthy, so the failed fetch is the only thing
    // that can be reported. It is reported as soon as the load fails rather
    // than after the loading timeout, because a failure is not a slow load.
    await card.events.waitForFirst('advanced-camera-card:issue:trigger');
    await waitForIssueReported(card);

    expect(getBlockNotificationText(card.card)).toContain('Could not load image');
    expect(getBlockNotificationText(card.card)).toContain(STILL_CAMERA_ENTITY);
  });

  it('should clear the report once the camera delivers media again', async () => {
    const card = await mountCard({
      cameras: [
        createStillImageCameraConfig(
          STILL_CAMERA_ENTITY,
          createTemporarilyFailingMediaURL(1),
        ),
      ],
    });

    await card.events.waitForFirst('advanced-camera-card:issue:trigger');
    await waitForIssueReported(card);

    // Nothing here asks the card to try again. A camera that has come back must
    // be picked up by the card's own retry, or the report stays up forever for
    // a user who is looking at a working camera.
    await card.advanceSeconds(RETRY_EXPONENTIAL_BASE_SECONDS);
    await card.events.waitForFirst('advanced-camera-card:media:loaded');

    expect(isIssueReported(card)).toBe(false);

    // The picture is back, so the cleared report is not the card having thrown
    // the whole live view away.
    expect(isLiveMediaShowing(card.card)).toBe(true);
  });

  it('should wait out the loading timeout before reporting a slow camera', async () => {
    const card = await mountCard({
      cameras: [
        createStillImageCameraConfig(STILL_CAMERA_ENTITY, createUnansweredMediaURL()),
      ],
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
    // next.
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
        createStillImageCameraConfig(
          STILL_CAMERA_ENTITY,
          createTemporarilyFailingMediaURL(2),
        ),
      ],
    });

    // Two failures: the first attempt, and a retry after it. Giving up after
    // one would leave a camera dark that was about to come back.
    await card.events.waitForCount('advanced-camera-card:issue:trigger', 2);
    await waitForIssueReported(card);

    // The third attempt is served.
    await card.events.waitForFirst('advanced-camera-card:media:loaded');

    expect(isIssueReported(card)).toBe(false);
    expect(isLiveMediaShowing(card.card)).toBe(true);

    // Exactly the two attempts that failed, so the retry ran once rather than
    // spinning until something happened to work.
    expect(card.events.getEntries('advanced-camera-card:issue:trigger')).toHaveLength(2);
  });

  it('should re-attempt when the retry control is used', async () => {
    const card = await mountCard({
      // Automatic retries switched off.
      view: { issues: { retry_seconds: 0 } },
      cameras: [
        createStillImageCameraConfig(
          STILL_CAMERA_ENTITY,
          createTemporarilyFailingMediaURL(1),
        ),
      ],
    });

    await card.events.waitForFirst('advanced-camera-card:issue:trigger');

    // The status bar only summarises. Everything a user can do about the
    // failure is behind it, which is the point of the report being clickable.
    await card.clickControl(REPORT_TITLE);
    await card.clickControl('Retry');

    await card.events.waitForFirst('advanced-camera-card:media:loaded');

    expect(isIssueReported(card)).toBe(false);
    expect(isLiveMediaShowing(card.card)).toBe(true);
  });

  it('should not report while a non-media view is showing', async () => {
    const card = await mountCard({
      menu: { style: 'outside' },
      cameras: [
        createStillImageCameraConfig(STILL_CAMERA_ENTITY, createFailingMediaURL()),
      ],
    });

    await card.events.waitForFirst('advanced-camera-card:issue:trigger');
    await waitForIssueReported(card);

    // Diagnostics shows no media at all, so there is nothing for the report to
    // be about and complaining there would be noise on an unrelated screen.
    await card.holdControl(IRIS_CONTROL);
    await card.waitForSelector('advanced-camera-card-diagnostics');

    expect(isIssueReported(card)).toBe(false);

    // Returning to the camera brings the report back. Leaving the view is not
    // an answer to the failure, and coming back to a silently broken camera
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
          camera_entity: STILL_CAMERA_ENTITY,
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

    // One missed refresh is not a stall. A camera gets a whole refresh interval
    // on top of the standard window before silence is held against it.
    await card.advanceSeconds(refreshSeconds + FRAME_STALL_SECONDS - 1);
    expect(isIssueReported(card)).toBe(false);

    // Past it. The window is measured from a real media load rather than from
    // anything on the card's clock, so landing exactly on the deadline is a
    // race: step over it instead.
    await card.advanceSeconds(2);
    expect(isIssueReported(card)).toBe(true);

    // Stalled rather than failed: the picture on screen is real but frozen, and
    // saying so is the difference between "this is old" and "this is broken".
    expect(getBlockNotificationText(card.card)).toContain('Stream stalled');
  });

  it('should report a player that reports a playback error', async () => {
    const card = await mountCard({
      // A provider given nothing to play. It reports that it failed without
      // saying why, which is what a playback error is: every other reason
      // here is one the card was able to name.
      cameras: [{ camera_entity: STILL_CAMERA_ENTITY, live_provider: 'go2rtc' }],
    });

    await card.events.waitForFirst('advanced-camera-card:issue:trigger');
    await waitForIssueReported(card);

    expect(getBlockNotificationText(card.card)).toContain(
      'Could not get camera endpoint',
    );

    await card.clickControl(REPORT_TITLE);
    await card.waitForSelector('advanced-camera-card-notification');

    expect(
      deepQuery(card.card, 'advanced-camera-card-notification')?.shadowRoot?.textContent,
    ).toContain('Playback error');
  });
});
