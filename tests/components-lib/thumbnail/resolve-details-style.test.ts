import { describe, expect, it } from 'vitest';

import {
  resolveThumbnailDetailsStyle,
  type ThumbnailDetailsStyleContext,
} from '../../../src/components-lib/thumbnail/resolve-details-style';
import {
  thumbnailsControlBaseDefaults,
  type ThumbnailsControlBaseConfig,
} from '../../../src/config/schema/common/controls/thumbnails';

const createConfig = (
  config?: Partial<ThumbnailsControlBaseConfig>,
): ThumbnailsControlBaseConfig => ({
  ...thumbnailsControlBaseDefaults,
  ...config,
});

const createContext = (
  context?: Partial<ThumbnailDetailsStyleContext>,
): ThumbnailDetailsStyleContext => ({
  placement: 'grid',
  ...context,
});

describe('resolveThumbnailDetailsStyle', () => {
  it.each([
    ['none' as const],
    ['overlay' as const],
    ['hover' as const],
    ['panel' as const],
  ])('should pass %s through unchanged', (detailsStyle) => {
    expect(
      resolveThumbnailDetailsStyle(
        createConfig({ details_style: detailsStyle }),
        createContext(),
      ),
    ).toBe(detailsStyle);
  });

  describe('auto', () => {
    it('should use a strip when there is no room for a panel', () => {
      expect(
        resolveThumbnailDetailsStyle(
          createConfig({ details_style: 'auto', size: 100 }),
          createContext({ placement: 'surround-vertical', availableWidth: 299 }),
        ),
      ).toBe('overlay');
    });

    it('should use a panel when there is room for one', () => {
      expect(
        resolveThumbnailDetailsStyle(
          createConfig({ details_style: 'auto', size: 100 }),
          createContext({ placement: 'surround-vertical', availableWidth: 300 }),
        ),
      ).toBe('panel');
    });

    it('should reveal on hover in a popup', () => {
      expect(
        resolveThumbnailDetailsStyle(
          createConfig({ details_style: 'auto', size: 75 }),
          createContext({ placement: 'popup' }),
        ),
      ).toBe('hover');
    });

    it('should use a panel in a vertical surround', () => {
      expect(
        resolveThumbnailDetailsStyle(
          createConfig({ details_style: 'auto' }),
          createContext({ placement: 'surround-vertical' }),
        ),
      ).toBe('panel');
    });

    it('should reveal on hover in a horizontal surround', () => {
      expect(
        resolveThumbnailDetailsStyle(
          createConfig({ details_style: 'auto' }),
          createContext({ placement: 'surround-horizontal' }),
        ),
      ).toBe('hover');
    });

    it('should reveal on hover when the info control is disabled', () => {
      expect(
        resolveThumbnailDetailsStyle(
          createConfig({ details_style: 'auto', size: 75, show_info_control: false }),
          createContext(),
        ),
      ).toBe('hover');
    });

    it('should keep a strip on small grid thumbnails', () => {
      expect(
        resolveThumbnailDetailsStyle(
          createConfig({ details_style: 'auto', size: 199 }),
          createContext(),
        ),
      ).toBe('overlay');
    });

    it('should reveal on hover on large grid thumbnails', () => {
      expect(
        resolveThumbnailDetailsStyle(
          createConfig({ details_style: 'auto', size: 200 }),
          createContext(),
        ),
      ).toBe('hover');
    });

    it('should ignore an unknown available width', () => {
      expect(
        resolveThumbnailDetailsStyle(
          createConfig({ details_style: 'auto' }),
          createContext({ placement: 'surround-vertical' }),
        ),
      ).toBe('panel');
    });
  });
});
