import { describe, expect, it } from 'vitest';

import { ThumbnailDetailsPanelController } from '../../../../src/components-lib/thumbnail/details-panel/controller';
import { createCameraManagerWithMetadata } from '../../../camera-manager/test-utils';
import { TestViewMedia } from '../../../view/test-utils';

// An event with every value the panel can show.
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
  size: number,
  showInfoControl = true,
  item = createEvent(),
): ThumbnailDetailsPanelController => {
  const controller = new ThumbnailDetailsPanelController();
  controller.calculate({
    cameraManager: createCameraManagerWithMetadata({
      title: 'Office',
      icon: { icon: 'mdi:cctv' },
    }),
    item,
    size,
    showInfoControl,
  });
  return controller;
};

describe('ThumbnailDetailsPanelController', () => {
  it('should show every value where they all fit', () => {
    const controller = createController(300);

    expect(controller.getTier()).toBe('poster');
    expect(controller.getHeading()?.text).toBe('Person');
    expect(controller.getDetails()).toHaveLength(5);
    expect(controller.getHiddenDetailCount()).toBe(0);
  });

  it.each([
    [75, 'compact', 1],
    [100, 'standard', 2],
    [175, 'comfortable', 5],
  ])(
    'should keep %s within the %s budget of lines',
    (size, tier, expectedRows: number) => {
      const controller = createController(size);

      expect(controller.getTier()).toBe(tier);
      expect(controller.getDetails()).toHaveLength(expectedRows);
    },
  );

  it('should keep the seek time separate from the other details', () => {
    const controller = new ThumbnailDetailsPanelController();

    controller.calculate({
      cameraManager: createCameraManagerWithMetadata({
        title: 'Office',
        icon: { icon: 'mdi:cctv' },
      }),
      item: createEvent(),
      seek: new Date('2026-09-08T16:55:52'),
      size: 175,
      showInfoControl: true,
    });

    expect(controller.getDetails()).toHaveLength(5);
    expect(controller.getSeekDetail()?.text).toBe('16:55:52');
    expect(controller.getHiddenDetailCount()).toBe(0);
  });

  it('should give the seek time a line of the budget', () => {
    const controller = new ThumbnailDetailsPanelController();

    // The standard panel shows four lines: the heading, the seek time, one
    // value and the chip that reaches the other four.
    controller.calculate({
      cameraManager: createCameraManagerWithMetadata({
        title: 'Office',
        icon: { icon: 'mdi:cctv' },
      }),
      item: createEvent(),
      seek: new Date('2026-09-08T16:55:52'),
      size: 100,
      showInfoControl: true,
    });

    expect(controller.getDetails()).toHaveLength(1);
    expect(controller.getHiddenDetailCount()).toBe(4);
  });

  it('should show no seek detail without a seek time', () => {
    const controller = createController(175);

    expect(controller.getDetails()).toHaveLength(5);
    expect(controller.getSeekDetail()).toBeNull();
  });

  it('should count the values it had no room for', () => {
    const controller = createController(75);

    // Five values, of which the compact panel shows one.
    expect(controller.getHiddenDetailCount()).toBe(4);
  });

  it('should show one more detail instead of a count with no info control', () => {
    const controller = createController(75, false);

    expect(controller.getDetails()).toHaveLength(2);
    expect(controller.getHiddenDetailCount()).toBe(0);
  });

  it('should give the details a line more where there is no heading', () => {
    const controller = new ThumbnailDetailsPanelController();

    // Nothing names this media: no detected object, and no camera manager to
    // resolve a camera title from. That frees the heading's line.
    controller.calculate({
      item: new TestViewMedia({
        cameraID: 'camera_1',
        startTime: new Date('2026-09-08T16:55:47'),
        endTime: new Date('2026-09-08T16:56:28'),
        where: ['driveway'],
        tags: ['delivery'],
      }),
      size: 75,
      showInfoControl: true,
    });

    expect(controller.getHeading()).toBeNull();
    expect(controller.getDetails()).toHaveLength(2);
  });

  it('should show nothing for media that says nothing about itself', () => {
    const controller = new ThumbnailDetailsPanelController();

    controller.calculate({
      item: new TestViewMedia(),
      size: 100,
      showInfoControl: true,
    });

    expect(controller.getHeading()).toBeNull();
    expect(controller.getDetails()).toEqual([]);
    expect(controller.getHiddenDetailCount()).toBe(0);
  });
});
