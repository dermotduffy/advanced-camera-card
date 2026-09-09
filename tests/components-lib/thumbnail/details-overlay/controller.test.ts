import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { CameraManager } from '../../../../src/camera-manager/manager';
import { ThumbnailDetailsOverlayController } from '../../../../src/components-lib/thumbnail/details-overlay/controller';
import type { ResolvedThumbnailDetailsStyle } from '../../../../src/components-lib/thumbnail/resolve-details-style';
import { ViewFolder, ViewMediaType } from '../../../../src/view/item';
import { createFolder } from '../../../test-utils';
import { TestViewMedia } from '../../../view/test-utils';

const createCameraManager = (title = 'Office'): CameraManager => {
  const cameraManager = mock<CameraManager>();
  cameraManager.getCameraMetadata.mockReturnValue({
    title,
    icon: { icon: 'mdi:cctv' },
  });
  return cameraManager;
};

const createEvent = (): TestViewMedia =>
  new TestViewMedia({
    cameraID: 'camera_1',
    startTime: new Date('2026-09-08T16:55:47'),
    endTime: new Date('2026-09-08T16:56:28'),
    what: ['person'],
    where: ['driveway'],
    tags: ['delivery'],
  });

const createController = (
  detailsStyle: ResolvedThumbnailDetailsStyle,
  size: number,
  item = createEvent(),
): ThumbnailDetailsOverlayController => {
  const controller = new ThumbnailDetailsOverlayController();
  controller.calculate(createCameraManager(), item, detailsStyle, size);
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

        expect(controller.getLabel()).toBeNull();
        expect(controller.getTime()).toBeNull();
        expect(controller.getRows()).toEqual([]);
        expect(controller.getSeverity()).toBeNull();
      },
    );
  });

  describe('should place the label', () => {
    it('should move the label to a corner on the smallest permanent overlay', () => {
      const controller = createController('overlay', 75);

      expect(controller.isLabelInCorner()).toBe(true);
      expect(controller.getLabel()).toBe('Person');
    });

    it('should keep the label in the overlay when it is revealed on hover', () => {
      expect(createController('hover', 75).isLabelInCorner()).toBe(false);
    });

    it('should keep the label in the overlay above the smallest tier', () => {
      expect(createController('overlay', 100).isLabelInCorner()).toBe(false);
    });
  });

  describe('should show the time', () => {
    it('should omit the seconds on the smallest permanent overlay', () => {
      expect(createController('overlay', 75).getTime()).toEqual({
        hoursMinutes: '16:55',
      });
    });

    it('should show the seconds where there is room', () => {
      expect(createController('overlay', 100).getTime()).toEqual({
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

  describe('should choose rows for the tier', () => {
    it('should show no rows on a permanent overlay below the comfortable tier', () => {
      expect(createController('overlay', 75).getRows()).toEqual([]);
      expect(createController('overlay', 100).getRows()).toEqual([]);
    });

    it('should show no rows on the smallest revealed overlay', () => {
      expect(createController('hover', 75).getRows()).toEqual([]);
    });

    it('should show the duration and camera on a revealed standard overlay', () => {
      expect(createController('hover', 100).getRows()).toEqual(['41s · Office']);
    });

    it('should show the duration and camera on a comfortable permanent overlay', () => {
      expect(createController('overlay', 175).getRows()).toEqual(['41s · Office']);
    });

    it('should separate the rows on a comfortable revealed overlay', () => {
      expect(createController('hover', 175).getRows()).toEqual([
        '41s',
        'Office · Driveway',
        'Delivery',
      ]);
    });

    it('should join the values into one row on the largest overlay', () => {
      expect(createController('overlay', 300).getRows()).toEqual([
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
        }),
      );

      expect(controller.getRows()).toEqual(['Office']);
    });

    it('should leave out a row with no values at all', () => {
      const cameraManager = mock<CameraManager>();
      cameraManager.getCameraMetadata.mockReturnValue(null);
      const controller = new ThumbnailDetailsOverlayController();

      controller.calculate(
        cameraManager,
        new TestViewMedia({
          cameraID: 'camera_1',
          startTime: new Date('2026-09-08T16:55:47'),
        }),
        'overlay',
        175,
      );

      expect(controller.getRows()).toEqual([]);
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

      expect(controller.getLabel()).toBe('Office');
      expect(controller.getRows()).toEqual(['1h 0s']);
    });

    it('should say a recording is still in progress', () => {
      const controller = createController(
        'overlay',
        175,
        new TestViewMedia({
          cameraID: 'camera_1',
          startTime: new Date('2026-09-08T16:55:47'),
          inProgress: true,
        }),
      );

      expect(controller.getRows()).toEqual(['In progress...']);
    });
  });

  it('should label a folder with its title', () => {
    const controller = new ThumbnailDetailsOverlayController();

    controller.calculate(
      createCameraManager(),
      new ViewFolder(createFolder(), [], { title: 'Recordings' }),
      'overlay',
      175,
    );

    expect(controller.getLabel()).toBe('Recordings');
    expect(controller.getTime()).toBeNull();
    expect(controller.getRows()).toEqual([]);
  });

  describe('should show severity', () => {
    it('should show the severity of a review', () => {
      const controller = createController(
        'overlay',
        100,
        new TestViewMedia({
          cameraID: 'camera_1',
          mediaType: ViewMediaType.Review,
          startTime: new Date('2026-09-08T16:55:47'),
          title: 'Person',
          severity: 'high',
        }),
      );

      expect(controller.getSeverity()).toBe('high');
      expect(controller.getLabel()).toBe('Person');
    });

    it('should show no severity for media that is not a review', () => {
      expect(createController('overlay', 100).getSeverity()).toBeNull();
    });
  });
});
