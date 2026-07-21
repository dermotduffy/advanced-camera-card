import { describe, expect, it } from 'vitest';

import {
  createNumberSelector,
  createSelectSelector,
} from '../../../../../src/components-lib/editor/schema/common/selectors';

describe('createSelectSelector', () => {
  it('should build a single-value dropdown from options', () => {
    expect(createSelectSelector(['a', 'b'])).toEqual({
      select: {
        mode: 'dropdown',
        multiple: false,
        custom_value: false,
        options: ['a', 'b'],
      },
    });
  });

  it('should allow multiple values', () => {
    expect(createSelectSelector(['a'], { multiple: true }).select.multiple).toBe(true);
  });

  it('should allow custom values only when no options are given', () => {
    expect(createSelectSelector([]).select.custom_value).toBe(true);
    expect(createSelectSelector(['a']).select.custom_value).toBe(false);
  });
});

describe('createNumberSelector', () => {
  it('should default to an input box with a zero minimum', () => {
    expect(createNumberSelector()).toEqual({
      number: { min: 0, max: undefined, mode: 'box', step: undefined },
    });
  });

  it('should be a slider when a maximum is given', () => {
    expect(createNumberSelector({ min: 1, max: 10, step: 2 })).toEqual({
      number: { min: 1, max: 10, mode: 'slider', step: 2 },
    });
  });
});
