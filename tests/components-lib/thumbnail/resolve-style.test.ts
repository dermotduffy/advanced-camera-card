import { beforeEach, describe, expect, it } from 'vitest';

import {
  resolveThumbnailStyle,
  type ThumbnailStyleContext,
} from '../../../src/components-lib/thumbnail/resolve-style';
import {
  thumbnailsControlBaseDefaults,
  type ThumbnailsControlBaseConfig,
} from '../../../src/config/schema/common/controls/thumbnails';
import { stubMatchMedia } from '../../test-utils';

const createConfig = (
  config?: Partial<ThumbnailsControlBaseConfig>,
): ThumbnailsControlBaseConfig => ({
  ...thumbnailsControlBaseDefaults,
  ...config,
});

const createContext = (
  context?: Partial<ThumbnailStyleContext>,
): ThumbnailStyleContext => ({
  placement: 'grid',
  ...context,
});

// @vitest-environment jsdom
describe('resolveThumbnailStyle', () => {
  beforeEach(() => {
    stubMatchMedia().mockReturnValue({ matches: true });
  });

  it.each([
    ['plain' as const],
    ['overlay' as const],
    ['hover' as const],
    ['panel' as const],
  ])('should pass %s through unchanged', (style) => {
    expect(resolveThumbnailStyle(createConfig({ style }), createContext())).toBe(style);
  });

  it('should fall back to overlay on a device with no pointer', () => {
    stubMatchMedia().mockReturnValue({ matches: false });

    expect(
      resolveThumbnailStyle(createConfig({ style: 'hover' }), createContext()),
    ).toBe('overlay');
  });

  describe('auto', () => {
    it('should use an overlay when there is no room for a panel', () => {
      expect(
        resolveThumbnailStyle(
          createConfig({ style: 'auto', size: 100 }),
          createContext({ placement: 'surround-vertical', availableWidth: 249 }),
        ),
      ).toBe('overlay');
    });

    it('should use a panel when there is room for one', () => {
      expect(
        resolveThumbnailStyle(
          createConfig({ style: 'auto', size: 100 }),
          createContext({ placement: 'surround-vertical', availableWidth: 300 }),
        ),
      ).toBe('panel');
    });

    it('should use a panel in a popup', () => {
      expect(
        resolveThumbnailStyle(
          createConfig({ style: 'auto', size: 75 }),
          createContext({ placement: 'popup' }),
        ),
      ).toBe('panel');
    });

    it('should use a panel in a vertical surround', () => {
      expect(
        resolveThumbnailStyle(
          createConfig({ style: 'auto' }),
          createContext({ placement: 'surround-vertical' }),
        ),
      ).toBe('panel');
    });

    it('should hover in a horizontal surround', () => {
      expect(
        resolveThumbnailStyle(
          createConfig({ style: 'auto' }),
          createContext({ placement: 'surround-horizontal' }),
        ),
      ).toBe('hover');
    });

    it('should keep an overlay on small grid thumbnails', () => {
      expect(
        resolveThumbnailStyle(
          createConfig({ style: 'auto', size: 199 }),
          createContext(),
        ),
      ).toBe('overlay');
    });

    it('should hover on large grid thumbnails', () => {
      expect(
        resolveThumbnailStyle(
          createConfig({ style: 'auto', size: 200 }),
          createContext(),
        ),
      ).toBe('hover');
    });

    it('should ignore an unknown available width', () => {
      expect(
        resolveThumbnailStyle(
          createConfig({ style: 'auto' }),
          createContext({ placement: 'surround-vertical' }),
        ),
      ).toBe('panel');
    });
  });
});
