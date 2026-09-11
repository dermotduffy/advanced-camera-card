import { describe, expect, it } from 'vitest';

import { ThumbnailDetailsOverlayController } from '../../../../src/components-lib/thumbnail/details-overlay/controller';
import type { ResolvedThumbnailDetailsStyle } from '../../../../src/components-lib/thumbnail/resolve-details-style';
import { ViewFolder, ViewMediaType } from '../../../../src/view/item';
import { createCameraManagerWithMetadata } from '../../../camera-manager/test-utils';
import { createFolder } from '../../../test-utils';
import { TestViewMedia } from '../../../view/test-utils';

const createEvent = (): TestViewMedia =>
  new TestViewMedia({
    cameraID: 'camera_1',
    startTime: new Date('2026-09-08T16:55:47'),
    endTime: new Date('2026-09-08T16:56:28'),
    what: ['person'],
    where: ['driveway'],
    tags: ['delivery'],
    thumbnail: 'thumbnail.jpg',
  });

const createController = (
  detailsStyle: ResolvedThumbnailDetailsStyle,
  size: number,
  item = createEvent(),
): ThumbnailDetailsOverlayController => {
  const controller = new ThumbnailDetailsOverlayController();
  controller.calculate({
    cameraManager: createCameraManagerWithMetadata({
      title: 'Office',
      icon: { icon: 'mdi:cctv' },
    }),
    item,
    detailsStyle,
    size,
  });
  return controller;
};

describe('ThumbnailDetailsOverlayController', () => {
  describe('should choose a tier from the size', () => {
    it.each([
      ['compact', 75],
      ['compact', 99],
      ['standard', 100],
      ['standard', 174],
      ['comfortable', 175],
      ['comfortable', 249],
      ['poster', 250],
      ['poster', 300],
    ])('should use the %s tier at size %s', (tier, size) => {
      expect(createController('overlay', size).getTier()).toBe(tier);
    });
  });

  describe('should show nothing without an overlay', () => {
    it.each([['none' as const], ['panel' as const]])(
      'should show nothing for %s',
      (detailsStyle) => {
        const controller = createController(detailsStyle, 100);

        expect(controller.getCornerLabel()).toBeNull();
        expect(controller.getHeadlineLabel()).toBeNull();
        expect(controller.getTime()).toBeNull();
        expect(controller.getDetails()).toEqual([]);
        expect(controller.getReviewState()).toBeNull();
        expect(controller.isInProgress()).toBe(false);
      },
    );
  });

  describe('should hide the details until hovered', () => {
    it('should hide the details of media that has a thumbnail', () => {
      expect(createController('hover', 100).isHover()).toBe(true);
    });

    it('should keep the details of media with no thumbnail', () => {
      const controller = createController(
        'hover',
        100,
        new TestViewMedia({ cameraID: 'camera_1' }),
      );

      expect(controller.isHover()).toBe(false);
    });

    it('should keep the details of a folder', () => {
      const controller = new ThumbnailDetailsOverlayController();

      controller.calculate({
        cameraManager: createCameraManagerWithMetadata({
          title: 'Office',
          icon: { icon: 'mdi:cctv' },
        }),
        item: new ViewFolder(createFolder(), [], { title: 'Recordings' }),
        detailsStyle: 'hover',
        size: 100,
      });

      expect(controller.isHover()).toBe(false);
      expect(controller.getHeadlineLabel()).toBe('Recordings');
    });
  });

  describe('should place the label', () => {
    it('should move the label to a corner on the smallest permanent overlay', () => {
      const controller = createController('overlay', 75);

      expect(controller.getCornerLabel()).toBe('Person');
      expect(controller.getHeadlineLabel()).toBeNull();
    });

    it('should keep the label in the overlay when it is revealed on hover', () => {
      expect(createController('hover', 75).getHeadlineLabel()).toBe('Person');
    });

    it('should keep the label in the overlay above the smallest tier', () => {
      expect(createController('overlay', 100).getHeadlineLabel()).toBe('Person');
    });

    it('should keep the label in the overlay where there is no time to show', () => {
      const controller = new ThumbnailDetailsOverlayController();

      controller.calculate({
        cameraManager: createCameraManagerWithMetadata({
          title: 'Office',
          icon: { icon: 'mdi:cctv' },
        }),
        item: new ViewFolder(createFolder(), [], { title: 'Recordings' }),
        detailsStyle: 'overlay',
        size: 75,
      });

      expect(controller.getHeadlineLabel()).toBe('Recordings');
    });
  });

  describe('should show the time', () => {
    it.each([[75], [100]])(
      'should omit the seconds where the line is shared at size %s',
      (size) => {
        expect(createController('overlay', size).getTime()).toEqual({
          hoursMinutes: '16:55',
        });
      },
    );

    it('should show the seconds where there is room', () => {
      expect(createController('overlay', 175).getTime()).toEqual({
        hoursMinutes: '16:55',
        seconds: ':47',
      });
    });

    it('should show the seconds on the smallest revealed overlay', () => {
      expect(createController('hover', 75).getTime()?.seconds).toBe(':47');
    });

    it('should show no time without a start time', () => {
      const controller = createController(
        'overlay',
        100,
        new TestViewMedia({ cameraID: 'camera_1' }),
      );

      expect(controller.getTime()).toBeNull();
    });
  });

  describe('should choose details for the tier', () => {
    it('should show no details on a permanent overlay below the comfortable tier', () => {
      expect(createController('overlay', 75).getDetails()).toEqual([]);
      expect(createController('overlay', 100).getDetails()).toEqual([]);
    });

    it('should show no details on the smallest revealed overlay', () => {
      expect(createController('hover', 75).getDetails()).toEqual([]);
    });

    it('should show the duration and camera on a revealed standard overlay', () => {
      expect(createController('hover', 100).getDetails()).toEqual(['41s · Office']);
    });

    it('should show the duration and camera on a comfortable permanent overlay', () => {
      expect(createController('overlay', 175).getDetails()).toEqual(['41s · Office']);
    });

    it('should separate the details on a comfortable revealed overlay', () => {
      expect(createController('hover', 175).getDetails()).toEqual([
        '41s',
        'Office · Driveway',
        'Delivery',
      ]);
    });

    it('should join the values into one detail on the largest overlay', () => {
      expect(createController('overlay', 300).getDetails()).toEqual([
        '41s · Office · Driveway',
        'Delivery',
      ]);
    });

    it('should leave out a value the media does not have', () => {
      const controller = createController(
        'hover',
        175,
        new TestViewMedia({
          cameraID: 'camera_1',
          startTime: new Date('2026-09-08T16:55:47'),
          what: ['person'],
          thumbnail: 'thumbnail.jpg',
        }),
      );

      expect(controller.getDetails()).toEqual(['Office']);
    });

    it('should leave out a detail with no values at all', () => {
      const cameraManager = createCameraManagerWithMetadata();
      const controller = new ThumbnailDetailsOverlayController();

      controller.calculate({
        cameraManager,
        item: new TestViewMedia({
          cameraID: 'camera_1',
          startTime: new Date('2026-09-08T16:55:47'),
        }),
        detailsStyle: 'overlay',
        size: 175,
      });

      expect(controller.getDetails()).toEqual([]);
    });

    it('should not repeat the camera a recording is already headlined with', () => {
      const controller = createController(
        'overlay',
        175,
        new TestViewMedia({
          cameraID: 'camera_1',
          mediaType: ViewMediaType.Recording,
          startTime: new Date('2026-09-08T16:00:00'),
          endTime: new Date('2026-09-08T17:00:00'),
        }),
      );

      expect(controller.getHeadlineLabel()).toBe('Office');
      expect(controller.getDetails()).toEqual(['1h 0s']);
    });
  });

  it('should label a folder with its title', () => {
    const controller = new ThumbnailDetailsOverlayController();

    controller.calculate({
      cameraManager: createCameraManagerWithMetadata({
        title: 'Office',
        icon: { icon: 'mdi:cctv' },
      }),
      item: new ViewFolder(createFolder(), [], { title: 'Recordings' }),
      detailsStyle: 'overlay',
      size: 175,
    });

    expect(controller.getHeadlineLabel()).toBe('Recordings');
    expect(controller.getTime()).toBeNull();
    expect(controller.getDetails()).toEqual([]);
  });

  describe('should show the state of the item', () => {
    it('should say a review is reviewed', () => {
      const controller = createController(
        'overlay',
        175,
        new TestViewMedia({ mediaType: ViewMediaType.Review, reviewed: true }),
      );

      expect(controller.getReviewState()).toBe('reviewed');
    });

    it('should say a review is unreviewed', () => {
      const controller = createController(
        'overlay',
        175,
        new TestViewMedia({ mediaType: ViewMediaType.Review, reviewed: false }),
      );

      expect(controller.getReviewState()).toBe('unreviewed');
    });

    it('should have no review state for media that cannot be reviewed', () => {
      expect(createController('overlay', 175).getReviewState()).toBeNull();
    });

    it('should say a camera is still writing the media', () => {
      const controller = createController(
        'overlay',
        175,
        new TestViewMedia({ cameraID: 'camera_1', inProgress: true }),
      );

      expect(controller.isInProgress()).toBe(true);
    });

    it('should say a camera has finished writing the media', () => {
      expect(createController('overlay', 175).isInProgress()).toBe(false);
    });
  });

  describe('should share one line between the label and the time', () => {
    it.each([[75], [100]])('should share the line at size %s', (size) => {
      expect(createController('overlay', size).isOneLineHeadline()).toBe(true);
    });

    it.each([[175], [300]])('should give each its own line at size %s', (size) => {
      expect(createController('overlay', size).isOneLineHeadline()).toBe(false);
    });

    it('should give each its own line on a revealed overlay', () => {
      expect(createController('hover', 100).isOneLineHeadline()).toBe(false);
    });
  });
});
