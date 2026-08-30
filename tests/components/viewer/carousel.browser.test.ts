import { assert, describe, expect, it, onTestFinished, vi } from 'vitest';

import { MEDIA_LOADING_TIMEOUT_SECONDS } from '../../../src/components-lib/media-load-watchdog-controller';
import type { PartialAdvancedCameraCardConfig } from '../../../src/config/types';
import { clickElement, deepQuery } from '../../browser/dom';
import {
  createTestFrigateEvent,
  EVENT_TIME_NEWER,
  EVENT_TIME_OLDER,
  mountCardWithFrigate,
} from '../../browser/fake-frigate';
import type { MountedCard } from '../../browser/mounted-card';
import { createFailingMediaURL, useTestMedia } from '../../browser/test-media';
import {
  clickNextPreviousMedia,
  clickThumbnail,
  getMediaViewerMediaURLs,
  getSelectedThumbnail,
  getStatusBarItem,
  getStatusBarStrings,
  getThumbnails,
  waitForMediaViewerMedia,
  waitForThumbnails,
} from '../../browser/test-utils';

const EVENTS = [
  createTestFrigateEvent('older', EVENT_TIME_OLDER),
  createTestFrigateEvent('newer', EVENT_TIME_NEWER),
];

// What the status bar calls a media failure, which is where the viewer shows
// the issue: the media it cannot show is still on screen behind the carousel.
const MEDIA_ISSUE_TITLE = 'Media unavailable';

// The thumbnail carousel sits in a drawer by default, which is harder to click.
const CONFIG_THUMBNAILS_BELOW: PartialAdvancedCameraCardConfig = {
  media_viewer: { controls: { thumbnails: { mode: 'below' } } },
};

interface ViewerOptions {
  config?: PartialAdvancedCameraCardConfig;

  // Which gallery thumbnail to open the viewer on. The newest event is first.
  thumbnail?: number;
}

const mountViewer = async (
  events = EVENTS,
  options?: ViewerOptions,
): Promise<MountedCard> => {
  const { card } = await mountCardWithFrigate(events, {
    view: { default: 'clips' },
    ...options?.config,
  });

  await waitForThumbnails(card, events.length);
  await clickThumbnail(card.card, options?.thumbnail ?? 0);
  await card.events.waitForFirst('advanced-camera-card:media:loaded');

  return card;
};

// One test here has a clip that never loads, which is served from within the
// page rather than by the dev server.
useTestMedia();

describe('AdvancedCameraCardViewerCarousel', () => {
  it('should play the clip that was opened', async () => {
    const card = await mountViewer();

    expect(getMediaViewerMediaURLs(card.card)).toEqual([
      expect.stringContaining('clip.webm?event=newer'),
    ]);
    expect(deepQuery(card.card, 'advanced-camera-card-video-player')).not.toBeNull();
  });

  it('should show a snapshot as a still image', async () => {
    const card = await mountViewer(EVENTS, {
      config: { view: { default: 'snapshots' } },
    });

    expect(getMediaViewerMediaURLs(card.card)).toEqual([
      expect.stringContaining('still-red.png?event=newer'),
    ]);
    expect(deepQuery(card.card, 'advanced-camera-card-image-player')).not.toBeNull();
    expect(deepQuery(card.card, 'advanced-camera-card-video-player')).toBeNull();
  });

  it('should show the next media when the next control is used', async () => {
    // Opened on the older event, so there is a newer one to move on to.
    const card = await mountViewer(EVENTS, { thumbnail: 1 });

    await clickNextPreviousMedia(card.card, 'right');

    await waitForMediaViewerMedia(card, 'clip.webm?event=newer');
    expect(getSelectedThumbnail(card.card)).toBe(getThumbnails(card.card)[1]);
  });

  it('should show the media selected in the thumbnail carousel', async () => {
    const card = await mountViewer(EVENTS, { config: CONFIG_THUMBNAILS_BELOW });

    // The viewer runs oldest first (gallery is the opposite). This is the oldest.
    await clickThumbnail(card.card, 0);

    await waitForMediaViewerMedia(card, 'clip.webm?event=older');
    expect(getSelectedThumbnail(card.card)).toBe(getThumbnails(card.card)[0]);
  });

  it('should name the media being viewed in the status bar', async () => {
    const card = await mountViewer(
      [
        createTestFrigateEvent('older', EVENT_TIME_OLDER, { label: 'car' }),
        createTestFrigateEvent('newer', EVENT_TIME_NEWER, { label: 'person' }),
      ],
      { config: { status_bar: { style: 'outside' }, ...CONFIG_THUMBNAILS_BELOW } },
    );

    expect(getStatusBarStrings(card.card).join(' ')).toContain('Person');

    await clickThumbnail(card.card, 0);
    await waitForMediaViewerMedia(card, 'clip.webm?event=older');

    expect(getStatusBarStrings(card.card).join(' ')).toContain('Car');
  });

  it('should play the clip when a snapshot is clicked', async () => {
    const card = await mountViewer(EVENTS, {
      config: { view: { default: 'snapshots' } },
    });

    const snapshot = deepQuery(card.card, 'advanced-camera-card-image-player');
    assert(snapshot);

    await clickElement(snapshot);

    await waitForMediaViewerMedia(card, 'clip.webm?event=newer');
  });

  it('should pause the media that is moved away from', async () => {
    // Opened on the older event, so there is a newer one to move on to.
    const card = await mountViewer(EVENTS, { thumbnail: 1 });

    // `auto_play` covers the selected media, so the clip starts on its own.
    await card.events.waitForFirst('advanced-camera-card:media:play');

    await clickNextPreviousMedia(card.card, 'right');

    // Leaving a clip playing behind the one on screen would have two videos
    // running at once, and the user hearing the one they cannot see.
    await card.events.waitForFirst('advanced-camera-card:media:pause');
  });

  it('should report media that cannot be loaded', async () => {
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });

    const { card, frigate } = await mountCardWithFrigate(EVENTS, {
      view: { default: 'clips' },
      status_bar: { style: 'outside' },
    });
    frigate.setMediaURL('newer', 'clips', createFailingMediaURL());

    await waitForThumbnails(card, EVENTS.length);
    await clickThumbnail(card.card, 0);

    // The card starts its load timer when the player is rendered, so waiting for
    // the player means the timer is running and the clock can be jumped.
    await card.waitForSelector('video');

    // A clip that refuses to load says nothing of its own, so the card has only
    // silence to go on and triggers an issue once it has waited long enough.
    await card.advanceSeconds(MEDIA_LOADING_TIMEOUT_SECONDS);

    await card.waitForRender(
      () => getStatusBarItem(card.card, MEDIA_ISSUE_TITLE),
      `the ${MEDIA_ISSUE_TITLE} issue being reported`,
    );
  });

  it('should build a new player for a failed clip when the retry control is used', async () => {
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });

    const { card, frigate } = await mountCardWithFrigate(EVENTS, {
      // Automatic retries switched off, so the control below is the only one.
      view: { default: 'clips', issues: { retry_seconds: 0 } },
      status_bar: { style: 'outside' },
    });
    frigate.setMediaURL('newer', 'clips', createFailingMediaURL());

    await waitForThumbnails(card, EVENTS.length);
    await clickThumbnail(card.card, 0);
    const failedPlayer = await card.waitForSelector('video');
    await card.advanceSeconds(MEDIA_LOADING_TIMEOUT_SECONDS);
    await card.waitForRender(
      () => getStatusBarItem(card.card, MEDIA_ISSUE_TITLE),
      `the ${MEDIA_ISSUE_TITLE} issue being reported`,
    );

    await card.clickControl(MEDIA_ISSUE_TITLE);
    await card.clickControl('Retry');

    // A second player, not the one that failed: the retry throws the old one
    // away, and the replacement has to render and ask for the clip again rather
    // than sit there empty.
    await card.waitForRender(() => {
      const player = deepQuery(card.card, 'video');
      return player && player !== failedPlayer ? player : null;
    }, 'the clip player being rebuilt');
  });

  it('should return to the gallery from the viewer', async () => {
    const card = await mountViewer(EVENTS, {
      config: {
        // The clips button is hidden by default.
        menu: { style: 'outside', buttons: { clips: { enabled: true } } },
      },
    });

    await card.clickControl('Clips gallery');

    await card.waitForSelector('advanced-camera-card-gallery');
    expect(deepQuery(card.card, 'advanced-camera-card-viewer-carousel')).toBeNull();
  });

  it('should cap its own height to fit the media it shows', async () => {
    const card = await mountViewer();

    const carousel = deepQuery<HTMLElement>(
      card.card,
      'advanced-camera-card-viewer-carousel',
    );
    assert(carousel);

    await card.waitForRender(
      () => carousel.style.maxHeight || null,
      'the carousel capping its own height',
    );

    // Outside a grid the carousel fills the card, so the cap is what gives the
    // card the height of its media rather than of whatever contains it.
    expect(parseFloat(carousel.style.maxHeight)).toBe(
      carousel.getBoundingClientRect().height,
    );
  });
});
