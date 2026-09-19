import { assert, describe, expect, it } from 'vitest';

import type { FrigateReview } from '../../../src/camera-manager/frigate/types';
import type { ThumbnailStyle } from '../../../src/config/schema/common/controls/thumbnails';
import {
  createFrontDoorFolderMedia,
  FRONT_DOOR_FOLDER_CONTENT_ID,
  registerFrontDoorFolder,
} from '../../browser/browse-media';
import { deepQuery, deepQueryAll } from '../../browser/dom';
import {
  createFrigateCameraDescription,
  createTestFrigateEvent,
  createTestFrigateReview,
  EVENT_TIME_NEWER,
  mountCardWithFrigate,
} from '../../browser/fake-frigate';
import { MountedCardFactory, type MountedCard } from '../../browser/mounted-card';
import {
  createCameraHASS,
  createStillImageCameraConfig,
  createStillImageCardConfig,
  waitForThumbnails,
} from '../../browser/test-utils';

const mountGallery = async (
  thumbnailStyle: ThumbnailStyle,
  size: number,
  inProgress?: boolean,
): Promise<MountedCard> => {
  const { card } = await mountCardWithFrigate(
    [
      createTestFrigateEvent('event', EVENT_TIME_NEWER, {
        ...(inProgress && { end_time: null }),
      }),
    ],
    {
      view: { default: 'clips' },
      media_gallery: {
        controls: { thumbnails: { size, style: thumbnailStyle } },
      },
    },
  );
  await waitForThumbnails(card, 1);
  return card;
};

const mountReviewGallery = async (
  review: Partial<FrigateReview>,
): Promise<MountedCard> => {
  const { card } = await mountCardWithFrigate(
    [],
    {
      view: { default: 'reviews' },
      cameras: [{ ...createStillImageCameraConfig(), media: { reviewed: 'all' } }],
      media_gallery: {
        controls: {
          thumbnails: {
            style: 'overlay',
            show_review_control: false,
            show_favorite_control: false,
          },
        },
      },
    },
    [createTestFrigateReview('review', EVENT_TIME_NEWER, review)],
  );
  await waitForThumbnails(card, 1);
  return card;
};

const FOLDER_NAME = 'Recordings';

const mountFolderGallery = async (size: number): Promise<MountedCard> => {
  const hass = createCameraHASS([createFrigateCameraDescription()]);

  registerFrontDoorFolder(hass, [
    {
      ...createFrontDoorFolderMedia(FOLDER_NAME, 'directory'),
      can_play: false,
      can_expand: true,
    },
  ]);

  const card = await MountedCardFactory.createFromSource(
    createStillImageCardConfig({
      view: { default: 'folders' },
      folders: [{ type: 'ha', ha: { path: [{ id: FRONT_DOOR_FOLDER_CONTENT_ID }] } }],
      media_gallery: {
        controls: { thumbnails: { size, style: 'overlay' } },
      },
    }),
    hass,
  );
  // The gallery renders the folder plus an "up" thumbnail to its parent.
  await waitForThumbnails(card, 2);
  return card;
};

const getOverlay = (card: MountedCard): Element | null =>
  deepQuery(card.card, 'advanced-camera-card-thumbnail-details-overlay');

const getFeature = (card: MountedCard): Element => {
  const feature = deepQuery(card.card, 'advanced-camera-card-thumbnail-feature');
  assert(feature);
  return feature;
};

describe('AdvancedCameraCardThumbnailDetailsOverlay', () => {
  it('should render an overlay for the overlay style', async () => {
    const card = await mountGallery('overlay', 100);

    const overlay = getOverlay(card);
    assert(overlay);
    expect(overlay.getAttribute('tier')).toBe('standard');
    expect(deepQuery(overlay, '.details')).not.toBeNull();
  });

  it('should render an overlay for the hover style', async () => {
    const card = await mountGallery('hover', 100);

    const overlay = getOverlay(card);
    assert(overlay);
    expect(deepQuery(overlay, '.details')).not.toBeNull();
  });

  it('should render no overlay for the panel style', async () => {
    const card = await mountGallery('panel', 100);

    expect(getOverlay(card)).toBeNull();
    expect(
      deepQuery(card.card, 'advanced-camera-card-thumbnail-details-panel'),
    ).not.toBeNull();
  });

  it('should render no overlay when details are off', async () => {
    const card = await mountGallery('none', 100);

    expect(getOverlay(card)).toBeNull();
  });

  it('should move the label out of the smallest permanent overlay', async () => {
    const card = await mountGallery('overlay', 75);

    const overlay = getOverlay(card);
    assert(overlay);
    expect(overlay.getAttribute('tier')).toBe('compact');
    expect(deepQuery(overlay, '.corner-label')).not.toBeNull();
    expect(deepQuery(overlay, '.label')).toBeNull();
  });

  it('should keep the label in the overlay at a larger size', async () => {
    const card = await mountGallery('overlay', 300);

    const overlay = getOverlay(card);
    assert(overlay);
    expect(overlay.getAttribute('tier')).toBe('poster');
    expect(deepQuery(overlay, '.corner-label')).toBeNull();
    expect(deepQuery(overlay, '.label')).not.toBeNull();
  });

  it('should hide the overlay until the thumbnail is hovered', async () => {
    const card = await mountGallery('hover', 100);

    const overlay = getOverlay(card);
    assert(overlay);
    const details = deepQuery(overlay, '.details');
    assert(details);

    expect(getComputedStyle(details).opacity).toBe('0');
  });

  it('should show the overlay at rest when it is permanent', async () => {
    const card = await mountGallery('overlay', 100);

    const overlay = getOverlay(card);
    assert(overlay);
    const details = deepQuery(overlay, '.details');
    assert(details);

    expect(getComputedStyle(details).opacity).toBe('1');
  });

  describe('the state of the item', () => {
    it.each([
      ['alert' as const, '4px'],
      ['detection' as const, '3px'],
    ])('should rank a %s with a bar %s tall', async (severity, height) => {
      const card = await mountReviewGallery({ severity });

      expect(getComputedStyle(getFeature(card), '::before').height).toBe(height);
    });

    it('should set the label weight depending on review state', async () => {
      const weight = (card: MountedCard): number => {
        const label = deepQuery(getOverlay(card) ?? card.card, '.label');
        assert(label);
        return parseFloat(getComputedStyle(label).fontWeight);
      };

      const reviewed = weight(await mountReviewGallery({ has_been_reviewed: true }));
      const unreviewed = weight(await mountReviewGallery({ has_been_reviewed: false }));
      const notReviewable = weight(await mountGallery('overlay', 100));

      expect(reviewed).toBeLessThan(notReviewable);
      expect(notReviewable).toBeLessThan(unreviewed);
    });

    it('should show no severity bar on media that cannot be reviewed', async () => {
      const card = await mountGallery('overlay', 100);

      expect(getFeature(card).hasAttribute('severity')).toBe(false);
      expect(deepQuery(getOverlay(card) ?? card.card, '.label')).not.toBeNull();
    });
  });

  it('should lead with the name of an item that has no time', async () => {
    const card = await mountFolderGallery(75);

    const overlay = await card.waitForRender(
      () =>
        deepQueryAll(card.card, 'advanced-camera-card-thumbnail-details-overlay').find(
          (candidate) => deepQuery(candidate, '.label')?.textContent === FOLDER_NAME,
        ) ?? null,
      'the folder overlay',
    );

    expect(deepQuery(overlay, '.corner-label')).toBeNull();

    const label = deepQuery(overlay, '.label');
    const details = deepQuery(overlay, '.details');
    assert(label && details);

    expect(label.getBoundingClientRect().width).toBeGreaterThan(0);

    expect(
      label.getBoundingClientRect().left - details.getBoundingClientRect().left,
    ).toBeLessThan(10);
  });

  describe('media that is still recording', () => {
    it('should show the REC text and its dot where the label has its own line', async () => {
      const card = await mountGallery('overlay', 300, true);
      const overlay = getOverlay(card);
      assert(overlay);

      expect(overlay.hasAttribute('one-line')).toBe(false);
      expect(
        getComputedStyle(deepQuery(overlay, '.in-progress .label') as Element).display,
      ).not.toBe('none');
    });

    it('should drop the REC text when the label shares its line with the time', async () => {
      const card = await mountGallery('overlay', 100, true);
      const overlay = getOverlay(card);
      assert(overlay);

      expect(overlay.hasAttribute('one-line')).toBe(true);

      const label = deepQuery(overlay, '.in-progress .label');
      assert(label);
      expect(getComputedStyle(label).display).toBe('none');

      // A 'fat' dot is all that is left to carry the state.
      const dot = deepQuery(overlay, '.in-progress .dot');
      assert(dot);
      expect(dot.getBoundingClientRect().width).toBeGreaterThan(
        parseFloat(getComputedStyle(dot).fontSize) * 0.5,
      );
    });
  });

  it('should keep the details above the picture', async () => {
    const card = await mountGallery('overlay', 300);

    const feature = deepQuery(card.card, 'advanced-camera-card-thumbnail-feature');
    assert(feature);
    const media = deepQuery(feature, '.media');
    assert(media);

    // Tree order alone keeps the overlay on top: any `z-index` would put the
    // picture over it.
    expect(getComputedStyle(media).zIndex).toBe('auto');
  });

  it('should not intercept a click on the media', async () => {
    const card = await mountGallery('overlay', 100);

    const overlay = getOverlay(card);
    assert(overlay);

    expect(getComputedStyle(overlay).pointerEvents).toBe('none');
  });
});
