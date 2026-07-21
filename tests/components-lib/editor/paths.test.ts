import { describe, expect, it } from 'vitest';

import {
  getFormContainerPath,
  stripArrayIndices,
} from '../../../src/components-lib/editor/paths';

describe('getFormContainerPath', () => {
  it('should reverse the innermost-first segments into configuration order', () => {
    expect(getFormContainerPath({ path: ['dashboard', 'cast'] })).toEqual([
      'cast',
      'dashboard',
    ]);
  });

  it('should return an empty path without options', () => {
    expect(getFormContainerPath()).toEqual([]);
  });

  it('should return an empty path without a path in the options', () => {
    expect(getFormContainerPath({})).toEqual([]);
  });

  it('should not modify the passed segments', () => {
    const path = ['dashboard', 'cast'];
    getFormContainerPath({ path });
    expect(path).toEqual(['dashboard', 'cast']);
  });
});

describe('stripArrayIndices', () => {
  it('should strip numeric segments', () => {
    expect(stripArrayIndices(['cameras', 2, 'title'])).toEqual(['cameras', 'title']);
  });

  it('should strip numeric string segments', () => {
    expect(stripArrayIndices(['cameras', '2', 'title'])).toEqual(['cameras', 'title']);
  });

  it('should leave paths without indices untouched', () => {
    expect(stripArrayIndices(['live', 'controls'])).toEqual(['live', 'controls']);
  });
});
