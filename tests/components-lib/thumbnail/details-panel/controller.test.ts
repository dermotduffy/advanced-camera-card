import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThumbnailDetailsPanelController } from '../../../../src/components-lib/thumbnail/details-panel/controller';
import type { ThumbnailTier } from '../../../../src/components-lib/thumbnail/tier';
import { ViewFolder, type ViewItem } from '../../../../src/view/item';
import { createCameraManagerWithMetadata } from '../../../camera-manager/test-utils';
import { createFolder } from '../../../test-utils';
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
  tier?: ThumbnailTier,
  item: ViewItem = createEvent(),
): ThumbnailDetailsPanelController => {
  const controller = new ThumbnailDetailsPanelController();
  controller.calculate({
    cameraManager: createCameraManagerWithMetadata({
      title: 'Office',
      icon: { icon: 'mdi:cctv' },
    }),
    item,
    tier,
  });
  return controller;
};

describe('ThumbnailDetailsPanelController', () => {
  it('should join the values onto a line each', () => {
    const controller = createController('poster');

    expect(controller.getLabel()).toBe('Person');
    expect(controller.getDetails()).toEqual([
      '2026-09-08 · 41s',
      'Office · Driveway',
      'Delivery',
    ]);
    expect(controller.getHiddenDetailCount()).toBe(0);
  });

  it('should show the start time beside the heading rather than among the details', () => {
    const controller = createController('poster');

    expect(controller.getTime()).toEqual({ hoursMinutes: '16:55', seconds: ':47' });
    expect(controller.getDetails().join()).not.toContain('16:55');
  });

  it('should show no time for media that does not say when it starts', () => {
    const controller = createController('poster', new TestViewMedia());

    expect(controller.getTime()).toBeNull();
  });

  it('should show no time for a folder, which has no start at all', () => {
    const controller = createController('poster', new ViewFolder(createFolder(), []));

    expect(controller.getTime()).toBeNull();
  });

  it('should pack more onto each line where the panel has fewer of them', () => {
    const controller = createController('compact');

    expect(controller.getDetails()).toEqual([
      '2026-09-08 · 41s · Office',
      'Driveway · Delivery',
    ]);
    expect(controller.getHiddenDetailCount()).toBe(0);
  });

  it.each([['standard' as const], ['comfortable' as const], ['poster' as const]])(
    'should show every value in the %s tier',
    (tier) => {
      const controller = createController(tier);

      expect(controller.getDetails()).toHaveLength(3);
      expect(controller.getHiddenDetailCount()).toBe(0);
    },
  );

  it('should use the tier it is given', () => {
    expect(createController('comfortable').getTier()).toBe('comfortable');
  });

  it('should use the standard tier by default', () => {
    expect(createController().getTier()).toBe('standard');
  });

  it('should not repeat a camera title the heading already carries', () => {
    const controller = createController(
      'poster',
      new TestViewMedia({
        cameraID: 'camera_1',
        startTime: new Date('2026-09-08T16:55:47'),
        endTime: new Date('2026-09-08T16:56:28'),
      }),
    );

    expect(controller.getLabel()).toBe('Office');
    expect(controller.getDetails()).toEqual(['2026-09-08 · 41s']);
  });

  describe('should name the day the media starts', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-10T22:45:00'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const createEventOn = (day: string): TestViewMedia =>
      new TestViewMedia({
        cameraID: 'camera_1',
        startTime: new Date(`${day}T16:55:47`),
        endTime: new Date(`${day}T16:56:28`),
        what: ['person'],
      });

    it.each([
      ['2026-09-10', 'Today · 41s'],
      ['2026-09-09', 'Yesterday · 41s'],
      ['2026-09-08', '2026-09-08 · 41s'],
    ])('should name %s as %s', (day, expected) => {
      const controller = createController('poster', createEventOn(day));

      expect(controller.getDetails()[0]).toBe(expected);
    });
  });

  it('should keep the seek time separate from the other details', () => {
    const controller = new ThumbnailDetailsPanelController();

    controller.calculate({
      cameraManager: createCameraManagerWithMetadata({
        title: 'Office',
        icon: { icon: 'mdi:cctv' },
      }),
      item: createEvent(),
      seek: new Date('2026-09-08T16:55:52'),
      tier: 'comfortable',
    });

    expect(controller.getDetails()).toHaveLength(3);
    expect(controller.getSeekTime()).toBe('16:55:52');
    expect(controller.getHiddenDetailCount()).toBe(0);
  });

  it('should give the seek time a line of the budget', () => {
    const controller = new ThumbnailDetailsPanelController();

    // The standard panel shows four lines: the heading, the seek time, one
    // line of values and the chip that reaches the three left over.
    controller.calculate({
      cameraManager: createCameraManagerWithMetadata({
        title: 'Office',
        icon: { icon: 'mdi:cctv' },
      }),
      item: createEvent(),
      seek: new Date('2026-09-08T16:55:52'),
      tier: 'standard',
    });

    expect(controller.getDetails()).toEqual(['2026-09-08 · 41s']);
    expect(controller.getHiddenDetailCount()).toBe(3);
  });

  it('should show no seek time where the reader is not seeking', () => {
    expect(createController('comfortable').getSeekTime()).toBeNull();
  });

  it('should report an in-progress recording', () => {
    const controller = createController(
      'poster',
      new TestViewMedia({
        cameraID: 'camera_1',
        startTime: new Date('2026-09-08T16:55:47'),
        inProgress: true,
      }),
    );

    expect(controller.isInProgress()).toBe(true);
  });

  it('should not report a finished recording as in progress', () => {
    expect(createController('poster').isInProgress()).toBe(false);
  });

  it('should give the in-progress pill a line of the budget', () => {
    const controller = new ThumbnailDetailsPanelController();

    controller.calculate({
      cameraManager: createCameraManagerWithMetadata({
        title: 'Office',
        icon: { icon: 'mdi:cctv' },
      }),
      item: new TestViewMedia({
        cameraID: 'camera_1',
        startTime: new Date('2026-09-08T16:55:47'),
        endTime: new Date('2026-09-08T16:56:28'),
        what: ['person'],
        where: ['driveway'],
        tags: ['delivery'],
        inProgress: true,
      }),
      tier: 'standard',
    });

    // Standard budget is 4: heading + pill + one detail line + chip.
    expect(controller.getDetails()).toEqual(['2026-09-08 · 41s']);
    expect(controller.getHiddenDetailCount()).toBe(3);
  });

  it('should give the details a line more where there is no label', () => {
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
      tier: 'compact',
    });

    expect(controller.getLabel()).toBeNull();
    expect(controller.getDetails()).toEqual(['2026-09-08 · 41s', 'Driveway · Delivery']);
  });

  it('should show nothing for media that says nothing about itself', () => {
    const controller = new ThumbnailDetailsPanelController();

    controller.calculate({
      item: new TestViewMedia(),
      tier: 'standard',
    });

    expect(controller.getLabel()).toBeNull();
    expect(controller.getDetails()).toEqual([]);
    expect(controller.getHiddenDetailCount()).toBe(0);
  });
});
