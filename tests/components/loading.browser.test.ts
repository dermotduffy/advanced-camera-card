import { afterEach, describe, expect, it } from 'vitest';

import '../../src/components/loading';

import type { AdvancedCameraCardLoading } from '../../src/components/loading';
import type { CardLoadingIndicatorPosition } from '../../src/config/schema/performance';

const mount = async (
  position?: CardLoadingIndicatorPosition,
): Promise<AdvancedCameraCardLoading> => {
  const loading = document.createElement('advanced-camera-card-loading');
  if (position) {
    loading.position = position;
  }
  loading.style.cssText = 'position: fixed; inset: 0;';
  document.body.append(loading);
  await loading.updateComplete;
  return loading;
};

afterEach(() => {
  document.querySelectorAll('advanced-camera-card-loading').forEach((loading) => {
    loading.remove();
  });
});

describe('AdvancedCameraCardLoading', () => {
  it('should cover the card, centered, by default', async () => {
    const loading = await mount();
    const style = getComputedStyle(loading);

    expect(loading.getAttribute('position')).toBe('center');
    expect(style.flexDirection).toBe('column');
    expect(style.justifyContent).toBe('center');
  });

  it.each([
    ['top-left', 'flex-start', 'flex-start'],
    ['top-right', 'flex-end', 'flex-start'],
    ['bottom-left', 'flex-start', 'flex-end'],
    ['bottom-right', 'flex-end', 'flex-end'],
  ] as const)(
    'should sit compact in the %s corner, without a background',
    async (position, justify, align) => {
      const loading = await mount(position);
      const style = getComputedStyle(loading);

      expect(style.flexDirection).toBe('row');
      expect(style.justifyContent).toBe(justify);
      expect(style.alignItems).toBe(align);
      expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');

      // A small square icon (not stretched across the row), with the text
      // right next to it rather than pushed to the far side.
      const icon = loading.shadowRoot?.querySelector('advanced-camera-card-icon');
      const iconStyle = icon ? getComputedStyle(icon) : null;
      expect(iconStyle?.width).toBe('24px');
      expect(iconStyle?.height).toBe('24px');

      const iconRight = icon?.getBoundingClientRect().right ?? 0;
      const textLeft =
        loading.shadowRoot?.querySelector('span')?.getBoundingClientRect().left ?? 1000;
      expect(textLeft - iconRight).toBeLessThan(24);
    },
  );

  it.each([
    ['top-left', 'left'],
    ['top-right', 'right'],
  ] as const)(
    'should keep the %s corner in a right-to-left language',
    async (position, side) => {
      document.documentElement.dir = 'rtl';
      try {
        const loading = await mount(position);
        const host = loading.getBoundingClientRect();
        const icon = loading.shadowRoot
          ?.querySelector('advanced-camera-card-icon')
          ?.getBoundingClientRect();
        const text = loading.shadowRoot?.querySelector('span')?.getBoundingClientRect();

        // Icon first, then the text, against the named side.
        expect((icon?.left ?? 0) < (text?.left ?? 0)).toBe(true);
        if (side === 'left') {
          expect((icon?.left ?? 1000) - host.left).toBeLessThan(40);
        } else {
          expect(host.right - (text?.right ?? 0)).toBeLessThan(40);
        }
      } finally {
        document.documentElement.dir = '';
      }
    },
  );
});
