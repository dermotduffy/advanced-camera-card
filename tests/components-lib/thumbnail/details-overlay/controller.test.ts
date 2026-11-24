import { describe, expect, it } from 'vitest';

import { ThumbnailDetailsOverlayController } from '../../../../src/components-lib/thumbnail/details-overlay/controller';
import type { ResolvedThumbnailStyle } from '../../../../src/components-lib/thumbnail/resolve-style';
import type { ThumbnailTier } from '../../../../src/components-lib/thumbnail/tier';
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
  thumbnailStyle: ResolvedThumbnailStyle,
  tier?: ThumbnailTier,
  item = createEvent(),
): ThumbnailDetailsOverlayController => {
  const controller = new ThumbnailDetailsOverlayController();
  controller.calculate({
    cameraManager: createCameraManagerWithMetadata({
      title: 'Office',
      icon: { icon: 'mdi:cctv' },
    }),
    item,
    thumbnailStyle,
    tier,
  });
  return controller;
};

describe('ThumbnailDetailsOverlayController', () => {
  describe('should use the tier it is given', () => {
    it.each([
      ['compact' as const],
      ['standard' as const],
      ['comfortable' as const],
      ['poster' as const],
    ])('should use the %s tier', (tier) => {
      expect(createController('overlay', tier).getTier()).toBe(tier);
    });

    it('should use the standard tier without one', () => {
      expect(createController('overlay').getTier()).toBe('standard');
    });
  });

  describe('should show nothing without an overlay', () => {
    it.each([['plain' as const], ['panel' as const]])(
      'should show nothing for %s',
      (thumbnailStyle) => {
        const controller = createController(thumbnailStyle, 'standard');

        expect(controller.getCornerLabel()).toBeNull();
        expect(controller.getHeadlineLabel()).toBeNull();
        expect(controller.getTime()).toBeNull();
        expect(controller.getDetails()).toEqual([]);
        expect(controller.isInProgress()).toBe(false);
      },
    );
  });

  describe('should hide the details until hovered', () => {
    it('should hide the details of media that has a thumbnail', () => {
      expect(createController('hover', 'standard').isHover()).toBe(true);
    });

    it('should hide the details of media with no thumbnail', () => {
      const controller = createController(
        'hover',
        'standard',
        new TestViewMedia({ cameraID: 'camera_1' }),
      );

      expect(controller.isHover()).toBe(true);
    });

    it('should hide the details of a folder', () => {
      const controller = new ThumbnailDetailsOverlayController();

      controller.calculate({
        cameraManager: createCameraManagerWithMetadata({
          title: 'Office',
          icon: { icon: 'mdi:cctv' },
        }),
        item: new ViewFolder(createFolder(), [], { title: 'Recordings' }),
        thumbnailStyle: 'hover',
        tier: 'standard',
      });

      expect(controller.isHover()).toBe(true);
      expect(controller.getHeadlineLabel()).toBe('Recordings');
    });
  });

  describe('should place the label', () => {
    it('should move the label to a corner on the smallest permanent overlay', () => {
      const controller = createController('overlay', 'compact');

      expect(controller.getCornerLabel()).toBe('Person');
      expect(controller.getHeadlineLabel()).toBeNull();
    });

    it('should keep the label in the headline when hovered', () => {
      expect(createController('hover', 'compact').getHeadlineLabel()).toBe('Person');
    });

    it('should keep the label in the overlay above the smallest tier', () => {
      expect(createController('overlay', 'standard').getHeadlineLabel()).toBe('Person');
    });

    it('should keep the label in the overlay where there is no time to show', () => {
      const controller = new ThumbnailDetailsOverlayController();

      controller.calculate({
        cameraManager: createCameraManagerWithMetadata({
          title: 'Office',
          icon: { icon: 'mdi:cctv' },
        }),
        item: new ViewFolder(createFolder(), [], { title: 'Recordings' }),
        thumbnailStyle: 'overlay',
        tier: 'compact',
      });

      expect(controller.getHeadlineLabel()).toBe('Recordings');
    });
  });

  describe('should show the time', () => {
    it.each([['compact' as const], ['standard' as const]])(
      'should omit the seconds where the line is shared in the %s tier',
      (tier) => {
        expect(createController('overlay', tier).getTime()).toEqual({
          hoursMinutes: '16:55',
          hoursMinutesSeconds: '16:55:47',
        });
      },
    );

    it('should show the seconds where there is room', () => {
      expect(createController('overlay', 'comfortable').getTime()).toEqual({
        hoursMinutes: '16:55',
        seconds: ':47',
        hoursMinutesSeconds: '16:55:47',
      });
    });

    it('should show no seconds when hovered in the compact tier', () => {
      expect(createController('hover', 'compact').getTime()?.seconds).toBeUndefined();
    });

    it('should show no time without a start time', () => {
      const controller = createController(
        'overlay',
        'standard',
        new TestViewMedia({ cameraID: 'camera_1' }),
      );

      expect(controller.getTime()).toBeNull();
    });
  });

  describe('should choose details for the tier', () => {
    it('should show no details on a permanent overlay below the comfortable tier', () => {
      expect(createController('overlay', 'compact').getDetails()).toEqual([]);
      expect(createController('overlay', 'standard').getDetails()).toEqual([]);
    });

    it('should show no details when hovered in the compact tier', () => {
      expect(createController('hover', 'compact').getDetails()).toEqual([]);
    });

    it('should show the duration and camera when hovered in the standard tier', () => {
      expect(createController('hover', 'standard').getDetails()).toEqual([
        '41s · Office',
      ]);
    });

    it('should show the duration and camera on a comfortable permanent overlay', () => {
      expect(createController('overlay', 'comfortable').getDetails()).toEqual([
        '41s · Office',
      ]);
    });

    it('should separate the details when hovered in the comfortable tier', () => {
      expect(createController('hover', 'comfortable').getDetails()).toEqual([
        '41s',
        'Office · Driveway',
        'Delivery',
      ]);
    });

    it('should join the values into one detail on the largest overlay', () => {
      expect(createController('overlay', 'poster').getDetails()).toEqual([
        '41s · Office · Driveway',
        'Delivery',
      ]);
    });

    it('should leave out a value the media does not have', () => {
      const controller = createController(
        'hover',
        'comfortable',
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
        thumbnailStyle: 'overlay',
        tier: 'comfortable',
      });

      expect(controller.getDetails()).toEqual([]);
    });

    it('should not repeat the camera a recording is already headlined with', () => {
      const controller = createController(
        'overlay',
        'comfortable',
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
      thumbnailStyle: 'overlay',
      tier: 'comfortable',
    });

    expect(controller.getHeadlineLabel()).toBe('Recordings');
    expect(controller.getTime()).toBeNull();
    expect(controller.getDetails()).toEqual([]);
  });

  describe('should show the state of the item', () => {
    it('should say a camera is still writing the media', () => {
      const controller = createController(
        'overlay',
        'comfortable',
        new TestViewMedia({ cameraID: 'camera_1', inProgress: true }),
      );

      expect(controller.isInProgress()).toBe(true);
    });

    it('should say a camera has finished writing the media', () => {
      expect(createController('overlay', 'comfortable').isInProgress()).toBe(false);
    });
  });

  describe('should share one line between the label and the time', () => {
    it.each([['compact' as const], ['standard' as const]])(
      'should share the line in the %s tier',
      (tier) => {
        expect(createController('overlay', tier).isOneLineHeadline()).toBe(true);
      },
    );

    it.each([['comfortable' as const], ['poster' as const]])(
      'should give each its own line in the %s tier',
      (tier) => {
        expect(createController('overlay', tier).isOneLineHeadline()).toBe(false);
      },
    );

    it('should share the line on when hovered', () => {
      expect(createController('hover', 'standard').isOneLineHeadline()).toBe(true);
    });
  });
});
