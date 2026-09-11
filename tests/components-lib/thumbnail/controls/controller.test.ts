import { describe, expect, it } from 'vitest';

import { ThumbnailControlsController } from '../../../../src/components-lib/thumbnail/controls/controller';
import {
  THUMBNAIL_SIZE_MAX,
  THUMBNAIL_SIZE_MIN,
} from '../../../../src/config/schema/common/controls/thumbnails';
import { ViewFolder, ViewMediaType } from '../../../../src/view/item';
import { createFolder, stubMatchMedia } from '../../../test-utils';
import { TestViewMedia } from '../../../view/test-utils';

const ALL_CONTROLS = {
  showFavoriteControl: true,
  showTimelineControl: true,
  showDownloadControl: true,
  showReviewControl: true,
  showInfoControl: true,
};

const CAPABILITIES = { canFavorite: true, canDownload: true };

const createController = (
  options?: Parameters<ThumbnailControlsController['calculate']>[0],
  isHoverable = true,
): ThumbnailControlsController => {
  stubMatchMedia().mockReturnValue({ matches: isHoverable });

  const controller = new ThumbnailControlsController();
  controller.calculate({ ...options });
  return controller;
};

const getControlNames = (controller: ThumbnailControlsController): string[] =>
  controller.getControls().map((control) => control.name);

// @vitest-environment jsdom
describe('ThumbnailControlsController', () => {
  it('should show no controls without an item', () => {
    expect(createController(ALL_CONTROLS).getControls()).toEqual([]);
  });

  it('should show every control the item and the config allow', () => {
    const controller = createController({
      ...ALL_CONTROLS,
      capabilities: CAPABILITIES,
      item: new TestViewMedia({
        id: 'id',
        mediaType: ViewMediaType.Review,
        reviewed: false,
        startTime: new Date('2026-09-09T16:55:47'),
      }),
    });

    expect(getControlNames(controller)).toEqual([
      'review',
      'info',
      'timeline',
      'download',
    ]);
  });

  it('should show no control the config turned off', () => {
    const controller = createController({
      capabilities: CAPABILITIES,
      item: new TestViewMedia({ id: 'id', mediaType: ViewMediaType.Review }),
    });

    expect(controller.getControls()).toEqual([]);
  });

  describe('should choose between the review and favorite controls', () => {
    it('should prioritize the review control', () => {
      const controller = createController({
        ...ALL_CONTROLS,
        capabilities: CAPABILITIES,
        item: new TestViewMedia({
          mediaType: ViewMediaType.Review,
          reviewed: false,
          favorite: true,
        }),
      });

      expect(getControlNames(controller)).toContain('review');
      expect(getControlNames(controller)).not.toContain('favorite');
    });

    it('should prioritize the favorite control for media that cannot be reviewed', () => {
      const controller = createController({
        ...ALL_CONTROLS,
        capabilities: CAPABILITIES,
        item: new TestViewMedia({ favorite: true }),
      });

      expect(getControlNames(controller)).toContain('favorite');
    });
  });

  describe('should say whether the state a control sets is active', () => {
    it.each([
      [true, 'mdi:check-circle'],
      [false, 'mdi:check-circle-outline'],
    ])('should show a reviewed state of %s', (reviewed, icon) => {
      const controller = createController({
        showReviewControl: true,
        item: new TestViewMedia({ mediaType: ViewMediaType.Review, reviewed }),
      });

      expect(controller.getControls()[0].active).toBe(reviewed);
      expect(controller.getControls()[0].icon).toBe(icon);
    });

    it.each([
      [true, 'mdi:star'],
      [false, 'mdi:star-outline'],
    ])('should show a favorite state of %s', (favorite, icon) => {
      const controller = createController({
        showFavoriteControl: true,
        capabilities: CAPABILITIES,
        item: new TestViewMedia({ favorite }),
      });

      expect(controller.getControls()[0].active).toBe(favorite);
      expect(controller.getControls()[0].icon).toBe(icon);
    });
  });

  describe('should need the capability to change a state', () => {
    it('should not show the favorite control without the capability', () => {
      const controller = createController({
        showFavoriteControl: true,
        capabilities: { canFavorite: false, canDownload: true },
        item: new TestViewMedia(),
      });

      expect(controller.getControls()).toEqual([]);
    });

    it('should not show the download control without the capability', () => {
      const controller = createController({
        showDownloadControl: true,
        capabilities: { canFavorite: true, canDownload: false },
        item: new TestViewMedia({ id: 'id' }),
      });

      expect(controller.getControls()).toEqual([]);
    });

    it('should not show the download control for media without an ID', () => {
      const controller = createController({
        showDownloadControl: true,
        capabilities: CAPABILITIES,
        item: new TestViewMedia({ id: null }),
      });

      expect(controller.getControls()).toEqual([]);
    });
  });

  describe('should limit the controls a folder offers', () => {
    it('should not show any control for a folder', () => {
      const controller = createController({
        ...ALL_CONTROLS,
        capabilities: CAPABILITIES,
        item: new ViewFolder(createFolder(), []),
      });

      expect(controller.getControls()).toEqual([]);
    });
  });

  it('should not show a timeline control for media without a time', () => {
    const controller = createController({
      showTimelineControl: true,
      item: new TestViewMedia({ startTime: null }),
    });

    expect(controller.getControls()).toEqual([]);
  });

  it('should show no info control beside a details panel', () => {
    const controller = createController({
      ...ALL_CONTROLS,
      capabilities: CAPABILITIES,
      detailsStyle: 'panel',
      item: new TestViewMedia({ id: 'id' }),
    });

    expect(getControlNames(controller)).not.toContain('info');
    expect(getControlNames(controller)).toContain('favorite');
  });

  describe('should say which tier the thumbnail is in', () => {
    it.each([
      ['compact', THUMBNAIL_SIZE_MIN],
      ['standard', 100],
      ['comfortable', 175],
      ['poster', THUMBNAIL_SIZE_MAX],
    ])('should be in the %s tier at size %s', (tier, size) => {
      expect(createController({ size }).getTier()).toBe(tier);
    });
  });

  describe('should reduce the controls without a pointer', () => {
    const createEveryControl = (
      isHoverable: boolean,
      size = THUMBNAIL_SIZE_MAX,
      showInfoControl = true,
    ): ThumbnailControlsController =>
      createController(
        {
          ...ALL_CONTROLS,
          showInfoControl,
          size,
          capabilities: CAPABILITIES,
          item: new TestViewMedia({
            id: 'id',
            startTime: new Date('2026-09-09T16:55:47'),
          }),
        },
        isHoverable,
      );

    it('should keep every control where there is a pointer', () => {
      const controller = createEveryControl(true);

      expect(controller.isSingleControl()).toBe(false);
      expect(getControlNames(controller)).toEqual([
        'favorite',
        'info',
        'timeline',
        'download',
      ]);
    });

    it('should keep every control on a small thumbnail with a pointer', () => {
      const controller = createEveryControl(true, THUMBNAIL_SIZE_MIN);

      expect(getControlNames(controller)).toEqual([
        'favorite',
        'info',
        'timeline',
        'download',
      ]);
    });

    it.each([[100], [174], [175], [THUMBNAIL_SIZE_MAX]])(
      'should reduce to the info control at size %s',
      (size) => {
        const controller = createEveryControl(false, size);

        expect(controller.isSingleControl()).toBe(true);
        expect(getControlNames(controller)).toEqual(['info']);
      },
    );

    it.each([[THUMBNAIL_SIZE_MIN], [99]])(
      'should not show any control at size %s where a finger has insufficient space',
      (size) => {
        const controller = createEveryControl(false, size);

        expect(controller.isSingleControl()).toBe(false);
        expect(controller.getControls()).toEqual([]);
      },
    );

    it('should not show any control without an info control to replace the others', () => {
      const controller = createEveryControl(false, THUMBNAIL_SIZE_MAX, false);

      expect(controller.isSingleControl()).toBe(false);
      expect(controller.getControls()).toEqual([]);
    });
  });
});
