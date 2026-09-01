import { assert, describe, expect, it } from 'vitest';

import type { FrigateEvent } from '../../../src/camera-manager/frigate/types';
import type { PartialAdvancedCameraCardConfig } from '../../../src/config/types';
import type { BrowseMedia } from '../../../src/ha/browse-media/types';
import { deepQuery } from '../../browser/dom';
import {
  createFrigateCameraDescription,
  createTestFrigateEvent,
  EVENT_TIME_NEWER,
  EVENT_TIME_OLDER,
  FakeFrigate,
  mountCardWithFrigate,
} from '../../browser/fake-frigate';
import {
  CLIP_FIXTURE_FILENAME,
  createFixtureURL,
  SNAPSHOT_FIXTURE_FILENAME,
} from '../../browser/fixtures';
import { MountedCardFactory, type MountedCard } from '../../browser/mounted-card';
import {
  clickThumbnail,
  createCameraHASS,
  createStillImageCardConfig,
  getBlockNotificationText,
  getMediaViewerMediaURLs,
  getThumbnails,
  waitForThumbnails,
} from '../../browser/test-utils';

const NO_MEDIA_TEXT = 'No media to display';

const mountCard = async (
  events: FrigateEvent[],
  config?: PartialAdvancedCameraCardConfig,
): Promise<MountedCard> =>
  (await mountCardWithFrigate(events, { view: { default: 'clips' }, ...config })).card;

describe('AdvancedCameraCardGallery', () => {
  it('should show a thumbnail for every event the camera detected', async () => {
    const card = await mountCard([
      createTestFrigateEvent('older', EVENT_TIME_OLDER),
      createTestFrigateEvent('newer', EVENT_TIME_NEWER),
    ]);

    await waitForThumbnails(card, 2);

    expect(getThumbnails(card.card)).toHaveLength(2);
  });

  it('should show the picture Frigate has of each event', async () => {
    const card = await mountCard([createTestFrigateEvent('newer', EVENT_TIME_NEWER)]);

    await waitForThumbnails(card, 1);
    const thumbnail = getThumbnails(card.card)[0];

    // A thumbnail that never arrives is drawn as an icon and nothing else says
    // so, so counting thumbnails says nothing about whether there is a picture
    // in them. The card fetches one with the user's credentials and embeds what
    // comes back, which is why the result is a data URL rather than the path
    // asked for.
    const image = await card.waitForRender(
      () => deepQuery<HTMLImageElement>(thumbnail, 'img'),
      'the thumbnail picture',
    );

    expect(image.src).toMatch(/^data:image\/png/);
  });

  it('should fill the thumbnail with a square frame when the picture cannot be fetched', async () => {
    const hass = createCameraHASS([createFrigateCameraDescription()]);
    const frigate = new FakeFrigate(hass);
    frigate.setEvents([createTestFrigateEvent('newer', EVENT_TIME_NEWER)]);
    frigate.failThumbnails();

    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig({ view: { default: 'clips' } }),
      hass,
    );

    await waitForThumbnails(card, 1);
    const thumbnail = getThumbnails(card.card)[0];

    const frame = await card.waitForRender(
      () => deepQuery<HTMLElement>(thumbnail, '.icon-container'),
      'the fallback icon frame',
    );
    const box = deepQuery<HTMLElement>(
      thumbnail,
      'advanced-camera-card-thumbnail-feature-thumbnail',
    );
    assert(box);

    const icon = deepQuery<HTMLElement>(frame, 'advanced-camera-card-icon');
    assert(icon);

    const boxRect = box.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();

    const expectClose = (actual: number, expected: number): void =>
      expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
        Math.max(
          4, // Allow at least 4 pixels of tolerance.
          expected * 0.05,
        ),
      );

    // The frame spans the whole thumbnail box and is square.
    expectClose(frameRect.width, boxRect.width);
    expectClose(frameRect.height, boxRect.height);
    expectClose(frameRect.width, frameRect.height);

    // The icon sits centered in the frame at half its size.
    expectClose(iconRect.width, frameRect.width / 2);
    expectClose(iconRect.height, frameRect.height / 2);
    expectClose(iconRect.left - frameRect.left, (frameRect.width - iconRect.width) / 2);
    expectClose(iconRect.top - frameRect.top, (frameRect.height - iconRect.height) / 2);
  });

  it('should say there is nothing to view when the camera has no events', async () => {
    const card = await mountCard([]);

    // The element renders before its text, so waiting for the element alone can
    // read it while it is still empty.
    await card.waitForRender(
      () => getBlockNotificationText(card.card).includes(NO_MEDIA_TEXT) || null,
      `the "${NO_MEDIA_TEXT}" notification`,
    );

    expect(getThumbnails(card.card)).toHaveLength(0);
  });

  it('should open the clips gallery from the live view', async () => {
    const card = await mountCard([createTestFrigateEvent('newer', EVENT_TIME_NEWER)], {
      view: { default: 'live' },

      // The clips button is hidden by default.
      menu: { style: 'outside', buttons: { clips: { enabled: true } } },
    });

    await card.events.waitForFirst('advanced-camera-card:media:loaded');

    await card.clickControl('Clips gallery');
    await card.waitForSelector('advanced-camera-card-gallery');

    await waitForThumbnails(card, 1);
    expect(getThumbnails(card.card)).toHaveLength(1);
  });

  it('should open the viewer on the media that was clicked', async () => {
    const card = await mountCard([
      createTestFrigateEvent('older', EVENT_TIME_OLDER),
      createTestFrigateEvent('newer', EVENT_TIME_NEWER),
    ]);

    await waitForThumbnails(card, 2);

    // The newest event is shown first, so index 1 is the older of the two.
    await clickThumbnail(card.card, 1);
    await card.events.waitForFirst('advanced-camera-card:media:loaded');

    await card.waitForSelector('advanced-camera-card-viewer-carousel');

    expect(getMediaViewerMediaURLs(card.card)).toEqual([
      expect.stringContaining('clip.webm?event=older'),
    ]);
  });

  it('should show the media filter', async () => {
    const card = await mountCard([createTestFrigateEvent('newer', EVENT_TIME_NEWER)]);

    await card.waitForSelector('advanced-camera-card-media-filter');

    expect(deepQuery(card.card, 'advanced-camera-card-media-filter')).not.toBeNull();
  });

  it('should not show the media filter when its mode is none', async () => {
    const card = await mountCard([createTestFrigateEvent('newer', EVENT_TIME_NEWER)], {
      media_gallery: { controls: { filter: { mode: 'none' } } },
    });

    await waitForThumbnails(card, 1);

    // The gallery still renders, so a missing filter is not a missing gallery.
    expect(deepQuery(card.card, 'advanced-camera-card-gallery')).not.toBeNull();
    expect(deepQuery(card.card, 'advanced-camera-card-media-filter')).toBeNull();
  });
});

describe('AdvancedCameraCardGallery with a folder', () => {
  const FOLDER_ID = 'media-source://media_source/local/front-door';

  // What Home Assistant's local media source resolves an image to.
  const IMAGE_PATH = '/media/local/front-door/clip.jpg';

  const createFolderMedia = (title: string, mediaClass: string): BrowseMedia => ({
    title,
    media_class: mediaClass,
    media_content_type: mediaClass,
    media_content_id: `${FOLDER_ID}/${title}`,
    can_play: true,
    can_expand: false,
    thumbnail: null,
    children: null,
  });

  // A folder holding a clip and the image a user generated for it, which is
  // what the `thumbnail` parser exists to pair up.
  const mountFolderCard = async (): Promise<MountedCard> => {
    const hass = createCameraHASS([createFrigateCameraDescription()]);

    hass.registerBrowsableMedia({
      title: 'front-door',
      media_class: 'directory',
      media_content_type: 'directory',
      media_content_id: FOLDER_ID,
      can_play: false,
      can_expand: true,
      thumbnail: null,
      children: [
        createFolderMedia('clip.mp4', 'video'),
        createFolderMedia('clip.jpg', 'image'),
      ],
    });

    hass.registerMediaSource(/clip\.jpg$/, async () => ({
      url: IMAGE_PATH,
      mime_type: 'image/png',
    }));
    hass.registerMediaSource(/clip\.mp4$/, async () => ({
      url: createFixtureURL(CLIP_FIXTURE_FILENAME),
      mime_type: 'video/webm',
    }));
    hass.registerPath(
      new RegExp(`^${IMAGE_PATH}$`),
      async () => await fetch(createFixtureURL(SNAPSHOT_FIXTURE_FILENAME)),
    );

    return await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        view: { default: 'folders' },
        folders: [
          {
            type: 'ha',
            ha: {
              path: [{ id: FOLDER_ID }, { parsers: [{ type: 'thumbnail' }] }],
            },
          },
        ],
      }),
      hass,
    );
  };

  const mountCardThumbnailedWithItsOwnClip = async (): Promise<MountedCard> => {
    const hass = createCameraHASS([createFrigateCameraDescription()]);

    hass.registerBrowsableMedia({
      title: 'front-door',
      media_class: 'directory',
      media_content_type: 'directory',
      media_content_id: FOLDER_ID,
      can_play: false,
      can_expand: true,
      thumbnail: null,
      children: [createFolderMedia('clip.mp4', 'video')],
    });

    hass.registerMediaSource(/clip\.mp4$/, async () => ({
      url: createFixtureURL(CLIP_FIXTURE_FILENAME),
      mime_type: 'video/webm',
    }));

    return await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        view: { default: 'folders' },
        folders: [
          {
            type: 'ha',
            ha: {
              path: [
                { id: FOLDER_ID },
                {
                  parsers: [
                    {
                      type: 'thumbnail',

                      // A template that renders the media's own ID (this is
                      // equivalent to a `replace` that matches nothing, so is a
                      // likely common failure mode).
                      value_template: '{{ acc.media.id }}',
                    },
                  ],
                },
              ],
            },
          },
        ],
      }),
      hass,
    );
  };

  it('should not use media that is not an image as a thumbnail', async () => {
    const card = await mountCardThumbnailedWithItsOwnClip();

    await waitForThumbnails(card, 2);
    await card.console.waitForMessage(/Thumbnail is not an image/, { level: 'warn' });

    expect(deepQuery<HTMLImageElement>(card.card, 'img')).toBeNull();
  });

  const mountCardWithAThumbnailedFolder = async (): Promise<MountedCard> => {
    const hass = createCameraHASS([createFrigateCameraDescription()]);

    hass.registerBrowsableMedia({
      title: 'front-door',
      media_class: 'directory',
      media_content_type: 'directory',
      media_content_id: FOLDER_ID,
      can_play: false,
      can_expand: true,
      thumbnail: null,
      children: [
        {
          ...createFolderMedia('2026-08-28', 'directory'),
          can_play: false,
          can_expand: true,
        },
        createFolderMedia('2026-08-28.jpg', 'image'),
      ],
    });

    hass.registerMediaSource(/\.jpg$/, async () => ({
      url: IMAGE_PATH,
      mime_type: 'image/png',
    }));
    hass.registerPath(
      new RegExp(`^${IMAGE_PATH}$`),
      async () => await fetch(createFixtureURL(SNAPSHOT_FIXTURE_FILENAME)),
    );

    return await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        view: { default: 'folders' },
        folders: [
          {
            type: 'ha',
            ha: { path: [{ id: FOLDER_ID }, { parsers: [{ type: 'thumbnail' }] }] },
          },
        ],
      }),
      hass,
    );
  };

  it('should show a folder picture in full rather than cropped', async () => {
    const card = await mountCardWithAThumbnailedFolder();

    // The folder and the tile that navigates "up".
    await waitForThumbnails(card, 2);
    const picture = await card.waitForRender(
      () =>
        getThumbnails(card.card)
          .map((tile) => deepQuery<HTMLImageElement>(tile, 'img'))
          .find((image) => !!image) ?? null,
      'the folder picture',
    );

    expect(getComputedStyle(picture).objectFit).toBe('contain');
  });

  it('should show folder media with a matching image as its thumbnail', async () => {
    const card = await mountFolderCard();

    // The gallery renders a tile for navigating out of the folder as well as
    // one per media, so the clip and that tile are the two expected here. A
    // third would mean the thumbnail image was incorrectly shown in its own
    // right rather than being used as the clip's thumbnail.
    await waitForThumbnails(card, 2);
    expect(getThumbnails(card.card)).toHaveLength(2);

    // A thumbnail that never arrives is drawn as an icon. The expected
    // thumbnail would be a data URL.
    const image = await card.waitForRender(
      () => deepQuery<HTMLImageElement>(card.card, 'img'),
      'the thumbnail picture',
    );
    expect(image.src).toMatch(/^data:image\/png;base64,/);
  });
});
