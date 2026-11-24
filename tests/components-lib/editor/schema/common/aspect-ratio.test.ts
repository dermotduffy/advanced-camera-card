import { assert, describe, expect, it } from 'vitest';

import { createAspectRatioField } from '../../../../../src/components-lib/editor/schema/common/aspect-ratio';

describe('createAspectRatioField', () => {
  it('should derive its label from its path without one', () => {
    expect(createAspectRatioField().label).toBeUndefined();
  });

  it('should use the label it is given', () => {
    expect(createAspectRatioField('Ratio').label).toBe('Ratio');
  });

  it('should show a pair of numbers as a ratio', () => {
    const format = createAspectRatioField().formatDisplayed;
    assert(format);

    expect(format([16, 9])).toBe('16:9');
  });

  it.each([
    ['text', '4/3'],
    ['a single number', [16]],
    ['a pair that is not numbers', ['16', '9']],
    ['null', null],
  ])('should show %s as it is configured', (_name, value) => {
    const format = createAspectRatioField().formatDisplayed;
    assert(format);

    expect(format(value)).toEqual(value);
  });
});
