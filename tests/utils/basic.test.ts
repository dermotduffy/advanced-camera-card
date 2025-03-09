import { afterAll, describe, expect, it, vi } from 'vitest';
import { AdvancedCameraCardError } from '../../src/types.js';
import {
  allPromises,
  arefloatsApproximatelyEqual,
  arrayify,
  arrayMove,
  aspectRatioToStyle,
  contentsChanged,
  dayToDate,
  desparsifyArrays,
  errorToConsole,
  formatDate,
  formatDateAndTime,
  generateFloatApproximatelyEqualsCustomizer,
  getChildrenFromElement,
  getDurationString,
  isHoverableDevice,
  isHTMLElement,
  isSuperset,
  isTruthy,
  isValidDate,
  prettifyTitle,
  recursivelyMergeObjectsConcatenatingArraysUniquely,
  recursivelyMergeObjectsNotArrays,
  runWhenIdleIfSupported,
  setify,
  setOrRemoveAttribute,
  sleep,
} from '../../src/utils/basic.js';
import { createSlot, createSlotHost } from '../test-utils.js';

describe('prettifyTitle', () => {
  it('should return undefined when passed undefined', () => {
    expect(prettifyTitle(undefined)).toBe(undefined);
  });
  it('should prettify words', () => {
    expect(prettifyTitle('this is_a  string')).toBe('This Is A String');
  });
});

describe('arrayMove', () => {
  it('should move array item', () => {
    const data = [1, 2, 3];
    expect(arrayMove(data, 1, 0)).toEqual([2, 1, 3]);
  });
});

describe('arrayify', () => {
  it('should convert non array to array', () => {
    expect(arrayify(1)).toEqual([1]);
  });
  it('should return array', () => {
    const data = [1, 2, 3];
    expect(arrayify(data)).toBe(data);
  });
});

describe('setify', () => {
  it('should convert non set to set', () => {
    expect(setify(1)).toEqual(new Set([1]));
  });
  it('should return set', () => {
    const data = new Set([1, 2, 3]);
    expect(setify(data)).toBe(data);
  });
});

describe('contentsChanged', () => {
  it('should have changed contents', () => {
    expect(contentsChanged([1, 2], [2, 1])).toBeTruthy();
  });
  it('should not have changed contents', () => {
    expect(contentsChanged([1, 2], [1, 2])).toBeFalsy();
  });
});

describe('errorToConsole', () => {
  const spy = vi.spyOn(global.console, 'warn').mockImplementation(() => true);

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('should log given error', () => {
    const error = new Error('ERROR');
    errorToConsole(error);
    expect(spy).toHaveBeenCalledWith('ERROR');
  });
  it('should log with context given advanced camera card error', () => {
    const data = { foo: 2 };
    const error = new AdvancedCameraCardError('ERROR', { foo: 2 });
    errorToConsole(error);
    expect(spy).toHaveBeenCalledWith(error, data);
  });
  it('should log with custom function', () => {
    const func = vi.fn();
    const error = new Error('ERROR');
    errorToConsole(error, func);
    expect(func).toHaveBeenCalledWith('ERROR');
  });
  it('should log string', () => {
    errorToConsole('string message');
    expect(spy).toHaveBeenCalledWith('string message');
  });
});

// @vitest-environment jsdom
describe('isHoverableDevice', () => {
  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('should return hoverable', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue(<MediaQueryList>{ matches: true });
    expect(isHoverableDevice()).toBeTruthy();
  });
  it('should return not hoverable', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue(<MediaQueryList>{ matches: false });
    expect(isHoverableDevice()).toBeFalsy();
  });
});

describe('formatDateAndTime', () => {
  it('should format date and time', () => {
    const date = new Date(2023, 3, 14, 13, 35, 0);
    expect(formatDateAndTime(date)).toBe('2023-04-14 13:35');
  });
  it('should format date and time with seconds', () => {
    const date = new Date(2023, 3, 14, 13, 35, 1);
    expect(formatDateAndTime(date, true)).toBe('2023-04-14 13:35:01');
  });
});

describe('formatDate', () => {
  it('should format date', () => {
    const date = new Date(2023, 3, 14, 13, 35, 0);
    expect(formatDate(date)).toBe('2023-04-14');
  });
});

// @vitest-environment jsdom
describe('runWhenIdleIfSupported', () => {
  const originalRequestIdleCallback = window.requestIdleCallback;
  afterAll(() => {
    window.requestIdleCallback = originalRequestIdleCallback;
  });

  it('should run directly when not supported', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).requestIdleCallback = undefined;
    const func = vi.fn();
    runWhenIdleIfSupported(func);
    expect(func).toHaveBeenCalled();
  });

  it('should run idle when supported', () => {
    const requestIdle = vi.fn();
    window.requestIdleCallback = requestIdle;
    const func = vi.fn();
    runWhenIdleIfSupported(func);
    expect(requestIdle).toBeCalledWith(func, {});
  });

  it('should run idle with timeout when supported', () => {
    const requestIdle = vi.fn();
    window.requestIdleCallback = requestIdle;
    const func = vi.fn();
    runWhenIdleIfSupported(func, 10);
    expect(requestIdle).toBeCalledWith(func, { timeout: 10 });
  });
});

describe('getDurationString', () => {
  it('should return duration', () => {
    const start = new Date(2023, 3, 14, 13, 35, 0);
    const end = new Date(2023, 3, 14, 15, 37, 20);
    expect(getDurationString(start, end)).toBe('2h 2m 20s');
  });
  it('should return very short duration', () => {
    const start = new Date(2023, 3, 14, 13, 35, 10);
    const end = new Date(2023, 3, 14, 13, 35, 12);
    expect(getDurationString(start, end)).toBe('2s');
  });
});

describe('allPromises', () => {
  it('should await all promises', async () => {
    const results = await allPromises([1, 2, 3], async (n) => n * 2);
    expect(results).toEqual([2, 4, 6]);
  });
});

describe('dayToDate', () => {
  it('should return correct date', () => {
    expect(dayToDate('2023-04-14')).toEqual(new Date(2023, 3, 14));
  });
});

describe('isSuperset', () => {
  it('should return is a superset', () => {
    expect(isSuperset(new Set([1, 2, 3, 4]), new Set([2, 3]))).toBeTruthy();
  });
  it('should return is not a superset', () => {
    expect(isSuperset(new Set([1, 2, 3, 4]), new Set([2, 3, 5]))).toBeFalsy();
  });
});

describe('sleep', () => {
  it('should sleep', async () => {
    const spy = vi
      .spyOn(global, 'setTimeout')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
      .mockImplementation((func: () => unknown, _time?: number): any => {
        func();
      });
    sleep(10);
    expect(spy).toHaveBeenCalledWith(expect.anything(), 10000);
  });
});

describe('isValidDate', () => {
  it('should be valid date', () => {
    expect(isValidDate(new Date(2023, 3, 28))).toBeTruthy();
  });
  it('should be invalid date', () => {
    expect(isValidDate(new Date('moo'))).toBeFalsy();
  });
});

describe('setOrRemoveAttribute', () => {
  it('should set attribute without value', () => {
    const element = document.createElement('div');
    setOrRemoveAttribute(element, true, 'key');
    expect(element.getAttribute('key')).toBe('');
  });

  it('should set attribute with value', () => {
    const element = document.createElement('div');
    setOrRemoveAttribute(element, true, 'key', 'value');
    expect(element.getAttribute('key')).toBe('value');
  });

  it('should remove attribute date', () => {
    const element = document.createElement('div');
    element.setAttribute('key', 'value');
    setOrRemoveAttribute(element, false, 'key');
    expect(element.getAttribute('key')).toBeFalsy();
  });
});

describe('isTruthy', () => {
  it('should return true for true', () => {
    expect(isTruthy(true)).toBeTruthy();
  });
  it('should return false for false', () => {
    expect(isTruthy(false)).toBeFalsy();
  });
});

describe('isHTMLElement', () => {
  it('should return true for HTMLElement', () => {
    const htmlElement = document.createElement('div');
    expect(isHTMLElement(htmlElement)).toBeTruthy();
  });
  it('should return false for Element', () => {
    const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    expect(isHTMLElement(svgElement)).toBeFalsy();
  });
});

describe('getChildrenFromElement', () => {
  it('should return children for simple parent', () => {
    const children = [document.createElement('div'), document.createElement('div')];
    const parent = document.createElement('div');
    children.forEach((child) => parent.appendChild(child));
    expect(getChildrenFromElement(parent)).toEqual(children);
  });

  it('should return children for slot', () => {
    const children = [document.createElement('div'), document.createElement('div')];
    const slot = createSlot();
    createSlotHost({ slot: slot, children: children });
    expect(getChildrenFromElement(slot)).toEqual(children);
  });
});

describe('recursivelyMergeObjectsNotArrays', () => {
  it('should recursively merge objects but replace arrays', () => {
    expect(
      recursivelyMergeObjectsNotArrays(
        {},
        {
          a: {
            b: {
              c: 3,
              d: {
                e: 4,
              },
              array: [1, 2, 3],
            },
            other: {
              field: 7,
            },
          },
        },
        {
          a: {
            b: {
              array: [4],
              d: {
                e: 5,
              },
            },
          },
        },
      ),
    ).toEqual({
      a: {
        b: {
          c: 3,
          array: [4],
          d: {
            e: 5,
          },
        },
        other: {
          field: 7,
        },
      },
    });
  });
});

describe('recursivelyMergeObjectsConcatenatingArraysUniquely', () => {
  it('should recursively merge objects but uniquely concat arrays', () => {
    expect(
      recursivelyMergeObjectsConcatenatingArraysUniquely(
        {},
        {
          a: {
            b: {
              c: 3,
              d: {
                e: 4,
              },
              array: [5, 1, 2, 3, 4],
            },
            other: {
              field: 7,
            },
          },
        },
        {
          a: {
            b: {
              array: [4, 4, 5],
              d: {
                e: 5,
              },
            },
          },
        },
      ),
    ).toEqual({
      a: {
        b: {
          c: 3,
          array: [5, 1, 2, 3, 4],
          d: {
            e: 5,
          },
        },
        other: {
          field: 7,
        },
      },
    });
  });
});

describe('aspectRatioToStyle', () => {
  it('default', () => {
    expect(aspectRatioToStyle()).toEqual({ 'aspect-ratio': 'auto' });
  });
  it('default static', () => {
    expect(aspectRatioToStyle({ defaultStatic: true })).toEqual({
      'aspect-ratio': '16 / 9',
    });
  });
  it('valid ratio', () => {
    expect(aspectRatioToStyle({ ratio: [4, 3] })).toEqual({ 'aspect-ratio': '4 / 3' });
  });
  it('invalid ratio', () => {
    expect(aspectRatioToStyle({ ratio: [4] })).toEqual({ 'aspect-ratio': 'auto' });
  });
});

describe('desparsifyArrays', () => {
  it('number', () => {
    expect(desparsifyArrays(1)).toBe(1);
  });
  it('string', () => {
    expect(desparsifyArrays('foo')).toBe('foo');
  });
  describe('array', () => {
    it('simple', () => {
      expect(desparsifyArrays([1, 2, undefined, 3])).toEqual([1, 2, 3]);
    });
    it('nested', () => {
      expect(
        desparsifyArrays([
          1,
          2,
          undefined,
          {
            subArray: [undefined, 3],
          },
          4,
        ]),
      ).toEqual([1, 2, { subArray: [3] }, 4]);
    });
  });
  describe('object', () => {
    it('simple', () => {
      expect(
        desparsifyArrays({ foo: [1, 2, undefined, 3], bar: [undefined, 4] }),
      ).toEqual({
        foo: [1, 2, 3],
        bar: [4],
      });
    });
    it('nested', () => {
      expect(
        desparsifyArrays({ foo: { bar: [1, undefined, 2], empty: [undefined] } }),
      ).toEqual({
        foo: {
          bar: [1, 2],
          empty: [],
        },
      });
    });
  });
});

describe('arefloatsApproximatelyEqual', () => {
  describe('without precision', () => {
    it('equals', () => {
      expect(arefloatsApproximatelyEqual(1.1, 1.2)).toBeTruthy();
    });
    it('not equals', () => {
      expect(arefloatsApproximatelyEqual(0.5, 1.5)).toBeFalsy();
    });
  });
  describe('with precision', () => {
    it('equals', () => {
      expect(arefloatsApproximatelyEqual(1.00001, 1.00002, 4)).toBeTruthy();
    });
    it('not equals', () => {
      expect(arefloatsApproximatelyEqual(0.5, 1.5, 4)).toBeFalsy();
    });
  });
});

describe('generateFloatApproximatelyEqualsCustomizer', () => {
  describe('with incorrect types', () => {
    it('undefined a', () => {
      expect(
        generateFloatApproximatelyEqualsCustomizer(4)(undefined, 1.2),
      ).toBeUndefined();
    });
    it('undefined b', () => {
      expect(
        generateFloatApproximatelyEqualsCustomizer(4)(1.2, undefined),
      ).toBeUndefined();
    });
    it('strings', () => {
      expect(
        generateFloatApproximatelyEqualsCustomizer(4)('foo', 'bar'),
      ).toBeUndefined();
    });
  });
  describe('with correct types', () => {
    it('equals', () => {
      expect(
        generateFloatApproximatelyEqualsCustomizer(4)(1.00001, 1.00002),
      ).toBeTruthy();
    });
    it('not equals', () => {
      expect(
        generateFloatApproximatelyEqualsCustomizer(5)(1.00001, 1.00002),
      ).toBeFalsy();
    });
  });
});
