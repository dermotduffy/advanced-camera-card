import { vi } from 'vitest';

import type { Size } from '../../src/utils/basic';

const mockMeasurement = (
  element: HTMLElement,
  property: 'offsetWidth' | 'offsetHeight',
  value?: number,
  later?: number,
): void => {
  if (value === undefined) {
    return;
  }
  const spy = vi
    .spyOn(element, property, 'get')
    .mockReset()
    .mockReturnValue(later ?? value);
  if (later !== undefined) {
    spy.mockReturnValueOnce(value);
  }
};

// jsdom performs no layout, so tests set the layout size explicitly. With
// `later`, the element measures as `size` the first time and as `later` every
// time after that.
export const setLayoutSize = (
  element: HTMLElement,
  size: Partial<Size>,
  later?: Partial<Size>,
): void => {
  mockMeasurement(element, 'offsetWidth', size.width, later?.width);
  mockMeasurement(element, 'offsetHeight', size.height, later?.height);
};
